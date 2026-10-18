const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("=================================================");
  console.log("RERUNNING TARGET: cloudco/inv-c-no-total.md (10 RUNS)");
  console.log("=================================================");

  const account = createAccount();
  console.log("Throwaway account:", account.address);

  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  const contractAddress = "0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997";
  const fixtureSha = "17d05116617effeaa127249914f3b4e691ecad40";
  const url = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${fixtureSha}/cloudco/inv-c-no-total.md`;

  function parseExtractionJs(text) {
    if (!text || typeof text !== 'string') return { valid: false };
    let cleaned = text.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
    try {
      const data = JSON.parse(cleaned);
      if (typeof data !== 'object' || data === null) return { valid: false };
      const expectedKeys = ["category", "amount", "currency", "quote"];
      const keys = Object.keys(data);
      if (keys.length !== 4) return { valid: false };
      for (const k of expectedKeys) if (!keys.includes(k)) return { valid: false };
      if (typeof data.amount !== 'number' || typeof data.category !== 'string') return { valid: false };
      return {
        valid: true,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        quote: data.quote,
      };
    } catch (e) {
      return { valid: false };
    }
  }

  let parseSuccesses = 0;
  let expectedHits = 0;
  const runs = [];

  for (let i = 1; i <= 10; i++) {
    const resKey = `inv-c-rerun_${i}`;
    const tStart = Date.now();
    try {
      const txHash = await client.writeContract({
        address: contractAddress,
        functionName: 'probe_extract',
        args: [url, resKey],
      });
      const rcpt = await client.waitForTransactionReceipt({
        hash: txHash,
        retries: 120,
        interval: 3000,
      });
      const lat = ((Date.now() - tStart) / 1000).toFixed(2);
      const lRes = rcpt.consensus_data?.leader_receipt?.[0]?.execution_result;

      const rawOutput = await client.readContract({
        address: contractAddress,
        functionName: 'get_result',
        args: [resKey],
      });

      const parsed = parseExtractionJs(rawOutput);
      const isParseOk = parsed.valid;
      if (isParseOk) parseSuccesses++;
      const isHit = (isParseOk && parsed.amount === 0);
      if (isHit) expectedHits++;

      console.log(`  Run ${i}/10: ${lat}s, status: ${rcpt.status_name}, leader: ${lRes}, parse: ${isParseOk}, hit: ${isHit}`);

      runs.push({
        runIndex: i,
        txHash,
        latency: lat,
        status_name: rcpt.status_name,
        leader_result: lRes,
        rawOutput,
        parsed,
        isParseOk,
        isHit,
      });
    } catch (err) {
      console.error(`  Run ${i}/10 error:`, err.message);
      runs.push({ runIndex: i, error: err.message });
    }
  }

  console.log(`\nRerun Summary for cloudco/inv-c-no-total.md: Parse ${parseSuccesses}/10, Hits ${expectedHits}/10 -> PASS: ${parseSuccesses === 10 && expectedHits >= 9}`);

  const outPath = path.join(__dirname, '../docs/evidence/inv_c_rerun.json');
  fs.writeFileSync(outPath, JSON.stringify({ parseSuccesses, expectedHits, runs }, null, 2));
  console.log("Rerun results saved to:", outPath);
}

main().catch(err => {
  console.error("FATAL ERROR in rerun_inv_c:", err);
  process.exit(1);
});
