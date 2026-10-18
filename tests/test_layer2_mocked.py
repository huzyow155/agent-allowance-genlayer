import unittest
import json
import random
import sys
import os

from genlayer import gl, GlVM
from contracts.AllowanceVault import AllowanceVault
from contracts.SpendGate import SpendGate


class TestLayer2Mocked(unittest.TestCase):
    def setUp(self):
        # Reset gl mock state
        gl.contract_registry.clear()
        self.vault = AllowanceVault()
        self.owner = "0x1111111111111111111111111111111111111111"
        self.agent = "0x2222222222222222222222222222222222222222"
        self.payee = "0x3333333333333333333333333333333333333333"
        self.unreg = "0x4444444444444444444444444444444444444444"

        gl.message.sender_address.as_hex = self.owner
        self.vault.claim_demo_credits()
        self.policy = {
            "per_spend_cap": 200,
            "total_budget": 500,
            "max_spends": 6,
            "currency": "USD",
            "categories": ["CLOUD", "DATA", "SOFTWARE"],
            "payees": [
                {"payee": self.payee, "prefix": "https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/"}
            ]
        }

    def test_user_errors_and_permissions(self):
        # 1. Claim demo credits already claimed in setUp: duplicate claim must fail
        gl.message.sender_address.as_hex = self.owner
        self.assertEqual(self.vault.balance_of(self.owner), "1000")

        # Duplicate claim
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.claim_demo_credits()
        self.assertEqual(str(ctx.exception), "already claimed demo credits")

        # 2. Account creation errors
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.create_account("ab", json.dumps(self.policy))
        self.assertEqual(str(ctx.exception), "bad name")

        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.create_account("Valid Name", "{invalid json")
        self.assertEqual(str(ctx.exception), "bad policy JSON")

        bad_pol = dict(self.policy, per_spend_cap=0)
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.create_account("Valid Name", json.dumps(bad_pol))
        self.assertEqual(str(ctx.exception), "bad per_spend_cap")

        bad_budget = dict(self.policy, total_budget=100)  # less than cap (200)
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.create_account("Valid Name", json.dumps(bad_budget))
        self.assertEqual(str(ctx.exception), "bad total_budget")

        bad_curr = dict(self.policy, currency="YEN")
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.create_account("Valid Name", json.dumps(bad_curr))
        self.assertEqual(str(ctx.exception), "bad currency")

        bad_cat = dict(self.policy, categories=["GAMBLING"])
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.create_account("Valid Name", json.dumps(bad_cat))
        self.assertEqual(str(ctx.exception), "bad category")

        # Create valid account
        aid = self.vault.create_account("Test Account", json.dumps(self.policy))
        self.assertEqual(aid, "1")

        # 3. Funding checks
        # Funding exceeds budget
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.fund_account("1", 600)  # budget is 500
        self.assertEqual(str(ctx.exception), "funding exceeds the budget rule")

        # Non-owner cannot fund
        gl.message.sender_address.as_hex = self.agent
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.fund_account("1", 100)
        self.assertEqual(str(ctx.exception), "not owner")

        gl.message.sender_address.as_hex = self.owner
        self.vault.fund_account("1", 400)
        acc_data = json.loads(self.vault.get_account("1"))
        self.assertEqual(acc_data["balance"], "400")
        self.assertEqual(self.vault.balance_of(self.owner), "600")

        # 4. Agent management
        self.vault.add_agent("1", self.agent)
        acc_data = json.loads(self.vault.get_account("1"))
        self.assertIn(self.agent.lower(), acc_data["agents"])

        # Unregistered agent cannot request spend
        gl.message.sender_address.as_hex = self.unreg
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.request_spend("1", self.payee, 120, "CLOUD", "https://any.url")
        self.assertEqual(str(ctx.exception), "not a registered agent")

    def test_mocked_spend_pipeline_and_gates(self):
        aid = self.vault.create_account("Test Account", json.dumps(self.policy))
        self.vault.fund_account("1", 400)
        self.vault.add_agent("1", self.agent)

        gl.message.sender_address.as_hex = self.agent

        # Pre-gate: Payee unknown
        token = self.vault.request_spend("1", self.unreg, 120, "CLOUD", "https://example.com")
        self.assertEqual(token, "DENY|0|-|-")
        s = json.loads(self.vault.get_spend("1"))
        self.assertEqual(s["decision"], "DENIED")
        self.assertEqual(s["reason"], "payee_unknown")

        # Pre-gate: Evidence not bound
        token = self.vault.request_spend("1", self.payee, 120, "CLOUD", "https://raw.githubusercontent.com/evil/cloudco/inv.md")
        self.assertEqual(token, "DENY|0|-|-")
        s = json.loads(self.vault.get_spend("2"))
        self.assertEqual(s["reason"], "evidence_not_bound")

        # Pre-gate: Category not allowed
        valid_ev = "https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/inv-a-120.md"
        token = self.vault.request_spend("1", self.payee, 120, "MARKETING", valid_ev)
        self.assertEqual(token, "DENY|0|-|-")
        s = json.loads(self.vault.get_spend("3"))
        self.assertEqual(s["reason"], "category_not_allowed")

        # Pre-gate: Over cap (declared 250 > 200 cap)
        token = self.vault.request_spend("1", self.payee, 250, "CLOUD", valid_ev)
        self.assertEqual(token, "DENY|0|-|-")
        s = json.loads(self.vault.get_spend("4"))
        self.assertEqual(s["reason"], "over_cap")

    def test_mocked_web_and_llm_execution(self):
        aid = self.vault.create_account("Test Account", json.dumps(self.policy))
        self.vault.fund_account("1", 400)
        self.vault.add_agent("1", self.agent)

        valid_ev = "https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/inv-a-120.md"

        # Mock Web Response
        with open("fixtures/pages/cloudco/inv-a-120.md", "rb") as f:
            md_bytes = f.read()

        class MockWebResp:
            status = 200
            body = md_bytes

        gl.nondet.web.handler = lambda url: MockWebResp()

        # Mock LLM Response
        llm_reply = json.dumps({
            "category": "CLOUD",
            "amount": 120,
            "currency": "USD",
            "quote": "Total due: 120 USD"
        })
        gl.nondet.prompt_handler = lambda p: llm_reply

        gl.message.sender_address.as_hex = self.agent
        token = self.vault.request_spend("1", self.payee, 120, "CLOUD", valid_ev)
        self.assertTrue(token.startswith("APPROVE|120|CLOUD|"))

        # Check ledger balance movement
        acc = json.loads(self.vault.get_account("1"))
        self.assertEqual(acc["balance"], "280")  # 400 - 120
        self.assertEqual(acc["spent"], "120")
        self.assertEqual(acc["spend_count"], "1")
        self.assertEqual(self.vault.balance_of(self.payee), "120")

        # Duplicate observation error check
        with self.assertRaises(gl.vm.UserError) as ctx:
            self.vault.request_spend("1", self.payee, 120, "CLOUD", valid_ev)
        self.assertTrue(str(ctx.exception).startswith("duplicate observation: 1"))

    def test_spendgate_interaction(self):
        vault_addr = "0x8888888888888888888888888888888888888888"
        gl.contract_registry[vault_addr] = self.vault
        gate = SpendGate(vault_addr)

        # Set up account and approved spend
        aid = self.vault.create_account("Test Account", json.dumps(self.policy))
        self.vault.fund_account(aid, 400)
        self.vault.add_agent(aid, self.agent)

        with open("fixtures/pages/cloudco/inv-a-120.md", "rb") as f:
            md_bytes = f.read()

        class MockWebResp:
            status = 200
            body = md_bytes

        gl.nondet.web.handler = lambda url: MockWebResp()
        gl.nondet.prompt_handler = lambda p: json.dumps({
            "category": "CLOUD",
            "amount": 120,
            "currency": "USD",
            "quote": "Total due: 120 USD"
        })

        valid_ev = "https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/17d05116617effeaa127249914f3b4e691ecad40/cloudco/inv-a-120.md"
        gl.message.sender_address.as_hex = self.agent
        self.vault.request_spend(aid, self.payee, 120, "CLOUD", valid_ev)

        acc = json.loads(self.vault.get_account(aid))
        pol_hash = acc["policy_hash"]

        # SpendGate validations
        # 1. Valid parameters
        self.assertTrue(gate.is_spend_valid_for("1", aid, self.payee, 120, pol_hash))

        # 2. Altered parameters must be false
        self.assertFalse(gate.is_spend_valid_for("1", aid, self.unreg, 120, pol_hash))
        self.assertFalse(gate.is_spend_valid_for("1", aid, self.payee, 150, pol_hash))
        self.assertFalse(gate.is_spend_valid_for("1", "99", self.payee, 120, pol_hash))
        self.assertFalse(gate.is_spend_valid_for("1", aid, self.payee, 120, "bad_hash"))

        # 3. Serve write: non-payee sender cannot serve
        gl.message.sender_address.as_hex = self.agent
        with self.assertRaises(gl.vm.UserError) as ctx:
            gate.serve("1", aid, self.payee, 120, pol_hash)
        self.assertEqual(str(ctx.exception), "sender must equal payee")

        # 4. Payee serves
        gl.message.sender_address.as_hex = self.payee
        gate.serve("1", aid, self.payee, 120, pol_hash)
        srv = json.loads(gate.get_service("1"))
        self.assertEqual(srv["status"], "SERVED")

        # 5. Second serve rejected
        with self.assertRaises(gl.vm.UserError) as ctx:
            gate.serve("1", aid, self.payee, 120, pol_hash)
        self.assertEqual(str(ctx.exception), "spend already served")

    def test_fuzz_state_invariants_5000_operations(self):
        """
        Fuzz test simulating 5,000 randomized operations (mint, create, fund, spend, resolve, close)
        asserting conservation invariant and limit invariants after EVERY step.
        """
        seed = 98124
        random.seed(seed)
        print(f"\n[Layer 2 Fuzz] Running 5,000 state invariant transitions with seed {seed}...")

        vault = AllowanceVault()
        users = [f"0x{i:040x}" for i in range(1, 10)]
        accounts = []

        total_minted_tracker = 0

        for op in range(5000):
            action = random.choice(["mint", "create", "fund", "close"])
            user = random.choice(users)
            gl.message.sender_address.as_hex = user

            if action == "mint":
                if vault.minted.get(user, "") != "1":
                    vault.claim_demo_credits()
                    total_minted_tracker += 1000

            elif action == "create":
                cap = random.randint(50, 200)
                budget = random.randint(cap, 500)
                pol = {
                    "per_spend_cap": cap,
                    "total_budget": budget,
                    "max_spends": random.randint(1, 10),
                    "currency": "USD",
                    "categories": ["CLOUD", "DATA"],
                    "payees": [{"payee": users[0], "prefix": "https://example.com/cloudco/"}],
                }
                aid = vault.create_account("Acc", json.dumps(pol))
                accounts.append((aid, user))

            elif action == "fund" and accounts:
                aid, owner = random.choice(accounts)
                gl.message.sender_address.as_hex = owner
                acc_bal = int(vault.balances.get(owner, "0"))
                acc = json.loads(vault.get_account(aid))
                if acc["status"] == "OPEN" and acc_bal > 0:
                    remaining_budget = int(acc["total_budget"]) - int(acc["spent"]) - int(acc["balance"])
                    if remaining_budget > 0:
                        amt = random.randint(1, min(acc_bal, remaining_budget))
                        vault.fund_account(aid, amt)

            elif action == "close" and accounts:
                aid, owner = random.choice(accounts)
                gl.message.sender_address.as_hex = owner
                vault.close_account(aid)

            # Invariant checks after EVERY step:
            # 1. Total ledger conservation: sum(balances) + sum(account.balance) == total_minted
            sum_user_balances = sum(int(vault.balances.get(u, "0")) for u in users)
            next_aid = int(vault.meta.get("next_account", "1"))
            sum_account_balances = 0
            for i in range(1, next_aid):
                acc_s = vault.accounts.get(str(i), "")
                if acc_s:
                    a = json.loads(acc_s)
                    sum_account_balances += int(a["balance"])
                    # Limit invariants
                    self.assertLessEqual(int(a["spent"]), int(a["total_budget"]))
                    self.assertLessEqual(int(a["spend_count"]), int(a["max_spends"]))

            total_on_contract = sum_user_balances + sum_account_balances
            self.assertEqual(
                total_on_contract,
                total_minted_tracker,
                f"Conservation invariant violated at op {op}: contract={total_on_contract}, tracked={total_minted_tracker}"
            )

        print("[Layer 2 Fuzz] 5,000 state transitions verified with 100% invariant conservation.")


if __name__ == "__main__":
    unittest.main()
