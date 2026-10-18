# Prior Art Analysis

## Overview
Autonomous AI agents interacting with web services and economic systems require spending boundaries. Several existing architectures attempt to enforce restrictions on agent or automated expenditures:

1. **Safe (Gnosis Safe) Allowance Module**:
   - An on-chain smart contract module allowing designated delegate keys to withdraw up to an allowance amount of specific ERC-20 tokens within a recurring timeframe.
   - *Limitation*: Purely numerical. The contract has zero visibility into why the delegate is withdrawing funds, who the actual upstream vendor is, or whether an invoice was generated.

2. **ERC-4337 Smart Accounts with Session Keys**:
   - Ephemeral session keys authorized by user account abstraction contracts to execute transactions under strict restrictions (target contract, gas limits, function selectors, value caps).
   - *Limitation*: Can restrict target contracts, but cannot read or verify real-world invoice documents or check textual itemization.

3. **Coinbase AgentKit and x402-style Protocols**:
   - Developer frameworks equipping AI agents with crypto wallets to pay for API calls or on-chain actions.
   - *Limitation*: Relies on off-chain agent logic to decide how much to pay. If an agent hallucinates, encounters prompt injection, or reads a malicious invoice, the wallet executes the payment without independent verification.

4. **Chainlink Functions**:
   - Decentralized oracle network executing off-chain JavaScript compute to fetch API data and aggregate results back to EVM contracts.
   - *Limitation*: Useful for deterministic JSON API responses, but not built for subjective natural language invoice extraction under consensus, nor does it support native Python intelligent contracts with integrated LLM and web access.

## Closest Prior Art: Safe Allowance Module
The closest existing solution in production is the **Safe Allowance Module**, which sets granular budget allowances for specific delegate addresses.

### Comparative Difference Table

| Feature / Dimension | Safe Allowance Module | Agent Allowance (GenLayer) |
| :--- | :--- | :--- |
| **Execution Environment** | Ethereum / EVM (Solidity) | GenLayer GenVM (Python Intelligent Contract) |
| **Evidence Verification** | None (funds pulled based on balance & cap alone) | **Public web page invoice read natively by validators** |
| **Invoice Amount Check** | None | **LLM extracts total with verbatim quote verified by code** |
| **Payee URL Binding** | None (only target EVM address) | **Payee address bound to strict HTTPS URL prefix** |
| **Prompt Injection Defense**| N/A | **Deterministic tripwire + defensive prompt framing** |
| **Ambiguity Handling** | Reverts on cap exceedance | **Escalates to `ASK_OWNER` inbox for human review** |
| **Downstream Settlement Gate**| None | **`SpendGate` parameter-bound verification for merchants** |
| **Monetary Nature** | Real tokens (ETH, ERC-20) | Internal credits ledger (Demo/Preview) |
| **Temporal Tracking** | Time-based allowance reset (e.g. daily/monthly) | Total budget and spend count counters (no wall clock) |

## Honest Trade-Offs
1. **Validator Latency**: Reading external web pages and running LLM extraction introduces a 20-30s consensus latency per judged spend, compared to sub-second EVM execution.
2. **Deterministic Pre-Gates**: To optimize gas and validator execution, Agent Allowance executes deterministic pre-gates (cap, budget, category, prefix binding) with zero LLM/web latency.
3. **Escalation vs Reversion**: Instead of failing outright on complex or ambiguous invoices, the `ASK_OWNER` workflow gives human principals oversight while maintaining autonomous execution for clear cases.
