# Security Policy

## Supported Scope

AEGIS is currently a testnet protocol. Security reports are welcome for:

- Solidity contracts in `src/`
- TypeScript SDK packages in `sdk/`
- MCP server code in `mcp/`
- REST API code in `api/`
- Subgraph mappings in `subgraph/`
- CI, release, and deployment configuration

## Reporting a Vulnerability

Please do not open a public issue for an unpatched vulnerability.

Email `shamim@usmilabs.com` with:

- affected component and file path
- impact and exploit preconditions
- reproduction steps or proof of concept
- suggested fix, if available

Expected response target: 3 business days.

## Public Disclosure

Coordinate disclosure with the maintainers. Public details should wait until the issue is confirmed, patched, and released or otherwise explicitly cleared for disclosure.

## Operational Notes

Do not send private keys, seed phrases, RPC credentials, npm tokens, GitHub tokens, or other credentials in reports. If a report depends on a secret exposure, include only the file path, commit, and redacted evidence.
