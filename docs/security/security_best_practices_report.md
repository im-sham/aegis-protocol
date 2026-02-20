# Aegis Protocol Security Handoff Report (2026-02-20)

## Executive summary

This report captures the security findings raised during the audit and the remediation status after code changes.

For ongoing ownership and lifecycle tracking of these findings, use `docs/security/SECURITY-TRACKER.md`.

- Total findings tracked: 6
- Fixed in this pass: 6
- Severity mix: 2 Critical (P0), 2 High (P1), 2 Medium (P2)
- Verification: smart contracts, API, and MCP test suites pass after changes

## Scope

- Solidity contracts in `/src` and tests in `/test`
- API routes/schemas in `/api/src` and tests in `/api/tests`
- MCP tools in `/mcp/src` and tests in `/mcp/tests`

## Findings and remediation

### Critical (P0)

#### SEC-001: Permissionless factory spend path via approved client funds
- Original finding: `createJobFromTemplate` lacked a caller ownership check, allowing third parties to trigger escrow spend paths for pre-approved clients.
- Risk: Unauthorized job creation and unwanted fund movement from approved client wallets.
- Location found: `src/AegisJobFactory.sol:133`
- Fix:
1. Added identity registry accessor to factory escrow interface at `src/AegisJobFactory.sol:22`.
2. Added owner binding check before job creation at `src/AegisJobFactory.sol:151`.
3. Revert with `NotAgentOwner` if `msg.sender` is not the actual client agent owner at `src/AegisJobFactory.sol:153`.
- Validation:
1. Negative authorization test at `test/AegisJobFactory.t.sol:286`.
2. `forge test` passing suite includes `test_CreateJobFromTemplate_RevertIfCallerNotClientOwner`.
- Status: Fixed

#### SEC-002: Re-validation hash not bound to dispute
- Original finding: `processReValidation` accepted arbitrary hashes without ensuring they were requested for the target dispute.
- Risk: Disputes could be resolved from unrelated validation responses.
- Location found: `src/AegisDispute.sol:264`
- Fix:
1. Added per-dispute hash allowlist mapping at `src/AegisDispute.sol:66`.
2. Persisted request hash during request path at `src/AegisDispute.sol:256`.
3. Enforced hash membership in processing path at `src/AegisDispute.sol:269`.
- Validation:
1. Unknown-hash revert test at `test/AegisDispute.t.sol:462`.
2. `forge test` passing suite includes `test_ProcessReValidation_RevertIfUnknownHash`.
- Status: Fixed

### High (P1)

#### SEC-003: Arbitrator could unstake while actively assigned
- Original finding: `unstakeArbitrator` did not enforce “no active disputes” behavior.
- Risk: Assigned arbitrators could reduce slashable collateral before ruling/timeout.
- Location found: `src/AegisDispute.sol:325`
- Fix:
1. Added active-assignment counter per arbitrator at `src/AegisDispute.sol:63`.
2. Increment on assignment at `src/AegisDispute.sol:359`.
3. Decrement on resolution at `src/AegisDispute.sol:511`.
4. Block unstake when active disputes exist at `src/AegisDispute.sol:327`.
- Validation:
1. Unstake guard test at `test/AegisDispute.t.sol:576`.
2. `forge test` passing suite includes `test_UnstakeArbitrator_RevertIfHasActiveDisputes`.
- Status: Fixed

#### SEC-004: Disputes could be raised with no dispute engine configured
- Original finding: `raiseDispute` allowed state transition to `DISPUTED` even when `disputeContract` was unset.
- Risk: Dispute lifecycle dead-end and potential locked funds.
- Location found: `src/AegisEscrow.sol:453`
- Fix:
1. Added mandatory dispute contract guard at `src/AegisEscrow.sol:464`.
2. Enforced delegation after state transition at `src/AegisEscrow.sol:482`.
- Validation:
1. Revert test added at `test/AegisEscrow.t.sol:520`.
2. `forge test` passing suite includes `test_RaiseDispute_RevertIfDisputeContractNotSet`.
- Status: Fixed

