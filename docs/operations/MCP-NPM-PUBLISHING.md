# MCP npm trusted publishing

This package is intended to publish through npm trusted publishing/OIDC instead of long-lived npm write tokens.

Package:

- `@aegis-protocol/mcp-server`
- Source directory: `mcp/`
- Publish workflow: `.github/workflows/publish-mcp.yml`

## npm package trusted-publisher settings

Configure this once on npmjs.com under:

`@aegis-protocol/mcp-server` → Settings → Trusted publishing

Use these exact values:

- Publisher: GitHub Actions
- Organization or user: `im-sham`
- Repository: `aegis-protocol`
- Workflow filename: `publish-mcp.yml`
- Environment name: `npm-publish`
- Allowed actions: `npm publish`

npm's trusted-publisher fields are case-sensitive. The workflow filename is only the filename, not `.github/workflows/publish-mcp.yml`.

## GitHub workflow behavior

The workflow runs on:

- `release.published`
- manual `workflow_dispatch`

Manual runs default to dry-run mode. To publish manually, run the workflow from `main` with `publish=true`.

The workflow:

1. Uses GitHub-hosted `ubuntu-latest`.
2. Grants only `contents: read` and `id-token: write`.
3. Installs Node 24 and verifies npm is new enough for trusted publishing.
4. Installs dependencies with `pnpm install --frozen-lockfile`.
5. Builds the SDK packages.
6. Typechecks, tests, and builds the MCP package.
7. Packs the MCP package with `pnpm pack` so `workspace:*` dependencies are rewritten.
8. Validates the packed package metadata has no `workspace:*` dependencies.
9. Runs `npm publish --dry-run` unless this is a release or manual `publish=true` run.
10. Publishes with `npm publish` when live publishing is enabled.

## Release process

1. Bump `mcp/package.json` version.
2. Ensure MCP tests/build pass.
3. Merge to `main`.
4. Create a GitHub release tag matching the package version, e.g. `v0.1.4`.
5. The release-published event runs the trusted publishing workflow.

The workflow refuses to publish if the release tag does not match `mcp/package.json` version, or if that package version already exists on npm.

## Token policy

Do not use standing npm write tokens for this package except as break-glass fallback.

After trusted publishing is verified end-to-end, npm package settings should be tightened under Publishing access:

- Require two-factor authentication and disallow tokens.

That setting does not block trusted publishers; it only blocks traditional token-based publishing.
