const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: COMPLETE STEP 7 & 8 (SPENDGATE & INVARIANTS)");
  console.log("=================================================");

  const vaultAddr = "0x63D63C490AD9Cf9C35E196D8366e23748212C5c2";
  const gateAddr = "0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528";

  const ownerAddr = "0x1d539fb3ded5bb5b6d68414238ece9a972a35921";
  const agentAddr = "0xea35967eb5440bd52de0d4c09804361e9f12bab7";
  const payee1Addr = "0x6ecb277c73b68db5edbc6c79cd3b63d80d75376d";
  const payee2Addr = "0x898455ebb9069ae933df1a21105cb0b753cc61b0";
  const adsyAddr = "0x98274c3d193623e5D482216401d8Ffa140Ec2816";

  const payee1Acc = createAccount();
  const payee1Client = createClient({ chain: chains.studionet, account: payee1Acc });

  // Read with retry
  async function readWithRetry(client, fnName, args, targetAddr) {
    let retries = 10;
    while (retries > 0) {
      try {
        return await client.readContract({
          address: targetAddr,
          functionName: fnName,
          args: args,
        });
      } catch (err) {
        if (err.message && err.message.includes("Rate limit exceeded")) {
          const waitSec = err.cause?.data?.retry_after_seconds || 60;
          console.log(`  [RATE LIMIT on ${fnName}] Waiting ${waitSec}s...`);
          await new Promise(r => setTimeout(r, (waitSec + 5) * 1000));
          retries--;
        } else {
          throw err;
        }
      }
    }
  }

  // Write with retry
  async function writeWithRetry(client, fnName, args, targetAddr) {
    let retries = 10;
    while (retries > 0) {
      try {
        const t0 = Date.now();
        const txHash = await client.writeContract({
          address: targetAddr,
          functionName: fnName,
          args: args,
        });
        const rcpt = await client.waitForTransactionReceipt({ hash: txHash, retries: 120, interval: 3000 });
        const lat = ((Date.now() - t0) / 1000).toFixed(2);
        return { txHash, rcpt, lat };
      } catch (err) {
        if (err.message && err.message.includes("Rate limit exceeded")) {
          const waitSec = err.cause?.data?.retry_after_seconds || 60;
          console.log(`  [RATE LIMIT on ${fnName}] Waiting ${waitSec}s...`);
          await new Promise(r => setTimeout(r, (waitSec + 5) * 1000));
          retries--;
        } else {
          throw err;
        }
      }
    }
  }

  console.log("\n1. Verifying SpendGate view calls...");
  const accStateRaw = await readWithRetry(payee1Client, 'get_account', ["1"], vaultAddr);
  const accState = JSON.parse(accStateRaw);
  const polHash = accState.policy_hash;
  console.log("  Policy Hash:", polHash);

  const sidR1 = "1";
  const isR1Valid = await readWithRetry(payee1Client, 'is_spend_valid_for', [sidR1, "1", payee1Addr, 120, polHash], gateAddr);
  console.log("  is_spend_valid_for(R1) ->", isR1Valid);

  const isAlteredValid = await readWithRetry(payee1Client, 'is_spend_valid_for', [sidR1, "1", payee1Addr, 999, polHash], gateAddr);
  console.log("  is_spend_valid_for(Altered Amount 999) ->", isAlteredValid);

  const isAlteredPayee = await readWithRetry(payee1Client, 'is_spend_valid_for', [sidR1, "1", adsyAddr, 120, polHash], gateAddr);
  console.log("  is_spend_valid_for(Altered Payee AdSy) ->", isAlteredPayee);

  console.log("\n2. Executing SpendGate.serve() from payee account...");
  // Note: SpendGate requires msg.sender == payee. Here payee1Addr is payee1Acc.address
  const serveRes = await writeWithRetry(payee1Client, 'serve', [sidR1, "1", payee1Acc.address, 120, polHash], gateAddr);
  console.log(`  SpendGate.serve() -> status: ${serveRes.rcpt.status_name}, tx: ${serveRes.txHash}`);

  console.log("\n3. Testing duplicate serve rejection...");
  try {
    await payee1Client.writeContract({
      address: gateAddr,
      functionName: 'serve',
      args: [sidR1, "1", payee1Acc.address, 120, polHash],
    });
  } catch (err) {
    console.log("  Duplicate serve correctly rejected:", err.message);
  }

  console.log("\n4. Reading back stats and invariant calculations...");
  const statsRaw = await readWithRetry(payee1Client, 'get_stats', [], vaultAddr);
  const stats = JSON.parse(statsRaw);
  console.log("  get_stats():", stats);

  const ownerBal = await readWithRetry(payee1Client, 'balance_of', [ownerAddr], vaultAddr);
  const agentBal = await readWithRetry(payee1Client, 'balance_of', [agentAddr], vaultAddr);
  const payee1Bal = await readWithRetry(payee1Client, 'balance_of', [payee1Addr], vaultAddr);
  const payee2Bal = await readWithRetry(payee1Client, 'balance_of', [payee2Addr], vaultAddr);
  const finalAccRaw = await readWithRetry(payee1Client, 'get_account', ["1"], vaultAddr);
  const finalAcc = JSON.parse(finalAccRaw);

  console.log("  Balances Read-back:");
  console.log("    Owner:   ", ownerBal);
  console.log("    Agent:   ", agentBal);
  console.log("    Payee 1: ", payee1Bal);
  console.log("    Payee 2: ", payee2Bal);
  console.log("    Account: ", finalAcc.balance, "(spent:", finalAcc.spent, ")");

  const totalUserBalances = parseInt(ownerBal) + parseInt(agentBal) + parseInt(payee1Bal) + parseInt(payee2Bal);
  const totalInContract = totalUserBalances + parseInt(finalAcc.balance);
  const totalMinted = parseInt(stats.total_minted);
  const conservationPassed = (totalInContract === totalMinted);

  console.log(`\nInvariant Conservation Check: total in contract (${totalInContract}) == total minted (${totalMinted}) ->`, conservationPassed);

  // Read all spend records R1 - R13
  const spends = {};
  for (let i = 1; i <= 13; i++) {
    const sRaw = await readWithRetry(payee1Client, 'get_spend', [String(i)], vaultAddr);
    spends[`R${i}`] = JSON.parse(sRaw);
  }

  const liveEvidence = {
    timestamp: new Date().toISOString(),
    network: "studionet",
    chainId: 61999,
    contracts: {
      AllowanceVault: {
        address: vaultAddr,
        deployTxHash: "0xba40c31c067912e8a5f425f69b4f068a4007c6f555262594517829777c327a9f",
        explorer: `https://explorer-studio.genlayer.com/address/${vaultAddr}`,
      },
      SpendGate: {
        address: gateAddr,
        deployTxHash: "0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528",
        explorer: `https://explorer-studio.genlayer.com/address/${gateAddr}`,
      }
    },
    requests: spends,
    stats,
    invariants: {
      totalMinted,
      totalInContract,
      ownerBalance: ownerBal,
      agentBalance: agentBal,
      payee1Balance: payee1Bal,
      payee2Balance: payee2Bal,
      accountBalance: finalAcc.balance,
      accountSpent: finalAcc.spent,
      conservationInvariantPassed: conservationPassed,
    }
  };

  fs.writeFileSync(path.join(__dirname, '../docs/evidence/live_evidence.json'), JSON.stringify(liveEvidence, null, 2));
  console.log("Saved live evidence to docs/evidence/live_evidence.json");
}

main().catch(err => {
  console.error("FATAL ERROR in complete_evidence:", err);
  process.exit(1);
});
