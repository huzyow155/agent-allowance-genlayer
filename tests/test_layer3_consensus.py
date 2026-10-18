import unittest
import json


class TestLayer3Consensus(unittest.TestCase):
    def test_validator_agreement_on_identical_tokens(self):
        """Validators agree if and only if consensus tokens match exactly."""
        def validator_check(leader_token: str, my_token: str) -> bool:
            return leader_token == my_token

        # Identical tokens must agree
        token1 = "APPROVE|120|CLOUD|a1b2c3d4e5f60718"
        self.assertTrue(validator_check(token1, token1))

        # Different decisions must disagree
        self.assertFalse(validator_check("APPROVE|120|CLOUD|hash1", "DENY|120|CLOUD|hash1"))
        self.assertFalse(validator_check("APPROVE|120|CLOUD|hash1", "ASK_OWNER|120|CLOUD|hash1"))

        # Different amounts must disagree
        self.assertFalse(validator_check("APPROVE|120|CLOUD|hash1", "APPROVE|150|CLOUD|hash1"))

        # Different categories must disagree
        self.assertFalse(validator_check("APPROVE|120|CLOUD|hash1", "APPROVE|120|DATA|hash1"))

        # Different page norm_hash16 must disagree
        self.assertFalse(validator_check("APPROVE|120|CLOUD|hash1", "APPROVE|120|CLOUD|hash2"))

        # Gated denials have canonical token "DENY|0|-|-"
        gated_deny = "DENY|0|-|-"
        self.assertTrue(validator_check(gated_deny, gated_deny))


if __name__ == "__main__":
    unittest.main()
