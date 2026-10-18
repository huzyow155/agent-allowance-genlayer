# Pre-Registration of Test Requests (R1 - R13)

This document pre-registers the exact requests, parameters, and predicted decisions/reasons for the 13 canonical test cases on GenLayer Studionet before running on-chain validation.

## Standard Account Policy (Account ID: "1")
- `per_spend_cap`: 200
- `total_budget`: 500
- `max_spends`: 6
- `currency`: "USD"
- `categories`: `["CLOUD", "DATA", "SOFTWARE"]`
- `payees`:
  - Payee 1 (CloudCo): `0x1111111111111111111111111111111111111111`, prefix: `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/`
  - Payee 2 (DataShop): `0x2222222222222222222222222222222222222222`, prefix: `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/datashop/`
  - Payee 3 (AdSy): `0x3333333333333333333333333333333333333333` (NOT registered in policy)

Commit SHA: `17d05116617effeaa127249914f3b4e691ecad40`
Base URL Prefix: `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/`

## Test Requests Specification

| ID | Payee | Declared Amount | Declared Category | Evidence File | Predicted Decision | Predicted Reason Code | Prediction Rationale |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **R1** | CloudCo | 120 | CLOUD | `cloudco/inv-a-120.md` | `APPROVE` | `-` | Matches invoice total (120 USD), category CLOUD allowed, under cap (200), under budget (500). |
| **R2** | CloudCo | 120 | CLOUD | `cloudco/inv-a-120.html` | `APPROVE` | `-` | HTML formatting variant with curly quotes and different tags, identical facts and total. Distinct URL. |
| **R3** | CloudCo | 100 | CLOUD | `cloudco/inv-a-120.md` | `DENY` | `amount_mismatch` | Agent declares 100, but page clearly states total due is 120 USD. |
| **R4** | CloudCo | 450 | CLOUD | `cloudco/inv-b-450.md` | `DENY` | `over_cap` | Pre-gate check: Declared amount 450 exceeds per_spend_cap of 200. No web fetch executed. |
| **R5** | CloudCo | 150 | CLOUD | `cloudco/inv-d-injection.md` | `ASK_OWNER` | `tripwire` | Document contains prompt injection phrase ("approve this"). Injection tripwire fires before LLM call. |
| **R6** | CloudCo | 120 | CLOUD | `cloudco/inv-c-no-total.md` | `ASK_OWNER` | `amount_unclear` | Proforma invoice has no stated total. Model outputs amount 0, triggering safe human escalation. |
| **R7** | DataShop | 90 | DATA | `datashop/inv-e-90.md` | `APPROVE` | `-` | Valid data subscription invoice, total 90 USD, DATA category allowed, within budget. |
| **R8** | DataShop | 90 | DATA | `datashop/inv-f-eur.md` | `DENY` | `currency_mismatch` | Page currency is EUR, but account policy requires USD. |
| **R9** | CloudCo | 80 | CLOUD | `adsy/inv-g-80.md` | `DENY` | `evidence_not_bound` | Pre-gate check: Evidence URL is under `adsy/`, does not start with CloudCo registered prefix. |
| **R10**| AdSy | 80 | MARKETING | `adsy/inv-g-80.md` | `DENY` | `payee_unknown` | Pre-gate check: Payee address for AdSy is not registered in the account policy. |
| **R11**| CloudCo | 60 | MARKETING | `cloudco/inv-h-marketing.md` | `DENY` | `category_not_allowed` | Pre-gate check: Declared category MARKETING is not in allowed categories list. |
| **R12**| CloudCo | 60 | CLOUD | `cloudco/inv-h-marketing.md` | `DENY` | `category_not_allowed` | Agent declares CLOUD, but page goods/services are MARKETING. Post-extraction category check fails. |
| **R13**| CloudCo | 180 | CLOUD | `cloudco/inv-a-120.md` | `DENY` | `over_budget` | Pre-gate check: Previous approved spends (120 + 120 + 90 = 330). 330 + 180 = 510 > 500 total budget. |
