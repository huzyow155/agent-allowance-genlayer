# Canonical Error Codes Reference

This document catalogs every distinct `gl.vm.UserError` message thrown by `AllowanceVault` and `SpendGate`.

| Scope | Error Message | Trigger Condition |
|:---|:---|:---|
| **Demo Credits** | `already claimed demo credits` | Address attempts calling `claim_demo_credits()` a second time. |
| **Account Creation** | `bad name` | Account name length not in 3-60 or contains non-ASCII characters. |
| **Account Creation** | `bad policy JSON` | Malformed JSON or missing required policy fields. |
| **Account Creation** | `bad per_spend_cap` | Cap is not an integer or outside 1..1,000,000. |
| **Account Creation** | `bad total_budget` | Budget is less than cap or exceeds 10,000,000. |
| **Account Creation** | `bad max_spends` | Max spends not an integer or outside 1..50. |
| **Account Creation** | `bad currency` | Currency not `USD` or `EUR`. |
| **Account Creation** | `bad categories` | Categories list is empty or has > 6 entries. |
| **Account Creation** | `bad category` | Category item not in allowed enum (`SOFTWARE`, `CLOUD`, `DATA`, `MARKETING`, `TRAVEL`, `OTHER`). |
| **Account Creation** | `bad payees` | Payees list empty, > 5 items, or malformed payee address. |
| **Prefix Validation** | `bad prefix: length` | Prefix string exceeds 300 characters. |
| **Prefix Validation** | `bad prefix: trailing slash` | Prefix does not end with a trailing `/`. |
| **Prefix Validation** | `bad prefix: scheme` | Prefix scheme is not `https`. |
| **Prefix Validation** | `bad prefix: userinfo` | Prefix contains userinfo credentials (`user:pass@`). |
| **Prefix Validation** | `bad prefix: host` | Prefix hostname is missing or empty. |
| **Prefix Validation** | `bad prefix: port` | Prefix port is not 443 or default. |
| **Prefix Validation** | `bad prefix: query` | Prefix URL contains query parameters (`?`). |
| **Prefix Validation** | `bad prefix: fragment` | Prefix URL contains a hash fragment (`#`). |
| **Permissions** | `not owner` | Non-owner calls `fund_account`, `add_agent`, `remove_agent`, `close_account`, `resolve_spend`. |
| **Permissions** | `not a registered agent` | Caller of `request_spend` is not in the account's registered agent list. |
| **Account State** | `unknown account` | Account ID does not exist in `accounts` map. |
| **Account State** | `account closed` | Attempting to fund, add agent, or spend from a `CLOSED` account. |
| **Funding** | `funding exceeds the budget rule` | `current_balance + fund_amount > total_budget - spent`. |
| **Funding** | `insufficient balance` | Owner does not possess enough demo credits in ledger. |
| **Spend Execution** | `unknown spend` | Spend ID does not exist in `spends` map. |
| **Spend Execution** | `spend not pending` | Calling `resolve_spend` on a spend whose decision is not `PENDING`. |
| **Spend Execution** | `limits no longer hold on resolve` | Limits breached when owner attempts approving a pending spend. |
| **Spend Execution** | `duplicate observation: <id>` | Exact same spend observation hash already submitted. |
| **Web Fetch** | `evidence source unreachable` | Network fetch throws an exception. |
| **Web Fetch** | `HTTP status not 200: <status>` | Server returns HTTP status other than 200 (e.g. 404). |
| **Web Fetch** | `page too large` | Document body exceeds 400,000 bytes. |
| **Web Fetch** | `page unreadable (too little text; it may need JavaScript)` | Cleaned document text is under 100 characters. |
| **SpendGate** | `sender must equal payee` | SpendGate caller address does not match payee address in spend receipt. |
| **SpendGate** | `spend already served` | Attempting to call `serve()` for a previously served spend ID. |
| **SpendGate** | `spend not valid for these parameters` | Parameter binding check fails in `is_spend_valid_for`. |
