const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: MILESTONE 0 RUNTIME PROBE");
  console.log("=================================================");

  const account = createAccount();
  console.log("Generated throwaway account:", account.address);

  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  const probePath = path.join(__dirname, '../../contracts/Probe.py');
  const code = fs.readFileSync(probePath, 'utf8');
  const codeSha = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  console.log("Probe source sha256:", codeSha);

  console.log("\n1. Deploying Probe contract to Studionet (Chain 61999)...");
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
  console.log("Probe contract deployed address:", contractAddress);

  if (!contractAddress || leaderRes !== 'SUCCESS') {
    throw new Error("Probe contract deployment failed: " + JSON.stringify(deployReceipt));
  }

  const results = {
    contractAddress,
    deployTxHash,
    deployLatency,
    codeSha256: codeSha,
    sender: account.address,
    views: {},
    transactions: [],
  };

  // Record deploy transaction
  results.transactions.push({
    action: "deploy_probe",
    txHash: deployTxHash,
    status_name: deployReceipt.status_name,
    result_name: deployReceipt.result_name,
    leader_result: leaderRes,
    latency_seconds: deployLatency,
  });

  // 2. Test views
  console.log("\n2. Testing contract views (sender, bool, str, list, int_arg)...");
  const senderView = await client.readContract({
    address: contractAddress,
    functionName: 'get_sender',
    args: [],
  });
  console.log("  get_sender returned:", senderView);
  results.views.sender = senderView;

  const boolView = await client.readContract({
    address: contractAddress,
    functionName: 'probe_bool',
    args: [],
  });
  console.log("  probe_bool returned:", boolView);
  results.views.bool = boolView;

  const strView = await client.readContract({
    address: contractAddress,
    functionName: 'probe_str',
    args: [],
  });
  console.log("  probe_str returned:", strView);
  results.views.str = strView;

  const listView = await client.readContract({
    address: contractAddress,
    functionName: 'probe_list',
    args: [],
  });
  console.log("  probe_list returned:", listView);
  results.views.list = listView;

  const intView = await client.readContract({
    address: contractAddress,
    functionName: 'probe_int_arg',
    args: [42],
  });
  console.log("  probe_int_arg returned:", intView);
  results.views.int_arg = intView;

  // 3. Test write: int argument
  console.log("\n3. Testing write with int argument...");
  const tInt0 = Date.now();
  const txIntHash = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_write_int',
    args: [120],
  });
  console.log("  txIntHash submitted:", txIntHash);
  const rcptInt = await client.waitForTransactionReceipt({
    hash: txIntHash,
    retries: 120,
    interval: 3000,
  });
  const latInt = ((Date.now() - tInt0) / 1000).toFixed(2);
  const leadInt = rcptInt.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`  write_int completed in ${latInt}s (status: ${rcptInt.status_name}, leader: ${leadInt})`);
  const readInt = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['int_test'],
  });
  console.log("  get_result('int_test') read-back:", readInt);
  results.transactions.push({
    action: "probe_write_int",
    txHash: txIntHash,
    status_name: rcptInt.status_name,
    leader_result: leadInt,
    latency_seconds: latInt,
    readBack: readInt,
  });

  // 4. Test write: env, stdlib modules, and large storage payload
  console.log("\n4. Testing write: env, stdlib modules (hashlib, urlsplit, ipaddress, html, re) & 10KB payload...");
  const largePayload = "X".repeat(10240);
  const tEnv0 = Date.now();
  const txEnvHash = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_env_and_storage',
    args: [largePayload],
  });
  console.log("  txEnvHash submitted:", txEnvHash);
  const rcptEnv = await client.waitForTransactionReceipt({
    hash: txEnvHash,
    retries: 120,
    interval: 3000,
  });
  const latEnv = ((Date.now() - tEnv0) / 1000).toFixed(2);
  const leadEnv = rcptEnv.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`  env write completed in ${latEnv}s (status: ${rcptEnv.status_name}, leader: ${leadEnv})`);
  const envInfo = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['env_info'],
  });
  console.log("  get_result('env_info') read-back:", envInfo);
  results.transactions.push({
    action: "probe_env_and_storage",
    txHash: txEnvHash,
    status_name: rcptEnv.status_name,
    leader_result: leadEnv,
    latency_seconds: latEnv,
    envInfo: JSON.parse(envInfo),
  });

  // 5. Test web.get: GitHub raw fixture (.md)
  const rawMdUrl = "https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/inv-a-120.md";
  console.log("\n5. Testing web.get on commit-pinned raw Markdown fixture...");
  console.log("  URL:", rawMdUrl);
  const tMd0 = Date.now();
  const txMdHash = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_web_fetch',
    args: [rawMdUrl, "fixture_md"],
  });
  const rcptMd = await client.waitForTransactionReceipt({
    hash: txMdHash,
    retries: 120,
    interval: 3000,
  });
  const latMd = ((Date.now() - tMd0) / 1000).toFixed(2);
  const leadMd = rcptMd.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`  web.get(.md) completed in ${latMd}s (status: ${rcptMd.status_name}, leader: ${leadMd})`);
  const readMd = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['fixture_md'],
  });
  console.log("  read-back fixture_md:", readMd);
  results.transactions.push({
    action: "probe_web_fetch_md",
    txHash: txMdHash,
    status_name: rcptMd.status_name,
    leader_result: leadMd,
    latency_seconds: latMd,
    result: JSON.parse(readMd),
  });

  // 6. Test web.get: GitHub raw fixture (.html)
  const rawHtmlUrl = "https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/inv-a-120.html";
  console.log("\n6. Testing web.get on commit-pinned raw HTML fixture...");
  console.log("  URL:", rawHtmlUrl);
  const tHtml0 = Date.now();
  const txHtmlHash = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_web_fetch',
    args: [rawHtmlUrl, "fixture_html"],
  });
  const rcptHtml = await client.waitForTransactionReceipt({
    hash: txHtmlHash,
    retries: 120,
    interval: 3000,
  });
  const latHtml = ((Date.now() - tHtml0) / 1000).toFixed(2);
  const leadHtml = rcptHtml.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`  web.get(.html) completed in ${latHtml}s (status: ${rcptHtml.status_name}, leader: ${leadHtml})`);
  const readHtml = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['fixture_html'],
  });
  console.log("  read-back fixture_html:", readHtml);
  results.transactions.push({
    action: "probe_web_fetch_html",
    txHash: txHtmlHash,
    status_name: rcptHtml.status_name,
    leader_result: leadHtml,
    latency_seconds: latHtml,
    result: JSON.parse(readHtml),
  });

  // 7. Test web.get: 404 URL
  const notFoundUrl = "https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/nonexistent-file.md";
  console.log("\n7. Testing web.get on 404 URL...");
  const t4040 = Date.now();
  const tx404Hash = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_web_fetch',
    args: [notFoundUrl, "fixture_404"],
  });
  const rcpt404 = await client.waitForTransactionReceipt({
    hash: tx404Hash,
    retries: 120,
    interval: 3000,
  });
  const lat404 = ((Date.now() - t4040) / 1000).toFixed(2);
  const lead404 = rcpt404.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`  web.get(404) completed in ${lat404}s (status: ${rcpt404.status_name}, leader: ${lead404})`);
  const read404 = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['fixture_404'],
  });
  console.log("  read-back fixture_404:", read404);
  results.transactions.push({
    action: "probe_web_fetch_404",
    txHash: tx404Hash,
    status_name: rcpt404.status_name,
    leader_result: lead404,
    latency_seconds: lat404,
    result: JSON.parse(read404),
  });

  // 8. Test byte stability across 5 repeated fetches
  console.log("\n8. Testing byte stability across 5 repeated fetches...");
  const tStab0 = Date.now();
  const txStabHash = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_byte_stability',
    args: [rawMdUrl, 5],
  });
  const rcptStab = await client.waitForTransactionReceipt({
    hash: txStabHash,
    retries: 120,
    interval: 3000,
  });
  const latStab = ((Date.now() - tStab0) / 1000).toFixed(2);
  const leadStab = rcptStab.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`  probe_byte_stability completed in ${latStab}s (status: ${rcptStab.status_name}, leader: ${leadStab})`);
  const readStab = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['byte_stability'],
  });
  console.log("  read-back byte_stability:", readStab);
  results.transactions.push({
    action: "probe_byte_stability",
    txHash: txStabHash,
    status_name: rcptStab.status_name,
    leader_result: leadStab,
    latency_seconds: latStab,
    result: JSON.parse(readStab),
  });

  // 9. Test LLM execution: exact prompt execution
  console.log("\n9. Testing gl.nondet.exec_prompt with invoice extraction prompt...");
  const promptText = JSON.stringify({
    instructions: "Extract invoice details as flat JSON. Output template: {\"category\": \"OTHER\", \"amount\": 0, \"currency\": \"USD\", \"quote\": \"\"}",
    page_data: "Invoice INV-01. Cloud hosting services. Total due: 120 USD. Due immediately.",
  });
  const tLlm0 = Date.now();
  const txLlmHash = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_llm_execution',
    args: [promptText],
  });
  const rcptLlm = await client.waitForTransactionReceipt({
    hash: txLlmHash,
    retries: 120,
    interval: 3000,
  });
  const latLlm = ((Date.now() - tLlm0) / 1000).toFixed(2);
  const leadLlm = rcptLlm.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`  exec_prompt completed in ${latLlm}s (status: ${rcptLlm.status_name}, leader: ${leadLlm})`);
  const readLlm = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['llm_output'],
  });
  console.log("  read-back llm_output:", readLlm);
  results.transactions.push({
    action: "probe_llm_execution",
    txHash: txLlmHash,
    status_name: rcptLlm.status_name,
    leader_result: leadLlm,
    latency_seconds: latLlm,
    output: readLlm,
  });

  // Save all probe results
  const outPath = path.join(__dirname, 'probe_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log("\nAll probe results saved to:", outPath);
  console.log("MILESTONE 0 PROBE COMPLETED SUCCESSFULLY.");
}

main().catch((err) => {
  console.error("FATAL ERROR in deploy_probe:", err);
  process.exit(1);
});
