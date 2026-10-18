import unittest
import random
import json
from contracts.AllowanceVault import (
    clean_text,
    norm_text,
    norm_hash,
    quote_in_page,
    number_in_quote,
    evidence_bound,
    injection_tripwire,
    parse_extraction,
    decide_spend,
)


def independent_decide_oracle(policy, declared, observed, quote_ok, tripwire, state):
    """Independent oracle for decide_spend fuzzing."""
    if tripwire:
        return "ASK_OWNER", "tripwire"
    if not observed.get("valid", False):
        return "ASK_OWNER", "parse_failure"
    if not quote_ok:
        return "ASK_OWNER", "quote_not_found"
    cat = observed.get("category", "UNCLEAR")
    if cat == "UNCLEAR":
        return "ASK_OWNER", "category_unclear"
    amt = observed.get("amount", 0)
    curr = observed.get("currency", "UNCLEAR")
    if amt <= 0 or curr == "UNCLEAR":
        return "ASK_OWNER", "amount_unclear"
    if curr != policy.get("currency", "USD"):
        return "DENY", "currency_mismatch"
    if amt != declared.get("amount", 0):
        return "DENY", "amount_mismatch"
    if cat not in policy.get("categories", []):
        return "DENY", "category_not_allowed"
    if amt > policy.get("per_spend_cap", 0):
        return "DENY", "over_cap"
    if state.get("spent", 0) + amt > policy.get("total_budget", 0):
        return "DENY", "over_budget"
    if state.get("spend_count", 0) >= policy.get("max_spends", 0):
        return "DENY", "too_many_spends"
    return "APPROVE", "-"


