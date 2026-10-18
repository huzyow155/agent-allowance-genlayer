# Limitations and Assumptions

This document records the foundational constraints and limitations of the Agent Allowance intelligent contract system (`AllowanceVault` and `SpendGate`) on GenLayer Studionet (Chain 61999).

## 1. Credit Ledger Only (No Real Funds)
- The contracts operate strictly as an internal credit accounting ledger.
- No native GEN, ETH, or external ERC-20 tokens are locked, escrowed, or transferred.
- Credits are minted via demo provisions (`claim_demo_credits`) and hold zero economic or monetary value. The contracts are not a licensed financial transmission system.

## 2. Public Static Web Pages
- Invoice evidence URLs must resolve to static, unauthenticated, publicly accessible web documents (plain text, markdown, or HTML).
- Invoices rendered via client-side JavaScript, single-page web applications (SPAs), captcha-gated sites, or authenticated paywalls are not supported.
- If a document is unreachable, returns HTTP non-200, exceeds maximum size caps, or yields under 100 characters of cleaned text, the transaction halts with a user-facing error (`gl.vm.UserError`).

## 3. Human Owner Curates Payee Allowlist and Prefixes
- The contract does not independently verify the business registration, creditworthiness, or legal identity of payees.
- The human account owner explicitly defines registered payee addresses and their associated HTTPS URL prefix roots (e.g. `https://raw.githubusercontent.com/.../cloudco/`).
- The contract guarantees that the evidence URL begins with the exact prefix and satisfies strict URL structural parser checks (scheme, host equality, port, no dot-segments, no percent-encoded traversal).

## 4. No Real-Time Wall-Clock Schedules
- GenVM executes without access to an authoritative, non-deterministic local wall clock.
- Spending limits are strictly event- and threshold-based:
  - `per_spend_cap`: Maximum credit amount for any individual spend.
  - `total_budget`: Cumulative credit ceiling across all spends.
  - `max_spends`: Maximum number of spend executions allowed for the account.
- Calendar-based daily, weekly, or monthly recurring allowances are out of scope.

## 5. Non-Deterministic Model Extraction and Human Escalation
- Natural language extraction performed by LLMs across distributed validators is non-deterministic.
- To prevent consensus divergence, validators agree exclusively on a compact, deterministically generated consensus token: `<DECISION>|<amount>|<category>|<norm_hash16>`.
- Any ambiguous case (such as unclear category, missing total, unparseable response, or failed verbatim quote matching) automatically resolves safely to `ASK_OWNER` (`PENDING`).
- The human owner can manually review and resolve pending spends through `resolve_spend(spend_id, approve)`.

## 6. Immutable Account Policy
- Once an account is created with its policy parameters, its policy cannot be modified or upgraded.
- Any change in spend policies, categories, or payee bindings requires opening a new account.

## 7. Fictional Vendors and Test Fixtures
- All fixtures in this repository and the companion fixtures repository (`agent-allowance-fixtures`) use clearly fictional vendor entities (`cloudco.example`, `datashop.example`, `adsy.example`).
- No references to real commercial entities or living individuals are used.
