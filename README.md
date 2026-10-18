# Agent Allowance

> Intelligent spending account for autonomous AI agents with validator-verified invoice evidence on GenLayer Studionet (Status: Preview).

MIT License Copyright (c) 2026 Hyper (huzyow155).

## Problem
Autonomous AI agents that can pay require deterministic budgetary limits. However, limits alone cannot prevent:
1. An agent paying an incorrect or inflated amount compared to the vendor's actual invoice.
2. An agent paying a vendor based on a completely different payee's invoice.
3. An agent being persuaded to issue payments via prompt injection embedded within an invoice page.

## Mechanism
Agent Allowance is an intelligent contract (`AllowanceVault`) paired with a merchant-side verification gate (`SpendGate`).
1. **Account Creation**: An account owner creates an account, funds it with internal demo credits, authorizes agent addresses, and configures an immutable policy (per-spend cap, total budget, max spend count, currency, allowed categories, and payee address-to-URL prefix bindings).
2. **Spend Request**: An authorized agent submits a spend request (`account_id`, `payee`, `amount`, `category`, `evidence_url`).
3. **Deterministic Pre-Gates**: Contract checks payee registration, URL prefix binding (`evidence_bound`), category allowance, per-spend cap, total budget, spend count, and currency compatibility *before* fetching any external page.
4. **Independent Fetch & Verification**: GenLayer validators fetch the evidence page, inspect for injection tripwires, invoke the LLM to extract the itemized category, amount, currency, and exact quote, and then run strict deterministic code to verify the quote is verbatim in the document and the amount matches.
5. **Consensus**: Validators agree on a compact consensus token: `<DECISION>|<amount>|<category>|<norm_hash16>`.
6. **Execution**: If `APPROVE`, internal credits are transferred from the account balance to the payee's ledger balance in the same transaction. If unclear or unparseable, the spend enters `PENDING` (`ASK_OWNER`), allowing the human owner to manually approve or reject.
7. **SpendGate**: Downstream merchants verify spend parameters (`spend_id`, `account_id`, `payee`, `amount`, `policy_hash`) via synchronous view calls into `AllowanceVault` before serving service orders.

## Why GenLayer
Traditional smart contracts (e.g. EVM) cannot fetch external web pages or parse unstructured documents. Centralized oracles introduce single points of failure and trust assumptions. GenLayer enables validators to execute web reads and natural language extraction natively under consensus.

## Non-Goals & Limitations
- **Credits Only**: Internal ledger credits only. No real fiat, cryptocurrency, or locked ERC-20 tokens are involved. Not a payment service or financial advice.
- **Owner-Chosen Payees**: The owner specifies allowed payees and their URL prefixes. The contract verifies prefix binding and invoice content, not external vendor legitimacy.
- **Public Static Evidence**: Invoices must be public, static text or HTML pages. JavaScript-heavy or login-protected pages will fail loudly or yield `ASK_OWNER`.
- **No Temporal Clock**: Limits are per-spend, total budget, and total spend count. No calendar-based daily/monthly limits.
- **Fictional Vendors**: All test fixtures use fictional domains (`cloudco.example`, `datashop.example`, `adsy.example`).

## Deployed Addresses (GenLayer Studionet - Chain 61999)
- **AllowanceVault**: `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`
  - Explorer: [https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07](https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07)
  - Deploy Transaction: `0x53965fc7c6a0c0bbfec2f0eb3a76395dcfae6eeb246f4439c2794eb827051ae3`
- **SpendGate**: `0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528`
  - Explorer: [https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528](https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528)
  - Deploy Transaction: `0x3ab3717dfb119cb45a4773ebfc48d9aa1787c9339e1f5c66b8d276b89ae6e10f`

## Step-by-Step Deploy to Studionet
```bash
# 1. Install dependencies
npm install

# 2. Run comprehensive tests and sanity checks
npm run check

# 3. Deploy contracts and execute on-chain evidence
node scripts/deploy/deploy_and_run_evidence.js

# 4. Extract verified facts report
node scripts/report_facts.js
```

## Testing & Quality Assurance
```bash
# Run multi-layer test suite (Pure functions, star tests, oracle fuzz, mocked contracts, consensus)
python -m unittest discover tests

# Run hygiene and scanner checks
npm run scan:ascii
npm run scan:banned
npm run scan:secrets
npm run parity
```