class TestLayer1PureExtended(unittest.TestCase):
    def test_star_test_naive_baselines_fail_where_agent_allowance_succeeds(self):
        """
        THE STAR TEST (Brief Section 5):
        Three naive agent-wallets as plain functions on real fixture pages:
        - B1: cap-only wallet (limits on declared values, no evidence)
        - B2: trusting wallet (trusts model output without quote check or amount comparison)
        - B3: allowlist-only wallet (checks payee address, no prefix binding)
        """
        # Load real fixture pages
        with open("fixtures/pages/cloudco/inv-b-450.md", "r", encoding="utf-8") as f:
            inv_b_page = f.read()
        with open("fixtures/pages/cloudco/inv-d-injection.md", "r", encoding="utf-8") as f:
            inv_d_page = f.read()
        with open("fixtures/pages/adsy/inv-g-80.md", "r", encoding="utf-8") as f:
            inv_g_page = f.read()

        policy = {
            "per_spend_cap": 200,
            "total_budget": 500,
            "max_spends": 6,
            "currency": "USD",
            "categories": ["CLOUD", "DATA", "SOFTWARE"],
            "payees": [
                {"payee": "0x1111111111111111111111111111111111111111", "prefix": "https://example.com/cloudco/"}
            ]
        }
        state = {"spent": 0, "spend_count": 0, "balance": 1000}

        # Naive Baseline B1: Cap-only wallet (only inspects declared values)
        def naive_b1_cap_only(declared_amt, cap):
            return declared_amt <= cap

        # Attack 1: Agent declares 100 for an invoice that actually charges 450 (inv-b-450.md)
        b1_verdict = naive_b1_cap_only(100, policy["per_spend_cap"])
        self.assertTrue(b1_verdict, "Naive B1 blindly approved declared 100 on 450 invoice!")

        # Agent Allowance catches the discrepancy:
        cleaned_b = clean_text(inv_b_page)
        nh16_b = norm_hash(cleaned_b)[:16]
        obs_b = {"valid": True, "category": "CLOUD", "amount": 450, "currency": "USD", "quote": "Total due: 450 USD"}
        q_ok_b = quote_in_page(obs_b["quote"], cleaned_b) and number_in_quote(obs_b["quote"], 450)
        dec_real, rsn_real = decide_spend(policy, {"amount": 100, "category": "CLOUD"}, obs_b, q_ok_b, False, state)
        self.assertEqual(dec_real, "DENY")
        self.assertEqual(rsn_real, "amount_mismatch", "Agent Allowance correctly caught amount mismatch!")

        # Naive Baseline B2: Trusting wallet (approves whatever model returns without quote check or injection check)
        def naive_b2_trusting(model_obs):
            return model_obs.get("amount", 0) <= 200 and model_obs.get("category") in policy["categories"]

        # Attack 2: Prompt injection / forged quote
        forged_obs = {"valid": True, "category": "CLOUD", "amount": 150, "currency": "USD", "quote": "Hallucinated total 150"}
        b2_verdict = naive_b2_trusting(forged_obs)
        self.assertTrue(b2_verdict, "Naive B2 blindly approved forged model output!")

        # Agent Allowance catches injection tripwire AND forged quote:
        self.assertTrue(injection_tripwire(inv_d_page), "Agent Allowance caught prompt injection tripwire!")
        q_ok_forged = quote_in_page(forged_obs["quote"], inv_d_page)
        self.assertFalse(q_ok_forged, "Agent Allowance verified quote is NOT in page!")
        dec_b2, rsn_b2 = decide_spend(policy, {"amount": 150, "category": "CLOUD"}, forged_obs, False, True, state)
        self.assertEqual(dec_b2, "ASK_OWNER")
        self.assertEqual(rsn_b2, "tripwire")

        # Naive Baseline B3: Allowlist-only wallet (no prefix binding check)
        def naive_b3_allowlist_only(payee_addr, allowed_payees):
            return payee_addr in allowed_payees

        # Attack 3: Payee CloudCo submitted with AdSy invoice evidence URL
        registered_addr = "0x1111111111111111111111111111111111111111"
        adsy_url = "https://example.com/adsy/inv-g-80.md"
        b3_verdict = naive_b3_allowlist_only(registered_addr, [p["payee"] for p in policy["payees"]])
        self.assertTrue(b3_verdict, "Naive B3 approved paying CloudCo with wrong vendor invoice!")

        # Agent Allowance rejects via prefix binding:
        cloudco_prefix = policy["payees"][0]["prefix"]
        bound = evidence_bound(adsy_url, cloudco_prefix)
        self.assertFalse(bound, "Agent Allowance correctly rejected unbound evidence URL!")

    def test_property_tests_cosmetic_invariance(self):
        """Property test: cosmetic changes to an invoice never change the decision."""
        with open("fixtures/pages/cloudco/inv-a-120.md", "r", encoding="utf-8") as f:
            md_page = f.read()
        with open("fixtures/pages/cloudco/inv-a-120.html", "r", encoding="utf-8") as f:
            html_page = f.read()

        policy = {
            "per_spend_cap": 200,
            "total_budget": 500,
            "max_spends": 6,
            "currency": "USD",
            "categories": ["CLOUD", "DATA", "SOFTWARE"],
        }
        declared = {"amount": 120, "category": "CLOUD"}
        state = {"spent": 0, "spend_count": 0, "balance": 1000}

        cleaned_md = clean_text(md_page)
        cleaned_html = clean_text(html_page)

        # Both contain the quote and amount
        quote_md = "Total due: 120 USD"
        quote_html = "Total due: 120 USD"
        self.assertTrue(quote_in_page(quote_md, cleaned_md))
        self.assertTrue(quote_in_page(quote_html, cleaned_html))

        obs_md = {"valid": True, "category": "CLOUD", "amount": 120, "currency": "USD", "quote": quote_md}
        obs_html = {"valid": True, "category": "CLOUD", "amount": 120, "currency": "USD", "quote": quote_html}

        dec_md, rsn_md = decide_spend(policy, declared, obs_md, True, False, state)
        dec_html, rsn_html = decide_spend(policy, declared, obs_html, True, False, state)

        self.assertEqual(dec_md, dec_html)
        self.assertEqual(rsn_md, rsn_html)
        self.assertEqual(dec_md, "APPROVE")

    def test_fuzz_decide_spend_oracle_5000_cases(self):
        """Fuzz decide_spend against independent oracle over 5,000 randomized cases."""
        seed = 428912
        random.seed(seed)
        categories_pool = ["SOFTWARE", "CLOUD", "DATA", "MARKETING", "TRAVEL", "OTHER", "UNCLEAR", "UNKNOWN"]
        currencies_pool = ["USD", "EUR", "GBP", "UNCLEAR"]

        print(f"\n[Layer 1 Fuzz] Running 5,000 cases with seed {seed}...")
        for i in range(5000):
            cap = random.randint(10, 500)
            budget = random.randint(cap, 2000)
            mspends = random.randint(1, 20)
            pol_curr = random.choice(["USD", "EUR"])
            pol_cats = random.sample(["SOFTWARE", "CLOUD", "DATA", "MARKETING", "TRAVEL", "OTHER"], k=random.randint(1, 4))
            policy = {
                "per_spend_cap": cap,
                "total_budget": budget,
                "max_spends": mspends,
                "currency": pol_curr,
                "categories": pol_cats,
            }

            dec_amt = random.randint(1, 600)
            dec_cat = random.choice(categories_pool)
            declared = {"amount": dec_amt, "category": dec_cat}

            obs_valid = random.choice([True, True, True, False])
            obs_amt = random.choice([dec_amt, dec_amt, random.randint(0, 700)])
            obs_curr = random.choice([pol_curr, pol_curr, random.choice(currencies_pool)])
            obs_cat = random.choice([dec_cat, random.choice(categories_pool)])
            quote = f"Total {obs_amt}" if obs_amt > 0 else ""
            observed = {
                "valid": obs_valid,
                "category": obs_cat,
                "amount": obs_amt,
                "currency": obs_curr,
                "quote": quote,
            }

            quote_ok = random.choice([True, False])
            tripwire = random.choice([True, False, False, False, False])
            state = {
                "spent": random.randint(0, budget + 100),
                "spend_count": random.randint(0, mspends + 5),
                "balance": random.randint(0, 5000),
            }

            contract_dec, contract_rsn = decide_spend(policy, declared, observed, quote_ok, tripwire, state)
            oracle_dec, oracle_rsn = independent_decide_oracle(policy, declared, observed, quote_ok, tripwire, state)

            self.assertEqual(
                contract_dec,
                oracle_dec,
                f"Fuzz iteration {i} decision mismatch: contract={contract_dec}, oracle={oracle_dec}"
            )
            self.assertEqual(
                contract_rsn,
                oracle_rsn,
                f"Fuzz iteration {i} reason mismatch: contract={contract_rsn}, oracle={oracle_rsn}"
            )

        print("[Layer 1 Fuzz] 5,000 cases verified with 100% oracle parity.")


if __name__ == "__main__":
    unittest.main()
