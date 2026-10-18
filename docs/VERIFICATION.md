# On-Chain Verification and Deployment Audit

This document records the exact hashes, addresses, latencies, and source code verification for all smart contracts deployed under the Agent Allowance system on GenLayer Studionet (Chain 61999).

## 1. Network Coordinates
- **Network**: GenLayer Studionet
- **Chain ID**: 61999
- **RPC URL**: `https://studio.genlayer.com/api`
- **Explorer Base**: `https://explorer-studio.genlayer.com/address`

## 2. Deployed Contracts & Transactions

### AllowanceVault (Core Intelligent Spending Account)
- **Contract Address**: `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`
- **Deploy Transaction Hash**: `0x53965fc7c6a0c0bbfec2f0eb3a76395dcfae6eeb246f4439c2794eb827051ae3`
- **Deploy Latency**: 6.28 seconds
- **Source SHA-256**: `ff656818cd98e7387794cce80dc0f0bb8da8b6a85e80a8deaa2e20087866b4ea`
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07](https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07)

### SpendGate (Merchant Integration Consumer)
- **Contract Address**: `0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528`
- **Deploy Transaction Hash**: `0x3ab3717dfb119cb45a4773ebfc48d9aa1787c9339e1f5c66b8d276b89ae6e10f`
- **Deploy Latency**: 7.67 seconds
- **Source SHA-256**: `4b68ff52dbbbd6a2f3be04fbc5218d227b689a9f931665a38a3ae4608c02c6fe`
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528](https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528)

### ProbeExtract (Empirical Robustness Harness)
- **Contract Address**: `0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997`
- **Deploy Transaction Hash**: `0xdb335abaca6e9c82b1d56a809ccb5aee66d378a49225a0b61b1ef34c6f238831`
- **Deploy Latency**: 5.37 seconds
- **Source SHA-256**: `34b23f6e846a9caeecf7dabb480f987224f28a8ab58f31230152f377c74e9f0c`

### Probe (Milestone 0 Runtime Environment Probe)
- **Contract Address**: `0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3`
- **Deploy Transaction Hash**: `0x17f3674c6e12e0594442ca3cafb1e0f59e3a3de2e82d02662bc9e14cc9cbf4fe`
- **Deploy Latency**: 6.67 seconds
- **Source SHA-256**: `5d6ea5507b39f9013090f4c24b2e8dd984ea516534fa8d8314a8630f2dcce68b`

---

## 3. Source Code Byte-for-Byte Verification Method
To verify that the deployed on-chain contract code matches the local source code byte-for-byte:
1. Query the deployment transaction via RPC method `eth_getTransactionByHash`.
2. Extract the base64-encoded Python source payload from `result.data.contract_code`.
3. Decode the base64 payload into raw UTF-8 string bytes.
4. Calculate the SHA-256 hash of the decoded on-chain source string.
5. Compare against the local file's SHA-256 hash.

All contracts achieved exact, byte-for-byte parity without any extraneous envelope bytes.

---

## 4. On-Chain Ledger Conservation Invariant Audit
Following all 13 canonical requests and owner resolution operations, the contract state was audited via on-chain view reads:
- `balance_of(owner)`: 500
- `balance_of(agent)`: 1000
- `balance_of(payee1_cloudco)`: 360 (Spends R1: 120, R2: 120, R6: 120)
- `balance_of(payee2_datashop)`: 90 (Spend R7: 90)
- Total User Balances: 500 + 1000 + 360 + 90 = 1950
- `get_account(1).balance`: 50
- Total in Contract: 1950 + 50 = **2000**
- `get_stats().total_minted`: **2000**
- **Conservation Invariant Status**: **PASSED (100% exact balance conservation)**
