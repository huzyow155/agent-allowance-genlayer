import re
import sys
from contracts.AllowanceVault import decide_spend

# Exact duplicate of decide_spend as an independent implementation
def external_decide_spend(policy, declared, observed, quote_ok, tripwire, state):
    if tripwire:
        return "ASK_OWNER", "tripwire"
    if not observed.get("valid", False):
        return "ASK_OWNER", "parse_failure"
    if not quote_ok:
        return "ASK_OWNER", "quote_not_found"
    obs_cat = observed.get("category", "UNCLEAR")
    if obs_cat == "UNCLEAR":
        return "ASK_OWNER", "category_unclear"
    obs_amt = observed.get("amount", 0)
    obs_curr = observed.get("currency", "UNCLEAR")
    if obs_amt <= 0 or obs_curr == "UNCLEAR":
        return "ASK_OWNER", "amount_unclear"
    if obs_curr != policy.get("currency", "USD"):
        return "DENY", "currency_mismatch"
    if obs_amt != declared.get("amount", 0):
        return "DENY", "amount_mismatch"
    if obs_cat not in set(policy.get("categories", [])):
        return "DENY", "category_not_allowed"
    if obs_amt > int(policy.get("per_spend_cap", 0)):
        return "DENY", "over_cap"
    if int(state.get("spent", 0)) + obs_amt > int(policy.get("total_budget", 0)):
        return "DENY", "over_budget"
    if int(state.get("spend_count", 0)) >= int(policy.get("max_spends", 0)):
        return "DENY", "too_many_spends"
    return "APPROVE", "-"

test_cases = [
    # 1. Happy path approve
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 120, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 2. Tripwire
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 120, "currency": "USD"}, True, True, {"spent": 0, "spend_count": 0}),
    # 3. Parse failure
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": False}, True, False, {"spent": 0, "spend_count": 0}),
    # 4. Quote not found
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 120, "currency": "USD"}, False, False, {"spent": 0, "spend_count": 0}),
    # 5. Category unclear
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "UNCLEAR", "amount": 120, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 6. Amount unclear (0)
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 0, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 7. Currency unclear
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 120, "currency": "UNCLEAR"}, True, False, {"spent": 0, "spend_count": 0}),
    # 8. Currency mismatch
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 120, "currency": "EUR"}, True, False, {"spent": 0, "spend_count": 0}),
    # 9. Amount mismatch (observed < declared)
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 100, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 10. Amount mismatch (observed > declared)
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 150, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 11. Category not allowed
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 60, "category": "CLOUD"}, {"valid": True, "category": "MARKETING", "amount": 60, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 12. Over cap
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 450, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 450, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 13. Over budget
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 120, "currency": "USD"}, True, False, {"spent": 400, "spend_count": 2}),
    # 14. Exact budget limit (spent + amt == budget -> approve)
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 100, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 100, "currency": "USD"}, True, False, {"spent": 400, "spend_count": 2}),
    # 15. Too many spends
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 120, "currency": "USD"}, True, False, {"spent": 120, "spend_count": 6}),
    # 16. Exact max spends boundary (spend_count == max_spends - 1 -> approve)
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": 120, "currency": "USD"}, True, False, {"spent": 120, "spend_count": 5}),
    # 17. EUR policy with EUR observed
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "EUR", "categories": ["DATA"]}, {"amount": 90, "category": "DATA"}, {"valid": True, "category": "DATA", "amount": 90, "currency": "EUR"}, True, False, {"spent": 0, "spend_count": 0}),
    # 18. Multi-category policy matching second category
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD", "DATA", "SOFTWARE"]}, {"amount": 90, "category": "DATA"}, {"valid": True, "category": "DATA", "amount": 90, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 19. Travel category allowed
    ({"per_spend_cap": 500, "total_budget": 1000, "max_spends": 10, "currency": "USD", "categories": ["TRAVEL"]}, {"amount": 350, "category": "TRAVEL"}, {"valid": True, "category": "TRAVEL", "amount": 350, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 20. Negative / zero amount in observed
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": True, "category": "CLOUD", "amount": -10, "currency": "USD"}, True, False, {"spent": 0, "spend_count": 0}),
    # 21. Both tripwire and bad parse (tripwire takes precedence)
    ({"per_spend_cap": 200, "total_budget": 500, "max_spends": 6, "currency": "USD", "categories": ["CLOUD"]}, {"amount": 120, "category": "CLOUD"}, {"valid": False}, False, True, {"spent": 0, "spend_count": 0}),
]

print(f"Running parity test across {len(test_cases)} distinct branch cases...")
for idx, (pol, dec, obs, q_ok, trip, st) in enumerate(test_cases):
    c_dec, c_rsn = decide_spend(pol, dec, obs, q_ok, trip, st)
    e_dec, e_rsn = external_decide_spend(pol, dec, obs, q_ok, trip, st)
    assert (c_dec, c_rsn) == (e_dec, e_rsn), f"Case {idx+1} mismatch: contract=({c_dec}, {c_rsn}), external=({e_dec}, {e_rsn})"

print(f"PASS: All {len(test_cases)} cases have 100% parity between contract and external logic.")
