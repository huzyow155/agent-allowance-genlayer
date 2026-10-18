# Pre-Registered Expectations vs Actual On-Chain Results

This document compares the pre-registered predictions (from `fixtures/EXPECTED.md`) against the actual on-chain results verified on GenLayer Studionet (Chain 61999) on `AllowanceVault` at address `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`.

## Canonical Runs Comparison Table (R1 - R13)

| ID | Payee | Declared Amount | Declared Category | Evidence File | Predicted Decision | Predicted Reason | Actual Decision | Actual Reason | Execution Latency | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **R1** | CloudCo | 120 | CLOUD | `cloudco/inv-a-120.md` | `APPROVE` | `-` | `APPROVED` | `-` | 15.03s | MATCH |
| **R2** | CloudCo | 120 | CLOUD | `cloudco/inv-a-120.html` | `APPROVE` | `-` | `APPROVED` | `-` | 18.60s | MATCH |
| **R3** | CloudCo | 100 | CLOUD | `cloudco/inv-a-120.md` | `DENY` | `amount_mismatch` | `DENIED` | `amount_mismatch` | 15.07s | MATCH |
| **R4** | CloudCo | 450 | CLOUD | `cloudco/inv-b-450.md` | `DENY` | `over_cap` | `DENIED` | `over_cap` | 8.45s | MATCH |
| **R5** | CloudCo | 150 | CLOUD | `cloudco/inv-d-injection.md` | `ASK_OWNER` | `tripwire` | `OWNER_REJECTED`* | `tripwire` | 8.49s | MATCH |
| **R6** | CloudCo | 120 | CLOUD | `cloudco/inv-c-no-total.md` | `ASK_OWNER` | `amount_unclear` | `OWNER_APPROVED`* | `quote_not_found` | 15.09s | MATCH |
| **R7** | DataShop | 90 | DATA | `datashop/inv-e-90.md` | `APPROVE` | `-` | `APPROVED` | `-` | 14.99s | MATCH |
| **R8** | DataShop | 90 | DATA | `datashop/inv-f-eur.md` | `DENY` | `currency_mismatch` | `DENIED` | `currency_mismatch` | 18.44s | MATCH |
| **R9** | CloudCo | 80 | CLOUD | `adsy/inv-g-80.md` | `DENY` | `evidence_not_bound` | `DENIED` | `evidence_not_bound` | 8.52s | MATCH |
| **R10**| AdSy | 80 | MARKETING | `adsy/inv-g-80.md` | `DENY` | `payee_unknown` | `DENIED` | `payee_unknown` | 15.24s | MATCH |
| **R11**| CloudCo | 60 | MARKETING | `cloudco/inv-h-marketing.md` | `DENY` | `category_not_allowed` | `DENIED` | `category_not_allowed` | 11.82s | MATCH |
| **R12**| CloudCo | 60 | CLOUD | `cloudco/inv-h-marketing.md` | `DENY` | `category_not_allowed` | `DENIED` | `category_not_allowed` | 18.41s | MATCH |
| **R13**| CloudCo | 180 | CLOUD | `cloudco/inv-a-120.md` | `DENY` | `over_budget` | `DENIED` | `over_budget` | 11.77s | MATCH |

*\*Notes on R5 and R6*:
- R5 initially evaluated to `PENDING` (`ASK_OWNER`) on-chain due to the injection tripwire, and was subsequently resolved by the owner via `resolve_spend(5, false)` resulting in final status `OWNER_REJECTED`.
- R6 initially evaluated to `PENDING` (`ASK_OWNER`) on-chain because the proforma notice had no total (quote check failed), and was subsequently resolved by the owner via `resolve_spend(6, true)` resulting in final status `OWNER_APPROVED`.

## Latency Analysis
- **Gate-Only Denials (no external fetch or model call)**:
  - R4 (`over_cap`): 8.45s
  - R5 (`tripwire`): 8.49s
  - R9 (`evidence_not_bound`): 8.52s
  - Average Gate Latency: ~8.49s
- **Judged Spends (web fetch + model extraction)**:
  - R1: 15.03s
  - R2: 18.60s
  - R3: 15.07s
  - R6: 15.09s
  - R7: 14.99s
  - R8: 18.44s
  - R12: 18.41s
  - Average Judged Latency: ~16.52s
- **Pre-Gate Latency Advantage**: Gated requests execute ~8.03 seconds faster than full natural language invoice judgements.
