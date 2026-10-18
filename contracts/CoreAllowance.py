# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


class CoreAllowance(gl.Contract):
    balances: TreeMap[str, str]
    minted: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.view
    def balance_of(self, account: str) -> str:
        addr = account.strip().lower()
        return self.balances.get(addr, "0")

    @gl.public.write
    def claim_demo_credits(self) -> str:
        sender = gl.message.sender_address.as_hex.lower()
        if self.minted.get(sender, "") == "1":
            raise gl.vm.UserError("already claimed demo credits")
        self.minted[sender] = "1"
        curr = int(self.balances.get(sender, "0"))
        self.balances[sender] = str(curr + 1000)
        return "1000"
