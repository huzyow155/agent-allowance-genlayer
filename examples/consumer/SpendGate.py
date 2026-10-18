# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


class SpendGate(gl.Contract):
    vault_address: Address
    services: TreeMap[str, str]
    payee_services: TreeMap[str, str]

    def __init__(self, vault_address_str: str):
        # Do not assign TreeMap() in __init__
        self.vault_address = Address(vault_address_str)

    # -----------------------------------------------------------------------
    # Public Views
    # -----------------------------------------------------------------------

    @gl.public.view
    def is_spend_valid_for(
        self,
        spend_id: str,
        account_id: str,
        payee: str,
        amount: int,
        policy_hash: str,
    ) -> bool:
        sid = str(spend_id).strip()
        aid = str(account_id).strip()
        payee_addr = payee.strip().lower()
        amt_str = str(amount)
        pol_hash = policy_hash.strip().lower()

        # Synchronous view call to AllowanceVault.spend_receipt
        vault_contract = gl.get_contract_at(self.vault_address)
        receipt_json = vault_contract.view().spend_receipt(sid)
        if not receipt_json:
            return False

        try:
            r = json.loads(receipt_json)
        except Exception:
            return False

        if r.get("spend_id") != sid:
            return False
        if r.get("account_id") != aid:
            return False
        if r.get("payee", "").lower() != payee_addr:
            return False
        if r.get("amount") != amt_str:
            return False
        if r.get("policy_hash", "").lower() != pol_hash:
            return False

        dec = r.get("decision", "")
        if dec not in ("APPROVED", "OWNER_APPROVED"):
            return False
        if r.get("executed") != "true":
            return False

        return True

    @gl.public.view
    def get_service(self, spend_id: str) -> str:
        sid = str(spend_id).strip()
        if sid in self.services:
            return self.services[sid]
        return ""

    @gl.public.view
    def list_services_by_payee(self, payee: str, limit: int = 10) -> list[str]:
        if limit <= 0:
            limit = 10
        if limit > 20:
            limit = 20
        payee_addr = payee.strip().lower()
        if payee_addr not in self.payee_services:
            return []
        sids = json.loads(self.payee_services[payee_addr])
        results = []
        for sid in sids[:limit]:
            if sid in self.services:
                results.append(self.services[sid])
        return results

    # -----------------------------------------------------------------------
    # Public Writes
    # -----------------------------------------------------------------------

    @gl.public.write
    def serve(
        self,
        spend_id: str,
        account_id: str,
        payee: str,
        amount: int,
        policy_hash: str,
    ) -> None:
        sender = gl.message.sender_address.as_hex.lower()
        sid = str(spend_id).strip()
        payee_addr = payee.strip().lower()

        if sender != payee_addr:
            raise gl.vm.UserError("sender must equal payee")

        if sid in self.services:
            raise gl.vm.UserError("spend already served")

        valid = self.is_spend_valid_for(sid, account_id, payee, amount, policy_hash)
        if not valid:
            raise gl.vm.UserError("spend not valid for these parameters")

        record = {
            "schema_version": "1",
            "spend_id": sid,
            "account_id": str(account_id).strip(),
            "payee": payee_addr,
            "amount": str(amount),
            "policy_hash": policy_hash.strip().lower(),
            "served_by": sender,
            "status": "SERVED",
        }
        self.services[sid] = json.dumps(record, sort_keys=True, separators=(",", ":"))

        # Maintain index of served spends for payee
        slist = json.loads(self.payee_services.get(payee_addr, "[]"))
        if sid not in slist:
            slist.insert(0, sid)
            self.payee_services[payee_addr] = json.dumps(slist[:50], sort_keys=True, separators=(",", ":"))
