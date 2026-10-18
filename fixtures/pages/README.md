# Agent Allowance Test Fixtures Repository

This repository contains static invoice fixtures for testing and validating the **Agent Allowance** GenLayer intelligent contract (`AllowanceVault` and `SpendGate`).

## Policy Configuration
All test cases use the following standardized account policy:
- `per_spend_cap`: 200 USD
- `total_budget`: 500 USD
- `max_spends`: 6
- `currency`: USD
- `allowed_categories`: `CLOUD`, `DATA`, `SOFTWARE`
- Registered Payees:
  - `CloudCo`: bound to `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/<COMMIT>/cloudco/`
  - `DataShop`: bound to `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/<COMMIT>/datashop/`
  - `AdSy`: NOT registered (deliberately omitted)

## Fixtures Directory
- `cloudco/inv-a-120.md`: Standard cloud hosting invoice, Total 120 USD.
- `cloudco/inv-a-120.html`: Same invoice as above in HTML format, Total 120 USD.
- `cloudco/inv-b-450.md`: Cloud infrastructure invoice over cap, Total 450 USD.
- `cloudco/inv-c-no-total.md`: Proforma notice with no stated total amount.
- `cloudco/inv-d-injection.md`: Invoice containing prompt injection text, Total 150 USD.
- `cloudco/inv-h-marketing.md`: CloudCo invoice for advertising/marketing, Total 60 USD.
- `cloudco/inv-short.md`: Under 100 characters invoice (for size error check).
- `datashop/inv-e-90.md`: Financial dataset subscription, Total 90 USD.
- `datashop/inv-f-eur.md`: European dataset subscription, Total 90 EUR.
- `adsy/inv-g-80.md`: Marketing campaign from unregistered vendor, Total 80 USD.

## License
MIT License