### Medium (P2)

#### SEC-005: GraphQL list query params interpolated unsafely
- Original finding: pagination/state values were interpolated into query strings.
- Risk: query tampering, expensive reads, and unstable query behavior.
- Location found: `api/src/routes/jobs.ts:44`
- Fix:
1. Added strict schema validation and bounded pagination/state enum at `api/src/schemas/query.ts:8`.
2. Rejected invalid query input with HTTP 400 at `api/src/routes/jobs.ts:53`.
3. Switched to GraphQL variables for list queries at `api/src/routes/jobs.ts:68` and `api/src/routes/jobs.ts:77`.
4. Applied same hardening pattern to template list route at `api/src/routes/templates.ts:34`.
- Validation:
1. Invalid pagination rejection test at `api/tests/routes/jobs.test.ts:9`.
2. Variable-usage assertion test at `api/tests/routes/jobs.test.ts:19`.
3. `api` vitest suite: 8 files, 26 tests passed.
- Status: Fixed

#### SEC-006: MCP balance check used hardcoded escrow address
- Original finding: `aegis_check_balance` referenced a fixed escrow address, causing chain/config drift.
- Risk: false `allowance` and `canCreateJob` signal when addresses differ by network.
- Location found: `mcp/src/tools/check-balance.ts:24`
- Fix:
1. Pulled escrow address from chain config map at `mcp/src/tools/check-balance.ts:24`.
2. Passed MCP config into tool handler at `mcp/src/index.ts:99`.
3. Added dedicated check-balance regression tests at `mcp/tests/tools/check-balance.test.ts:25`.
- Validation:
1. `mcp` vitest suite: 5 files, 17 tests passed.
- Status: Fixed

## Staged remediation sequence used

1. Stage 1 (Critical authorization/data-binding): SEC-001, SEC-002.
2. Stage 2 (High liveness/economic security): SEC-003, SEC-004.
3. Stage 3 (Off-chain interface hardening): SEC-005, SEC-006.

## Regression evidence (2026-02-20)

- `forge test`: 205 passed, 0 failed.
- `cd api && ./node_modules/.bin/vitest run`: 26 passed, 0 failed.
- `cd mcp && ./node_modules/.bin/vitest run`: 17 passed, 0 failed.

## Additional hardening backlog (next pass)

### BH-001 (Medium): Timeout resolution split is static and ignores template default split
- Evidence: `src/AegisDispute.sol:413` has `TODO` and hardcoded `defaultClientPercent = 50`.
- Recommendation: Wire timeout split to template/job-level dispute policy to match intended economics and reduce policy drift.

### BH-002 (Medium): Arbitrator selection randomness is miner/block-influenceable
- Evidence: selection seed uses `block.timestamp` and `block.prevrandao` at `src/AegisDispute.sol:529`.
- Recommendation: move toward commit-reveal, VRF, or delayed selection entropy that is harder to manipulate.

### BH-003 (Operational): Add automated adversarial security loop in CI
- Recommendation:
1. Add property/invariant fuzzing focused on authorization, state transitions, and fund conservation.
2. Add differential checks that require new auth/state-affecting code paths to include negative tests.
3. Run periodic AI-assisted audit passes and triage findings as code comments/issues.

## OpenAI EVMbench context and implications

The OpenAI post linked in the request points to the publication of EVMbench and emphasizes three capability modes for smart-contract agents: detect, patch, and exploit. It also highlights that exploit capability is improving quickly while detect/patch remain incomplete.

- Source post reference: [OpenAI X post](https://x.com/openai/status/2024193883748651102?s=46)
- Primary source: [Introducing EVMbench](https://openai.com/index/introducing-evmbench/)

Implications applied to this repo:

1. Do not assume one audit pass is exhaustive; enforce repeated detect/patch cycles.
2. Prioritize exploit-path closure first (authorization bypasses and dispute state integrity), which this remediation pass did.
3. Keep objective, replayable validation harnesses (tests/invariants) for every security fix so regressions are machine-detectable.
