# Contributing

Thanks for helping improve AEGIS.

## Development Setup

```bash
forge install
forge build
forge test
pnpm install
pnpm -C sdk build
```

For package-specific checks:

```bash
pnpm -C mcp typecheck
pnpm -C mcp test
pnpm -C api typecheck
pnpm -C api test
npm --prefix subgraph test
```

## Pull Requests

- Keep changes scoped to one concern.
- Include tests for behavior changes.
- Update docs when public behavior, configuration, or deployment addresses change.
- Do not commit local agent settings, credential files, generated broadcast logs, or private operating notes.
- For live Base Sepolia E2E checks, use the manual GitHub Actions workflow, or run `pnpm -C mcp run test:e2e` only after confirming the test wallet balance and allowance.

## Style

- Solidity uses Foundry formatting: `forge fmt`.
- TypeScript packages use the existing package scripts and local style.
- Public docs should avoid internal account inventories, raw outreach plans, private handoff notes, and credential-location details.

## Security

Report vulnerabilities through `SECURITY.md`; do not disclose exploitable issues in public PRs or issues before maintainers have reviewed them.
