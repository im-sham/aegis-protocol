# Aegis Protocol Reliability Runbook

Last updated: 2026-03-04

## Purpose

This runbook defines the minimum operational procedure for keeping MCP/API test and staging workflows reliable when external RPC conditions are unstable.

Related:
- Risk tracker: `docs/operations/ENGINEERING-RISK-TRACKER.md`
- MCP E2E suite: `mcp/tests/e2e/mcp-e2e.test.ts`

## Required Secrets (CI / Staging)

- `BASE_SEPOLIA_RPC_URL_PRIMARY`: primary dedicated Base Sepolia RPC endpoint.
- `BASE_SEPOLIA_RPC_URL_SECONDARY`: secondary/failover dedicated Base Sepolia RPC endpoint.
- `AEGIS_E2E_PRIVATE_KEY`: signer key for MCP E2E workflow.

Notes:
- CI uses `AEGIS_RPC_URL` + `AEGIS_RPC_URLS` (primary,secondary).
- Runtime failover order: `AEGIS_RPC_URL` -> `AEGIS_RPC_URLS` -> chain-specific env -> chain default.

## Secret Handling Controls

1. Never commit secrets in code, docs, `.env` templates, or workflow YAML literals.
2. Use a dedicated **testnet-only** key for `AEGIS_E2E_PRIVATE_KEY` (never mainnet/treasury key).
3. Keep low balance and narrow allowance on the E2E key.
4. Keep secreted CI job (`mcp-e2e`) restricted to trusted events only:
   - `workflow_dispatch`
   - `push` to `main`
5. Gate secreted job behind protected environment `testnet-e2e` with required reviewer approval.
   - Ensure there is always an eligible reviewer path for approvals (for example, add at least one additional reviewer or disable `prevent_self_review` for solo-maintainer workflows).
6. Rotate RPC and key secrets on a regular cadence and after any suspicious run/log event.

## Secret Rotation via GitHub CLI

Use these commands from repo root to update secret values without exposing them in history:

```bash
gh secret set BASE_SEPOLIA_RPC_URL_PRIMARY --body "$BASE_SEPOLIA_RPC_URL_PRIMARY"
gh secret set BASE_SEPOLIA_RPC_URL_SECONDARY --body "$BASE_SEPOLIA_RPC_URL_SECONDARY"
gh secret set AEGIS_E2E_PRIVATE_KEY --body "$AEGIS_E2E_PRIVATE_KEY"
gh secret list
```

Notes:
- Values are write-only in GitHub; you can verify names/timestamps but not retrieve secret values later.
- Prefer dedicated provider URLs, not shared/public endpoints.

## Preflight Checklist (Before E2E or Release-Candidate Validation)

1. Confirm endpoint health:
```bash
payload='{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'
curl -sS -H 'content-type: application/json' -d "$payload" "$BASE_SEPOLIA_RPC_URL_PRIMARY"
curl -sS -H 'content-type: application/json' -d "$payload" "$BASE_SEPOLIA_RPC_URL_SECONDARY"
```
2. Confirm signer wallet has adequate gas + USDC.
3. Confirm escrow allowance is sufficient.
4. Run targeted MCP checks:
```bash
cd mcp
AEGIS_PRIVATE_KEY="$PRIVATE_KEY" npm exec -y vitest -- run tests/config.test.ts tests/tools/*.test.ts
AEGIS_PRIVATE_KEY="$PRIVATE_KEY" npm exec -y vitest -- run tests/e2e/mcp-e2e.test.ts
```

## Protected MCP E2E Validation (GitHub Actions)

After secret rotation and workflow updates are merged to `main`:

1. Trigger CI on `main` (`workflow_dispatch` or push).
2. Approve `testnet-e2e` environment deployment when prompted.
3. Confirm `mcp-e2e` job runs and completes successfully.
4. Append run URL + outcome to `docs/operations/ENGINEERING-RISK-TRACKER.md`.

## Operating Guardrails

- Minimum test wallet balance target: `>= 10 USDC`.
- Minimum escrow allowance target: `>= 10 USDC`.
- If either drops below target, top up/approve before running repeated E2E cycles.

## Incident Response: RPC Instability

If MCP E2E or transaction flows fail with transient transport errors (`fetch failed`, `ETIMEDOUT`, `EHOSTUNREACH`, `503`, `504`):

1. Re-run once to confirm it is transient.
2. Prioritize stable endpoint by reordering `AEGIS_RPC_URLS` (put healthiest endpoint first).
3. If persistent, temporarily set a single stable `AEGIS_RPC_URL`.
4. Re-run `mcp` E2E.
5. Update `docs/operations/ENGINEERING-RISK-TRACKER.md` with:
   - date/time
   - failing endpoint(s)
   - mitigation taken
   - verification evidence.

## Weekly Reliability Review

1. Review open reliability tasks in `TASKS.md` under `Reliability & Operations`.
2. Review OPS risks in `docs/operations/ENGINEERING-RISK-TRACKER.md`.
3. Confirm CI secret values are still valid (provider keys/quotas not expired).
4. Confirm `testnet-e2e` environment protections are still enabled (required reviewers + branch policy).
5. Re-run MCP E2E at least once with current secret endpoints.
6. Log verification result in the risk tracker.
