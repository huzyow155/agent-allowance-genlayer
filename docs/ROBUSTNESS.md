# Robustness Testing Plan and Pre-Registration

This document pre-registers the empirical robustness evaluation protocol for the Agent Allowance LLM invoice extraction prompt before execution on GenLayer Studionet.

## Protocol and Constraints
- **Target Contract**: `contracts/ProbeExtract.py` (a lightweight intelligent contract executing the model extraction and deterministic parser without state storage).
- **Test Invoices Evaluated**:
  1. `cloudco/inv-a-120.md` (Expected: Category CLOUD, Amount 120, Currency USD)
  2. `cloudco/inv-a-120.html` (Expected: Category CLOUD, Amount 120, Currency USD)
  3. `datashop/inv-e-90.md` (Expected: Category DATA, Amount 90, Currency USD)
  4. `datashop/inv-f-eur.md` (Expected: Category DATA, Amount 90, Currency EUR)
  5. `cloudco/inv-c-no-total.md` (Expected: Amount 0 / Unclear, Currency USD/UNCLEAR)
  6. `cloudco/inv-h-marketing.md` (Expected: Category MARKETING, Amount 60, Currency USD)
- **Runs Per Target**: Exactly 10 repeated on-chain calls per document (60 runs total).
- **Prompt Text Sha256**: Pre-registered in this document and verified against contract source before runs.

## Pass Criteria (Pre-Registered Rule)
1. **Parser Success Rate**: 10 out of 10 runs (100%) must parse strictly according to `parse_extraction` without syntax errors, duplicate keys, or malformed JSON.
2. **Extraction Accuracy**: At least 9 out of 10 runs (>= 90%) must yield the expected canonical extraction:
   - `inv-a-120.md`: amount = 120, currency = "USD", category = "CLOUD"
   - `inv-a-120.html`: amount = 120, currency = "USD", category = "CLOUD"
   - `inv-e-90.md`: amount = 90, currency = "USD", category = "DATA"
   - `inv-f-eur.md`: amount = 90, currency = "EUR", category = "DATA"
   - `inv-c-no-total.md`: amount = 0, quote_ok or amount_unclear
   - `inv-h-marketing.md`: amount = 60, category = "MARKETING"

## Iteration Rules
- Maximum of 2 prompt iterations permitted.
- If an iteration is required, the precise failure reason must be logged, a new rule file committed, and all affected documents re-evaluated across a fresh 10-run batch.
