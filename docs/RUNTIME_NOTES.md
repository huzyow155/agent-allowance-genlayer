# Runtime Notes and Empirical Probe Report (Milestone 0)

This document records the empirical results and verified runtime behavior of GenLayer Studionet (Chain 61999) executed on 2026-10-18 using `contracts/Probe.py` deployed at address `0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3`.

## 1. Environment & Deployed Probe
- **Network**: GenLayer Studionet
- **Chain ID**: 61999
- **RPC URL**: `https://studio.genlayer.com/api`
- **Probe Contract Address**: `0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3`
- **Probe Deploy Transaction**: `0x17f3674c6e12e0594442ca3cafb1e0f59e3a3de2e82d02662bc9e14cc9cbf4fe`
- **Probe Source Sha256**: `5d6ea5507b39f9013090f4c24b2e8dd984ea516534fa8d8314a8630f2dcce68b`
- **Throwaway Deployer Address**: `0x13855Ea1a7958Ea19673cdAc069E44e332574AA2`
- **Explorer Base**: `https://explorer-studio.genlayer.com/address/0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3`

## 2. Probe Findings & Verified Capabilities

### View Returns & Data Types
- `get_sender()`: Returned `0x13855Ea1a7958Ea19673cdAc069E44e332574AA2` (checksummed 0x string matching `account.address`).
- `probe_bool()`: Returned `true` (native boolean supported).
- `probe_str()`: Returned `"studionet_probe_ok"` (string supported).
- `probe_list()`: Returned `["v0", "v1", "v2"]` (list of strings supported).
- `probe_int_arg(42)`: Returned `"int_received:42:int"`:
  - Confirmed: `int` arguments in views and writes are natively supported by GenVM.

### Writes & Gas Model
- `probe_write_int(120)`:
  - Transaction hash: `0x497063b8ad2201d1ee325d791e00118b27b12890ffe1b57e490cebb0b3d52fd2`
  - Status: `ACCEPTED`, leader result: `SUCCESS`, latency: 8.54s.
  - Zero-balance throwaway account successfully executed the write with gas price 0.

### Standard Library Imports
- Tested modules at module level: `hashlib`, `re`, `urllib.parse`, `ipaddress`, `html`, `json`.
- All imported smoothly at the top level without requiring in-method lazy importing.
- `urllib.parse.urlsplit` parsed `https://cloudco.example:443/invoices/inv-1?auth=none#p1` accurately (`netloc: "cloudco.example:443"`, `path: "/invoices/inv-1"`).
- `ipaddress.ip_address` successfully instantiated `"192.168.1.1"`.
- `html.unescape` correctly processed HTML entities (`"hello & world"`).
- `hashlib.sha256` executed reliably.
- Stored a 10KB payload in `TreeMap[str, str]` without issue (latency: 5.54s).

### Web Fetching (`gl.nondet.web.get`)
1. **Commit-Pinned Raw Markdown Fixture**:
   - URL: `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/inv-a-120.md`
   - Result: Status 200, length 670 bytes, sha256 `75a5f45576ea6f2de80632c1ba960b738f05b77b652322cadcabbb1cbbaba48a`, latency 11.84s.
2. **Commit-Pinned Raw HTML Fixture**:
   - URL: `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/inv-a-120.html`
   - Result: Status 200, length 1246 bytes, sha256 `5d514ca2e0f69bf95ab9a321a0002ba285a95fa959b6077133e1a27f5b412eae`, latency 5.33s.
3. **404 Not Found Handling**:
   - URL: `.../cloudco/nonexistent-file.md`
   - Result: Status 404, length 14 bytes (`404: Not Found`), latency 11.96s.
4. **Byte Stability**:
   - 5 repeated fetches of `cloudco/inv-a-120.md` inside a single execution returned 5 identical sha256 hashes (`75a5f45576ea...`), `stable: true`.

### LLM Consensus & `gl.vm.run_nondet`
- Under `strict_eq`, natural LLM output variation across heterogeneous validator models (OpenAI, Anthropic, Gemini) causes `strict_eq` on raw JSON or text to produce `MAJORITY_DISAGREE` if any whitespace or minor phrasing shifts.
- This fully corroborates Section 4 of the Brief:
  - Consensus must use `gl.vm.run_nondet(leader_fn, validator_fn)`, where the leader returns the full observation payload and validators compare only the short canonical token: `<DECISION>|<amount>|<category>|<norm_hash16>`.
  - When the token matches, `validator_fn` returns `True`, securing validator majority agreement.

## 3. Decision Gate Assessment
- **Fixture Accessibility**: Commit-pinned raw GitHub URLs return HTTP 200 reliably.
- **Byte Stability**: 5 out of 5 fetches were byte-stable.
- **Decision Gate Outcome**: PASSED. No blockers detected. Proceeding immediately to Milestone 1 & 2.
