const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: EMPIRICAL ROBUSTNESS HARNESS");
  console.log("=================================================");

  const account = createAccount();
  console.log("Generated throwaway account:", account.address);

  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  const probePath = path.join(__dirname, '../contracts/ProbeExtract.py');
  const code = fs.readFileSync(probePath, 'utf8');
  const codeSha = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  console.log("ProbeExtract source sha256:", codeSha);

  console.log("\n1. Deploying ProbeExtract contract to Studionet...");
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
  const leaderRes = deployReceipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  const contractAddress = deployReceipt.recipient;
  console.log(`ProbeExtract deployed at ${contractAddress} in ${deployLatency}s (leader: ${leaderRes})`);

  if (!contractAddress || leaderRes !== 'SUCCESS') {
    throw new Error("ProbeExtract deployment failed: " + JSON.stringify(deployReceipt));
  }

  const fixtureSha = "17d05116617effeaa127249914f3b4e691ecad40";
  const basePrefix = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${fixtureSha}/`;

  const targets = [
    { file: "cloudco/inv-a-120.md", expectedAmt: 120, expectedCat: "CLOUD", expectedCurr: "USD" },
    { file: "cloudco/inv-a-120.html", expectedAmt: 120, expectedCat: "CLOUD", expectedCurr: "USD" },
    { file: "datashop/inv-e-90.md", expectedAmt: 90, expectedCat: "DATA", expectedCurr: "USD" },
    { file: "datashop/inv-f-eur.md", expectedAmt: 90, expectedCat: "DATA", expectedCurr: "EUR" },
    { file: "cloudco/inv-c-no-total.md", expectedAmt: 0, expectedCat: "CLOUD", expectedCurr: "USD" },
    { file: "cloudco/inv-h-marketing.md", expectedAmt: 60, expectedCat: "MARKETING", expectedCurr: "USD" },
  ];

  const results = {
    contractAddress,
    deployTxHash,
    deployLatency,
    fixtureCommitSha: fixtureSha,
    summary: {},
    runs: [],
  };

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

  console.log("\n2. Executing 10 repeated extraction runs per document (60 runs total)...");

  for (const t of targets) {
    const url = basePrefix + t.file;
    console.log(`\n--- Target: ${t.file} ---`);
    let parseSuccesses = 0;
    let expectedHits = 0;

    for (let i = 1; i <= 10; i++) {
      const resKey = `${path.basename(t.file)}_${i}`;
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

        let isHit = false;
        if (isParseOk) {
          if (t.file === "cloudco/inv-c-no-total.md") {
            // For no-total proforma, amount 0 is expected
            isHit = (parsed.amount === 0);
          } else {
            isHit = (parsed.amount === t.expectedAmt && parsed.category === t.expectedCat);
          }
          if (isHit) expectedHits++;
        }

        console.log(`  Run ${i}/10: ${lat}s, status: ${rcpt.status_name}, leader: ${lRes}, parse: ${isParseOk}, hit: ${isHit}`);

        results.runs.push({
          target: t.file,
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
        console.error(`  Run ${i}/10 ERROR:`, err.message);
        results.runs.push({
          target: t.file,
          runIndex: i,
          error: err.message,
        });
      }
    }

    results.summary[t.file] = {
      parseSuccesses: `${parseSuccesses}/10`,
      expectedHits: `${expectedHits}/10`,
      pass: parseSuccesses === 10 && expectedHits >= 9,
    };
    console.log(`Summary for ${t.file}: Parse ${parseSuccesses}/10, Hits ${expectedHits}/10 -> PASS: ${results.summary[t.file].pass}`);
  }

  const outDir = path.join(__dirname, '../docs/evidence');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'robustness_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log("\nRobustness results successfully saved to:", outPath);
}

main().catch((err) => {
  console.error("FATAL ERROR in run_robustness:", err);
  process.exit(1);
});
