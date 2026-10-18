# Integration Guide (INTEGRATION.md)

This guide documents the public methods, JSON return schemas, error strings, and client integration rules for `AllowanceVault` and `SpendGate`.

## 1. Network & Client Configuration
- **Network**: GenLayer Studionet (Chain ID: 61999)
- **RPC URL**: `https://studio.genlayer.com/api`
- **Client SDK**: `genlayer-js@1.1.8`
- **Receipt Rule**: A write transaction is successful IF AND ONLY IF:
  - `status_name` is `ACCEPTED` or `FINALIZED`
  - AND `result_name` is `MAJORITY_AGREE`
  - AND `consensus_data.leader_receipt[0].execution_result` is `SUCCESS`
- **Receipt Polling Recommended Parameters**:
  ```javascript
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    retries: 120,
    interval: 3000,
  });
  ```

---

## 2. AllowanceVault Methods

### Public Writes

#### `claim_demo_credits() -> str`
Claims 1,000 demo credits (internal accounting tokens with no real economic value). Callable once per address.
- **Arguments**: None
- **Returns**: `"1000"`

#### `create_account(name: str, policy_json: str) -> str`
Creates a new spending account with an immutable policy.
- **Arguments**:
  - `name`: ASCII string between 3 and 60 characters.
  - `policy_json`: Canonical JSON string:
    ```json
    {
      "per_spend_cap": 200,
      "total_budget": 500,
      "max_spends": 6,
      "currency": "USD",
      "categories": ["CLOUD", "DATA", "SOFTWARE"],
      "payees": [
        {
          "payee": "0x1111111111111111111111111111111111111111",
          "prefix": "https://raw.githubusercontent.com/.../cloudco/"
        }
      ]
    }
    ```
- **Returns**: `account_id` (e.g. `"1"`)

#### `fund_account(account_id: str, amount: int) -> None`
Transfers credits from owner balance to account balance.
- **Arguments**: `account_id` (str), `amount` (int)

#### `add_agent(account_id: str, agent: str) -> None`
Authorizes an AI agent address to request spends. Up to 5 agents allowed.
- **Arguments**: `account_id` (str), `agent` (0x address str)

#### `remove_agent(account_id: str, agent: str) -> None`
Revokes an agent's authorization.

#### `close_account(account_id: str) -> None`
Closes the account and refunds remaining unspent balance to the owner.

#### `request_spend(account_id: str, payee: str, amount: int, category: str, evidence_url: str) -> str`
Executes an invoice spend request.
- **Returns**: Consensus token (e.g. `"APPROVE|120|CLOUD|75a5f45576ea6f2d"`)

#### `resolve_spend(spend_id: str, approve: bool) -> None`
Owner manual resolution for spends in `PENDING` (`ASK_OWNER`) status.

---

### Public Views

#### `get_account(account_id: str) -> str`
Returns JSON:
```json
{
  "schema_version": "1",
  "id": "1",
  "owner": "0x...",
  "name": "Production Account",
  "balance": "400",
  "spent": "120",
  "spend_count": "1",
  "per_spend_cap": "200",
  "total_budget": "500",
  "max_spends": "6",
  "currency": "USD",
  "categories": ["CLOUD", "DATA", "SOFTWARE"],
  "payees": [{"payee": "0x...", "prefix": "https://..."}],
  "agents": ["0x..."],
  "policy_hash": "...",
  "status": "OPEN",
  "seq": "1"
}
```

#### `get_spend(spend_id: str) -> str`
Returns JSON:
```json
{
  "schema_version": "1",
  "id": "1",
  "account_id": "1",
  "agent": "0x...",
  "payee": "0x...",
  "declared_amount": "120",
  "declared_category": "CLOUD",
  "evidence_url": "https://...",
  "decision": "APPROVED",
  "reason": "-",
  "observed_amount": "120",
  "observed_category": "CLOUD",
  "quote": "Total due: 120 USD",
  "norm_hash16": "75a5f45576ea6f2d",
  "tripwire": false,
  "leader_reported": "true",
  "executed": "true",
  "seq": "1"
}
```

#### `spend_receipt(spend_id: str) -> str`
Compact representation consumed by `SpendGate`:
```json
{
  "spend_id": "1",
  "account_id": "1",
  "payee": "0x...",
  "amount": "120",
  "category": "CLOUD",
  "decision": "APPROVED",
  "executed": "true",
  "policy_hash": "..."
}
```

---

## 3. SpendGate Methods

#### `is_spend_valid_for(spend_id: str, account_id: str, payee: str, amount: int, policy_hash: str) -> bool`
View call performing synchronous cross-contract inspection of the spend receipt.

#### `serve(spend_id: str, account_id: str, payee: str, amount: int, policy_hash: str) -> None`
Write call executed by the payee to fulfill a verified spend and prevent double-service.

---

## 4. Exact User-Facing Error Messages (`gl.vm.UserError`)
- `"already claimed demo credits"`
- `"bad name"`
- `"bad policy JSON"`
- `"bad per_spend_cap"`
- `"bad total_budget"`
- `"bad max_spends"`
- `"bad currency"`
- `"bad categories"`
- `"bad category"`
- `"bad payees"`
- `"bad prefix: length"`
- `"bad prefix: trailing slash"`
- `"bad prefix: scheme"`
- `"bad prefix: userinfo"`
- `"bad prefix: host"`
- `"bad prefix: port"`
- `"bad prefix: query"`
- `"bad prefix: fragment"`
- `"unknown account"`
- `"unknown spend"`
- `"not owner"`
- `"account closed"`
- `"bad amount"`
- `"bad agent address"`
- `"too many agents"`
- `"funding exceeds the budget rule"`
- `"insufficient balance"`
- `"not a registered agent"`
- `"bad payee address"`
- `"spend not pending"`
- `"limits no longer hold on resolve"`
- `"duplicate observation: <existing_spend_id>"`
- `"evidence source unreachable"`
- `"HTTP status not 200: <status>"`
- `"page too large"`
- `"page unreadable (too little text; it may need JavaScript)"`
- `"sender must equal payee"` (SpendGate)
- `"spend already served"` (SpendGate)
- `"spend not valid for these parameters"` (SpendGate)
