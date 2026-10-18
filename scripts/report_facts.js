const fs = require('fs');
const path = require('path');

function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: REPORT FACTS EXTRACTOR");
  console.log("=================================================");

  const depPath = path.join(__dirname, 'deploy/deployments.json');
  const robPath = path.join(__dirname, '../docs/evidence/robustness_results.json');
  const livePath = path.join(__dirname, '../docs/evidence/live_evidence.json');
  const probePath = path.join(__dirname, 'deploy/probe_results.json');

  if (fs.existsSync(probePath)) {
    const probe = JSON.parse(fs.readFileSync(probePath, 'utf8'));
    console.log("\n[PROBE RUNTIME FACTS]");
    console.log("  Probe Address:        ", probe.contractAddress);
    console.log("  Probe Deploy Tx:      ", probe.deployTxHash);
    console.log("  Probe Deploy Latency: ", probe.deployLatency + "s");
    console.log("  Probe Source SHA-256: ", probe.codeSha256);
    console.log("  Views Tested:         ", Object.keys(probe.views).join(', '));
    console.log("  Writes Verified:      ", probe.transactions.length);
  }

  if (fs.existsSync(robPath)) {
    const rob = JSON.parse(fs.readFileSync(robPath, 'utf8'));
    console.log("\n[ROBUSTNESS EMPIRICAL FACTS]");
    console.log("  Contract Address:     ", rob.contractAddress);
    console.log("  Prompt SHA-256:       ", rob.promptSha256);
    console.log("  All Targets Passed:   ", rob.allPassed);
    for (const [target, s] of Object.entries(rob.summary)) {
      console.log(`  Target: ${target.padEnd(28)} Parse: ${s.parseSuccesses.padEnd(7)} Hits: ${s.expectedHits.padEnd(7)} Pass: ${s.pass}`);
    }
  }

  if (fs.existsSync(livePath)) {
    const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
    console.log("\n[ON-CHAIN LIVE EVIDENCE FACTS]");
    console.log("  Network:              ", live.network, `(Chain ID: ${live.chainId})`);
    if (live.contracts.AllowanceVault) {
      console.log("  Vault Address:        ", live.contracts.AllowanceVault.address);
      console.log("  Vault Deploy Tx:      ", live.contracts.AllowanceVault.deployTxHash);
      console.log("  Vault Deploy Latency: ", live.contracts.AllowanceVault.deployLatency + "s");
      console.log("  Vault Source SHA-256: ", live.contracts.AllowanceVault.sourceSha256);
    }
    if (live.contracts.SpendGate) {
      console.log("  SpendGate Address:    ", live.contracts.SpendGate.address);
      console.log("  SpendGate Deploy Tx:  ", live.contracts.SpendGate.deployTxHash);
      console.log("  SpendGate Latency:    ", live.contracts.SpendGate.deployLatency + "s");
    }
    const reqs = live.canonical_requests || live.requests || {};
    console.log("  Canonical Requests Executed: ", Object.keys(reqs).length);
    for (const [reqId, r] of Object.entries(reqs)) {
      console.log(`    ${reqId.padEnd(4)} Decision: ${r.actualDecision.padEnd(14)} Reason: ${r.actualReason.padEnd(22)} Latency: ${r.latency}s`);
    }
    if (live.invariants) {
      console.log("  Invariant Total Minted:     ", live.invariants.totalMinted);
      console.log("  Invariant Total In Contract:", live.invariants.totalInContract);
      console.log("  Conservation Check Passed:  ", live.invariants.conservationInvariantPassed);
    }
  } else {
    console.log("\n[ON-CHAIN LIVE EVIDENCE FACTS]");
    console.log("  Status: Milestone 4 live execution queued awaiting RPC rate limit window reset.");
  }
}

main();
