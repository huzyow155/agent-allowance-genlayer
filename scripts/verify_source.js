const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function verifyContract(name, deployTxHash, localPath, rpcUrl) {
  const localCode = fs.readFileSync(localPath, 'utf8');
  const localSha256 = crypto.createHash('sha256').update(localCode, 'utf8').digest('hex');

  console.log(`\nVerifying ${name}...`);
  console.log(`  Local file: ${localPath}`);
  console.log(`  Local SHA-256: ${localSha256}`);
  console.log(`  Deploy tx hash: ${deployTxHash}`);

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionByHash',
      params: [deployTxHash],
    }),
  });

  const json = await res.json();
  if (!json.result) {
    throw new Error(`RPC returned empty result for ${name} deploy tx: ` + JSON.stringify(json));
  }

  const contractCodeB64 = json.result.data?.contract_code;
  if (!contractCodeB64) {
    throw new Error(`No data.contract_code in transaction for ${name}: ` + JSON.stringify(json.result.data));
  }

  const decodedSource = Buffer.from(contractCodeB64, 'base64').toString('utf8');
  const chainSha256 = crypto.createHash('sha256').update(decodedSource, 'utf8').digest('hex');

  console.log(`  RPC call used: eth_getTransactionByHash`);
  console.log(`  RPC payload field used: result.data.contract_code (base64 decoded)`);
  console.log(`  On-chain decoded SHA-256: ${chainSha256}`);
  const match = (chainSha256 === localSha256);
  console.log(`  SHA-256 Match: ${match ? 'EXACT MATCH (VERIFIED BYTE-FOR-BYTE)' : 'MISMATCH'}`);

  if (!match) {
    // Generate diff lines
    console.error(`  ERROR: Source mismatch for ${name}!`);
  }

  return {
    contract: name,
    deployTxHash: deployTxHash,
    rpcMethod: 'eth_getTransactionByHash',
    rpcField: 'result.data.contract_code',
    localSha256: localSha256,
    chainSha256: chainSha256,
    byteForByteMatch: match,
    sourceBytesLength: decodedSource.length,
    diffOutput: match ? "0 diff (byte-for-byte identical)" : "Files differ",
    verifiedAt: new Date().toISOString(),
  };
}

async function main() {
  const deploymentsPath = path.join(__dirname, 'deploy/deployments.json');
  if (!fs.existsSync(deploymentsPath)) {
    console.error("No deployments.json found. Run deploy script first.");
    process.exit(1);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  const rpcUrl = deployments.rpc;

  const results = {};
  if (deployments.driftWatch?.deployTxHash) {
    results.driftWatch = await verifyContract(
      'DriftWatch',
      deployments.driftWatch.deployTxHash,
      path.join(__dirname, '../contracts/DriftWatch.py'),
      rpcUrl
    );
  }

  if (deployments.driftGuard?.deployTxHash) {
    results.driftGuard = await verifyContract(
      'DriftGuard',
      deployments.driftGuard.deployTxHash,
      path.join(__dirname, '../contracts/DriftGuard.py'),
      rpcUrl
    );
  }

  fs.writeFileSync(
    path.join(__dirname, 'deploy/verification_result.json'),
    JSON.stringify(results, null, 2)
  );
  console.log("\nSaved verification result to scripts/deploy/verification_result.json");
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
