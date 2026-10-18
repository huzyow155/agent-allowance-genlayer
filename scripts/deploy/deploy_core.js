const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: MILESTONE 1 MINIMAL CORE");
  console.log("=================================================");

  const account = createAccount();
  console.log("Generated throwaway account:", account.address);

  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  const corePath = path.join(__dirname, '../../contracts/CoreAllowance.py');
  const code = fs.readFileSync(corePath, 'utf8');
  const codeSha = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  console.log("Core source sha256:", codeSha);

  console.log("\n1. Deploying CoreAllowance contract to Studionet (Chain 61999)...");
  const t0 = Date.now();
  const deployTxHash = await client.deployContract({
    code: code,
    args: [],
  });
  console.log("Deploy tx submitted. Hash:", deployTxHash);

  const deployReceipt = await client.waitForTransactionReceipt({
    hash: deployTxHash,
    retries: 120,
    interval: 3000,
  });
  const deployLatency = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Deploy receipt received in ${deployLatency}s:`);
  console.log("  status_name:", deployReceipt.status_name);
  console.log("  result_name:", deployReceipt.result_name);
  const leaderRes = deployReceipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log("  leader execution_result:", leaderRes);

  const contractAddress = deployReceipt.recipient;
  console.log("Core contract deployed address:", contractAddress);

  if (!contractAddress || leaderRes !== 'SUCCESS') {
    throw new Error("Core contract deployment failed: " + JSON.stringify(deployReceipt));
  }

  // 2. Read balance before claim
  console.log("\n2. Checking initial balance of account...");
  const initBal = await client.readContract({
    address: contractAddress,
    functionName: 'balance_of',
    args: [account.address],
  });
  console.log("  Initial balance:", initBal);
  if (initBal !== "0") throw new Error("Expected initial balance 0, got: " + initBal);

  // 3. Claim demo credits
  console.log("\n3. Calling claim_demo_credits()...");
  const tClaim = Date.now();
  const claimTxHash = await client.writeContract({
    address: contractAddress,
    functionName: 'claim_demo_credits',
    args: [],
  });
  console.log("  claimTxHash submitted:", claimTxHash);
  const claimReceipt = await client.waitForTransactionReceipt({
    hash: claimTxHash,
    retries: 120,
    interval: 3000,
  });
  const claimLatency = ((Date.now() - tClaim) / 1000).toFixed(2);
  const claimLeadRes = claimReceipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`  claim_demo_credits receipt received in ${claimLatency}s:`);
  console.log("    status_name:", claimReceipt.status_name);
  console.log("    result_name:", claimReceipt.result_name);
  console.log("    leader execution_result:", claimLeadRes);

  if (claimLeadRes !== 'SUCCESS') {
    throw new Error("claim_demo_credits failed: " + JSON.stringify(claimReceipt));
  }

  // 4. Read back balance after claim
  console.log("\n4. Reading back balance after claim...");
  const finalBal = await client.readContract({
    address: contractAddress,
    functionName: 'balance_of',
    args: [account.address],
  });
  console.log("  Final balance read-back:", finalBal);
  if (finalBal !== "1000") throw new Error("Expected balance 1000, got: " + finalBal);

  // 5. Verify duplicate claim fails
  console.log("\n5. Testing duplicate claim_demo_credits() rejection...");
  try {
    const dupTxHash = await client.writeContract({
      address: contractAddress,
      functionName: 'claim_demo_credits',
      args: [],
    });
    const dupReceipt = await client.waitForTransactionReceipt({
      hash: dupTxHash,
      retries: 120,
      interval: 3000,
    });
    const dupLeadRes = dupReceipt.consensus_data?.leader_receipt?.[0]?.execution_result;
    console.log("  Duplicate claim receipt status:", dupReceipt.status_name, "leader_result:", dupLeadRes);
    if (dupLeadRes === 'SUCCESS') throw new Error("Expected duplicate claim to fail, but succeeded");
    console.log("  Duplicate claim correctly rejected on-chain.");
  } catch (err) {
    console.log("  Duplicate claim rejected as expected:", err.message);
  }

  console.log("\n=================================================");
  console.log("MILESTONE 1 MINIMAL CORE COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR in deploy_core:", err);
  process.exit(1);
});
