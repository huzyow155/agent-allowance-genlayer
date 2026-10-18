const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: MILESTONE 4 ON-CHAIN EVIDENCE");
  console.log("=================================================");

  const ownerAcc = createAccount();
  const agentAcc = createAccount();
  const payee1Acc = createAccount(); // CloudCo
  const payee2Acc = createAccount(); // DataShop
  const adsyAcc = createAccount();   // AdSy (Unregistered)

  console.log("Generated Accounts:");
  console.log("  Owner:   ", ownerAcc.address);
  console.log("  Agent:   ", agentAcc.address);
  console.log("  Payee 1: ", payee1Acc.address, "(CloudCo)");
  console.log("  Payee 2: ", payee2Acc.address, "(DataShop)");
  console.log("  AdSy:    ", adsyAcc.address, "(Unregistered)");

  const ownerClient = createClient({ chain: chains.studionet, account: ownerAcc });
  const agentClient = createClient({ chain: chains.studionet, account: agentAcc });
  const payee1Client = createClient({ chain: chains.studionet, account: payee1Acc });

  const evidenceRecords = {
    timestamp: new Date().toISOString(),
    network: "studionet",
    chainId: 61999,
    contracts: {},
    transactions: [],
    requests: {},
    readBacks: {},
    invariants: {},
  };

  // 1. Deploy AllowanceVault
  const vaultPath = path.join(__dirname, '../../contracts/AllowanceVault.py');
  const vaultCode = fs.readFileSync(vaultPath, 'utf8');
  const vaultSha = crypto.createHash('sha256').update(vaultCode, 'utf8').digest('hex');
  console.log("\n1. Deploying AllowanceVault.py...");
  console.log("   Source sha256:", vaultSha);

  async function deployWithRetry(client, code, args) {
    let retries = 30;
    while (retries > 0) {
      try {
        const t0 = Date.now();
        const deployTx = await client.deployContract({ code, args });
        const deployRcpt = await client.waitForTransactionReceipt({ hash: deployTx, retries: 120, interval: 3000 });
        const deployLat = ((Date.now() - t0) / 1000).toFixed(2);
        return { deployTx, deployRcpt, deployLat };
      } catch (err) {
        if (err.message && err.message.includes("Rate limit exceeded")) {
          const waitSec = err.cause?.data?.retry_after_seconds || 60;
          console.log(`  [RATE LIMIT] Deploy rate-limited. Waiting ${waitSec}s before retrying...`);
          await new Promise(r => setTimeout(r, (waitSec + 5) * 1000));
          retries--;
        } else {
          throw err;
        }
      }
    }
    throw new Error("Deploy failed after repeated rate limit retries");
  }

  const { deployTx, deployRcpt, deployLat } = await deployWithRetry(ownerClient, vaultCode, []);
  const vaultAddr = deployRcpt.recipient;
  const leadRes = deployRcpt.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`AllowanceVault deployed at ${vaultAddr} in ${deployLat}s (leader: ${leadRes})`);

  if (!vaultAddr || leadRes !== 'SUCCESS') {
    throw new Error("AllowanceVault deployment failed: " + JSON.stringify(deployRcpt));
  }

  evidenceRecords.contracts.AllowanceVault = {
    address: vaultAddr,
    deployTxHash: deployTx,
    deployLatency: deployLat,
    sourceSha256: vaultSha,
    explorer: `https://explorer-studio.genlayer.com/address/${vaultAddr}`,
  };

  // Helper for recording tx with rate-limit retry support
  async function execTx(client, label, fnName, args, targetContractAddr = vaultAddr) {
    let retries = 5;
    while (retries > 0) {
      try {
        const t0 = Date.now();
        const txHash = await client.writeContract({
          address: targetContractAddr,
          functionName: fnName,
          args: args,
        });
        const rcpt = await client.waitForTransactionReceipt({ hash: txHash, retries: 120, interval: 3000 });
        const lat = ((Date.now() - t0) / 1000).toFixed(2);
        const lRes = rcpt.consensus_data?.leader_receipt?.[0]?.execution_result;
        console.log(`  [${label}] ${fnName}() -> ${lat}s, status: ${rcpt.status_name}, leader: ${lRes}, tx: ${txHash}`);
        evidenceRecords.transactions.push({
          label,
          fnName,
          txHash,
          latency: lat,
          status_name: rcpt.status_name,
          result_name: rcpt.result_name,
          leader_result: lRes,
        });
        return { txHash, rcpt, latency: lat, leader_result: lRes };
      } catch (err) {
        if (err.message && err.message.includes("Rate limit exceeded")) {
          const waitSec = err.cause?.data?.retry_after_seconds || 60;
          console.log(`  [RATE LIMIT] ${err.message}. Waiting ${waitSec}s before retry...`);
          await new Promise(r => setTimeout(r, (waitSec + 5) * 1000));
          retries--;
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Failed ${fnName} after repeated rate limit retries`);
  }

  // 2. Setup (claim credits, create account, fund account, add agent)
  console.log("\n2. Setting up account and funding...");
  await execTx(ownerClient, "claim_credits_owner", "claim_demo_credits", []);
  await execTx(agentClient, "claim_credits_agent", "claim_demo_credits", []);

  const fixtureSha = "17d05116617effeaa127249914f3b4e691ecad40";
  const cloudcoPrefix = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${fixtureSha}/cloudco/`;
  const datashopPrefix = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${fixtureSha}/datashop/`;
  const adsyPrefix = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${fixtureSha}/adsy/`;

  const policy = {
    per_spend_cap: 200,
    total_budget: 500,
    max_spends: 6,
    currency: "USD",
    categories: ["CLOUD", "DATA", "SOFTWARE"],
    payees: [
      { payee: payee1Acc.address.toLowerCase(), prefix: cloudcoPrefix },
      { payee: payee2Acc.address.toLowerCase(), prefix: datashopPrefix },
    ],
  };

  console.log("Creating account with policy...");
  await execTx(ownerClient, "create_account", "create_account", ["Production Allowance Account", JSON.stringify(policy)]);
  
  console.log("Funding account with 500 credits (exact total budget)...");
  await execTx(ownerClient, "fund_account", "fund_account", ["1", 500]);

  console.log("Authorizing agent...");
  await execTx(ownerClient, "add_agent", "add_agent", ["1", agentAcc.address]);

  // Read-back setup state
  const accState = await ownerClient.readContract({ address: vaultAddr, functionName: 'get_account', args: ["1"] });
  console.log("Initial Account State Read-back:\n", accState);
  evidenceRecords.readBacks.account_initial = JSON.parse(accState);

  // 3. Canonical Test Suite: R1 through R13
  console.log("\n3. Executing Canonical Requests R1 - R13...");

  const baseFixtures = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${fixtureSha}/`;

  const requestDefs = [
    { id: "R1", payee: payee1Acc.address, amt: 120, cat: "CLOUD", file: "cloudco/inv-a-120.md", expected: "APPROVE", expReason: "-" },
    { id: "R2", payee: payee1Acc.address, amt: 120, cat: "CLOUD", file: "cloudco/inv-a-120.html", expected: "APPROVE", expReason: "-" },
    { id: "R3", payee: payee1Acc.address, amt: 100, cat: "CLOUD", file: "cloudco/inv-a-120.md", expected: "DENY", expReason: "amount_mismatch" },
    { id: "R4", payee: payee1Acc.address, amt: 450, cat: "CLOUD", file: "cloudco/inv-b-450.md", expected: "DENY", expReason: "over_cap" },
    { id: "R5", payee: payee1Acc.address, amt: 150, cat: "CLOUD", file: "cloudco/inv-d-injection.md", expected: "ASK_OWNER", expReason: "tripwire" },
    { id: "R6", payee: payee1Acc.address, amt: 120, cat: "CLOUD", file: "cloudco/inv-c-no-total.md", expected: "ASK_OWNER", expReason: "amount_unclear" },
    { id: "R7", payee: payee2Acc.address, amt: 90, cat: "DATA", file: "datashop/inv-e-90.md", expected: "APPROVE", expReason: "-" },
    { id: "R8", payee: payee2Acc.address, amt: 90, cat: "DATA", file: "datashop/inv-f-eur.md", expected: "DENY", expReason: "currency_mismatch" },
    { id: "R9", payee: payee1Acc.address, amt: 80, cat: "CLOUD", file: "adsy/inv-g-80.md", expected: "DENY", expReason: "evidence_not_bound" },
    { id: "R10", payee: adsyAcc.address, amt: 80, cat: "MARKETING", file: "adsy/inv-g-80.md", expected: "DENY", expReason: "payee_unknown" },
    { id: "R11", payee: payee1Acc.address, amt: 60, cat: "MARKETING", file: "cloudco/inv-h-marketing.md", expected: "DENY", expReason: "category_not_allowed" },
    { id: "R12", payee: payee1Acc.address, amt: 60, cat: "CLOUD", file: "cloudco/inv-h-marketing.md", expected: "DENY", expReason: "category_not_allowed" },
    { id: "R13", payee: payee1Acc.address, amt: 180, cat: "CLOUD", file: "cloudco/inv-a-120.md", expected: "DENY", expReason: "over_budget" },
  ];

  for (const r of requestDefs) {
    const evUrl = baseFixtures + r.file;
    const res = await execTx(agentClient, r.id, "request_spend", ["1", r.payee, r.amt, r.cat, evUrl]);
    
    // Read back latest spend
    const sid = String(evidenceRecords.transactions.filter(t => t.fnName === "request_spend").length);
    const spendJson = await agentClient.readContract({ address: vaultAddr, functionName: 'get_spend', args: [sid] });
    const spendData = JSON.parse(spendJson);
    console.log(`    Result ${r.id}: decision=${spendData.decision}, reason=${spendData.reason}, quote="${spendData.quote}"`);

    evidenceRecords.requests[r.id] = {
      spendId: sid,
      payee: r.payee,
      declaredAmount: r.amt,
      declaredCategory: r.cat,
      evidenceUrl: evUrl,
      expectedDecision: r.expected,
      expectedReason: r.expReason,
      actualDecision: spendData.decision,
      actualReason: spendData.reason,
      observedAmount: spendData.observed_amount,
      observedCategory: spendData.observed_category,
      quote: spendData.quote,
      normHash16: spendData.norm_hash16,
      executed: spendData.executed,
      txHash: res.txHash,
      latency: res.latency,
    };
  }

  // 4. Duplicate observation check (R1 repeat)
  console.log("\n4. Testing duplicate observation rejection on-chain...");
  try {
    const dupUrl = baseFixtures + "cloudco/inv-a-120.md";
    await execTx(agentClient, "duplicate_check", "request_spend", ["1", payee1Acc.address, 120, "CLOUD", dupUrl]);
  } catch (err) {
    console.log("  Duplicate observation rejected as expected:", err.message);
    evidenceRecords.transactions.push({
      label: "duplicate_check",
      error: err.message,
    });
  }

  // 5. Unreachable 404 & Too-short page errors
  console.log("\n5. Testing 404 and short page UserErrors...");
  try {
    const notFoundUrl = cloudcoPrefix + "nonexistent.md";
    await execTx(agentClient, "test_404", "request_spend", ["1", payee1Acc.address, 120, "CLOUD", notFoundUrl]);
  } catch (err) {
    console.log("  404 error caught:", err.message);
    evidenceRecords.transactions.push({ label: "test_404", error: err.message });
  }

  try {
    const shortUrl = cloudcoPrefix + "inv-short.md";
    await execTx(agentClient, "test_short", "request_spend", ["1", payee1Acc.address, 120, "CLOUD", shortUrl]);
  } catch (err) {
    console.log("  Short page error caught:", err.message);
    evidenceRecords.transactions.push({ label: "test_short", error: err.message });
  }

  // 6. Owner inbox resolution (resolve R5 as rejected, R6 as approved)
  console.log("\n6. Testing resolve_spend on PENDING spends (R5 & R6)...");
  // Find spend id for R5 and R6
  const sidR5 = evidenceRecords.requests["R5"].spendId;
  const sidR6 = evidenceRecords.requests["R6"].spendId;

  console.log(`  Resolving R5 (spend ${sidR5}) as OWNER_REJECTED...`);
  await execTx(ownerClient, "resolve_R5_reject", "resolve_spend", [sidR5, false]);
  const s5After = JSON.parse(await ownerClient.readContract({ address: vaultAddr, functionName: 'get_spend', args: [sidR5] }));
  console.log(`    Spend ${sidR5} decision after resolve:`, s5After.decision);

  console.log(`  Resolving R6 (spend ${sidR6}) as OWNER_APPROVED...`);
  await execTx(ownerClient, "resolve_R6_approve", "resolve_spend", [sidR6, true]);
  const s6After = JSON.parse(await ownerClient.readContract({ address: vaultAddr, functionName: 'get_spend', args: [sidR6] }));
  console.log(`    Spend ${sidR6} decision after resolve:`, s6After.decision, "executed:", s6After.executed);

  // 7. Deploy and test SpendGate
  console.log("\n7. Deploying and validating SpendGate...");
  const gatePath = path.join(__dirname, '../../contracts/SpendGate.py');
  const gateCode = fs.readFileSync(gatePath, 'utf8');
  const gateSha = crypto.createHash('sha256').update(gateCode, 'utf8').digest('hex');

  const { deployTx: gateDeployTx, deployRcpt: gateRcpt, deployLat: gateLat } = await deployWithRetry(payee1Client, gateCode, [vaultAddr]);
  const gateAddr = gateRcpt.recipient;
  console.log(`SpendGate deployed at ${gateAddr} in ${gateLat}s (leader: ${gateRcpt.consensus_data?.leader_receipt?.[0]?.execution_result})`);

  evidenceRecords.contracts.SpendGate = {
    address: gateAddr,
    deployTxHash: gateDeployTx,
    deployLatency: gateLat,
    sourceSha256: gateSha,
    explorer: `https://explorer-studio.genlayer.com/address/${gateAddr}`,
  };

  const gateClient = createClient({ chain: chains.studionet, account: payee1Acc });

  // Get policy hash
  const accFinal = JSON.parse(await ownerClient.readContract({ address: vaultAddr, functionName: 'get_account', args: ["1"] }));
  const polHash = accFinal.policy_hash;

  // Spend 1 (R1) is approved and executed for 120 USD to payee1
  const sidR1 = evidenceRecords.requests["R1"].spendId;
  const isR1Valid = await gateClient.readContract({
    address: gateAddr,
    functionName: 'is_spend_valid_for',
    args: [sidR1, "1", payee1Acc.address, 120, polHash],
  });
  console.log(`  SpendGate.is_spend_valid_for(R1) ->`, isR1Valid);

  // Altered amount check
  const isAlteredValid = await gateClient.readContract({
    address: gateAddr,
    functionName: 'is_spend_valid_for',
    args: [sidR1, "1", payee1Acc.address, 999, polHash],
  });
  console.log(`  SpendGate.is_spend_valid_for(Altered Amount) ->`, isAlteredValid);

  // Altered payee check
  const isAlteredPayee = await gateClient.readContract({
    address: gateAddr,
    functionName: 'is_spend_valid_for',
    args: [sidR1, "1", adsyAcc.address, 120, polHash],
  });
  console.log(`  SpendGate.is_spend_valid_for(Altered Payee) ->`, isAlteredPayee);

  // Serve R1
  console.log("  Payee serving R1 order...");
  await execTx(gateClient, "serve_R1", "serve", [sidR1, "1", payee1Acc.address, 120, polHash], gateAddr);

  // Verify second serve rejected
  try {
    await gateClient.writeContract({
      address: gateAddr,
      functionName: 'serve',
      args: [sidR1, "1", payee1Acc.address, 120, polHash],
    });
  } catch (err) {
    console.log("  Second serve rejected as expected:", err.message);
  }

  // 8. Read-backs and Conservation Invariant
  console.log("\n8. Finalizing Read-Backs and Invariant Audit...");
  const statsJson = await ownerClient.readContract({ address: vaultAddr, functionName: 'get_stats', args: [] });
  const stats = JSON.parse(statsJson);
  console.log("  get_stats():", stats);

  const finalOwnerBal = await ownerClient.readContract({ address: vaultAddr, functionName: 'balance_of', args: [ownerAcc.address] });
  const finalAgentBal = await ownerClient.readContract({ address: vaultAddr, functionName: 'balance_of', args: [agentAcc.address] });
  const finalPayee1Bal = await ownerClient.readContract({ address: vaultAddr, functionName: 'balance_of', args: [payee1Acc.address] });
  const finalPayee2Bal = await ownerClient.readContract({ address: vaultAddr, functionName: 'balance_of', args: [payee2Acc.address] });
  const finalAccountState = JSON.parse(await ownerClient.readContract({ address: vaultAddr, functionName: 'get_account', args: ["1"] }));

  console.log("  Balances Read-back:");
  console.log("    Owner:   ", finalOwnerBal);
  console.log("    Agent:   ", finalAgentBal);
  console.log("    Payee 1: ", finalPayee1Bal);
  console.log("    Payee 2: ", finalPayee2Bal);
  console.log("    Account: ", finalAccountState.balance, "(spent:", finalAccountState.spent, ")");

  const totalUserBalances = parseInt(finalOwnerBal) + parseInt(finalAgentBal) + parseInt(finalPayee1Bal) + parseInt(finalPayee2Bal);
  const totalInContract = totalUserBalances + parseInt(finalAccountState.balance);
  const totalMinted = parseInt(stats.total_minted);

  console.log(`\nInvariant Check: Total in contract (${totalInContract}) == Total Minted (${totalMinted})`);
  const invariantHolds = (totalInContract === totalMinted);
  console.log("Conservation Invariant Holds:", invariantHolds);

  evidenceRecords.invariants = {
    totalMinted,
    totalInContract,
    ownerBalance: finalOwnerBal,
    agentBalance: finalAgentBal,
    payee1Balance: finalPayee1Bal,
    payee2Balance: finalPayee2Bal,
    accountBalance: finalAccountState.balance,
    accountSpent: finalAccountState.spent,
    conservationInvariantPassed: invariantHolds,
  };

  const outPath = path.join(__dirname, '../../docs/evidence/live_evidence.json');
  fs.writeFileSync(outPath, JSON.stringify(evidenceRecords, null, 2));
  console.log("\nAll live evidence saved to:", outPath);
  console.log("MILESTONE 4 ON-CHAIN VALIDATION COMPLETE!");
}

main().catch(err => {
  console.error("FATAL ERROR in deploy_and_run_evidence:", err);
  process.exit(1);
});
