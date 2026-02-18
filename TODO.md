# AEGIS Protocol — Next Steps

## Phase 1: Core Contracts ✅

### 1. Get the project compiling ✅
```bash
forge init --force
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
forge build
```
**Done.** Fixed Mocks.sol import paths (`../interfaces/` → `../../src/interfaces/`), enabled `via_ir = true` for stack-too-deep with large Job struct.

### 2. Get tests passing ✅
```bash
forge test -vvv
```
**Done.** 38/38 tests pass (including 2 fuzz tests × 256 runs). Originally estimated 25 tests — actual suite is larger.

### 3. Gas optimization review ✅
```bash
forge test --gas-report
```
**Done.** Gas numbers reviewed. Higher than aspirational targets (struct has 20+ fields = many SSTOREs) but acceptable for Base L2 (~$0.00025/tx). Key numbers:
- `createJob()` — ~491k (target was <200k, but includes atomic USDC transfer + large struct write)
- `submitDeliverable()` — ~329k (includes ERC-8004 validation request)
- `processValidation()` — ~86k read path, ~341k settle path
- `settleAfterDisputeWindow()` — ~320k

### 4. Known issues fixed ✅
- ✅ **Factory auth** — added `authorizedCallers` mapping to AegisEscrow. Factory can create jobs on behalf of agents. USDC transfers from actual agent owner, not the factory.
- ✅ **Slashed funds routing** — `AegisDispute.resolveByTimeout()` now sends to `treasury` (not `address(escrow)`). Added treasury state variable + constructor param + `setTreasury()`.
- ✅ **Raw `.call()` replaced** — `raiseDispute()` now uses typed `IAegisDispute` interface instead of `abi.encodeWithSignature`.
- ⬜ **`_bytes32ToHex()` duplication** — still in both AegisEscrow and AegisDispute. Low-risk, deferred to gas optimization pass.

---

## Phase 2: Full Test Coverage ✅

### 5. Dispute flow integration tests ✅
- ✅ Tier 1: re-validation flow (request, consensus reached, consensus not reached)
- ✅ Tier 2: arbitrator staking, assignment, ruling
- ✅ Tier 3: timeout default, arbitrator slashing
- ✅ Evidence submission (respondent counter-evidence, window expiry)
- ✅ Bond collection and return

### 6. AegisJobFactory tests ✅
- ✅ Template creation (owner-only, open creation mode)
- ✅ Job creation from template (authorized caller path)
- ✅ Template deactivation and update
- ✅ Verify USDC flows from agent owner (not factory) when using template

### 7. AegisTreasury tests ✅
- ✅ Fee collection via `receiveFee()`
- ✅ Treasury/arbitrator pool split
- ✅ Withdrawal functions
- ✅ Sweep for untracked balance
- ✅ Access control

### 8. Edge case & invariant tests ✅
- ✅ Max deadline boundary
- ✅ Zero validation score
- ✅ Multiple concurrent jobs between same agents
- ✅ Invariant: escrow USDC balance == sum of active job amounts
- ✅ Paused protocol behavior across all functions

**Total: 202 tests passing (5 suites, 5 fuzz campaigns × 256 runs)**

---

## Phase 3: Testnet Deployment ✅

### 9. Deploy mock registries to Base Sepolia ✅
Deployed mock ERC-8004 registries since real registries don't exist on Base Sepolia yet. Deploy script auto-detects chain and deploys mocks on testnet.

### 10. Deploy full AEGIS stack to Base Sepolia ✅
**Deployed & Verified — Block 37617228 — Total cost: 0.000028832538 ETH**

| Contract | Address |
|----------|---------|
| MockIdentityRegistry | `0xc67ed2b93a4B05c35872fBB15c199Ee30ce4300D` |
| MockReputationRegistry | `0x760b4605371faE6097AcD2dcd8ca93dd5FfF9c84` |
| MockValidationRegistry | `0xB9D5B30a207429E95ea7E055fbA6D9d6b7Ba632b` |
| AegisTreasury | `0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5` |
| AegisEscrow | `0xe988128467299fD856Bb45D2241811837BF35E77` |
| AegisDispute | `0x2c831D663B87194Fa6444df17A9A7d135186Cb41` |
| AegisJobFactory | `0xFD451BEfa1eE3EB4dBCA4E9EA539B4bf432866dA` |

**Owner/Admin:** `0x31084ba014bC91D467D008e6fb21f827AC6f7eb0`
**USDC:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia)

All 7 contracts verified on Basescan. Wiring confirmed:
- Escrow → Dispute contract linked
- Escrow → Factory authorized as caller
- Treasury → Escrow + Dispute authorized as fee sources

### 11. End-to-end testnet demo
- [ ] Register two test agents via mock Identity Registry
- [ ] Create a job, submit deliverable, validate, settle
- [ ] Verify USDC flows correctly
- [ ] Verify reputation feedback is recorded

---

## Phase 4: SDK & Developer Experience

### 12. TypeScript SDK scaffolding
```
@aegis/sdk
├── src/
│   ├── client.ts       # Main client class
│   ├── contracts.ts    # Contract ABIs and addresses
│   ├── types.ts        # TypeScript types matching Solidity
│   └── utils.ts        # Helpers
├── package.json
└── tsconfig.json
```

### 13. Subgraph schema for The Graph
Index all events for queryable job/dispute/reputation data.
