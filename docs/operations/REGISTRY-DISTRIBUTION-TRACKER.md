# Aegis Registry Distribution Tracker

Last updated: 2026-05-11
Owner: Pallas

## Purpose

Track AEGIS MCP/server distribution across registries and agent directories.
This is separate from maintainer outreach in `docs/operations/OUTREACH-TRACKER.md`.

## Automation approval boundary

Pallas is approved to create self-serve Aegis registry/dev accounts using `pallas@aegis-protocol.xyz` when there is no:

- payment card or paid plan commitment,
- legal/company representation,
- wallet signature or custody action,
- phone verification,
- broad GitHub org/repo write OAuth request,
- root DNS/admin access.

Escalate to Sham for any of the above.

## Canonical submission packet

| Field | Value |
| --- | --- |
| Project | AEGIS Protocol |
| Operator identity | Pallas / Aegis |
| Email | `pallas@aegis-protocol.xyz` |
| Repo | `https://github.com/im-sham/aegis-protocol` |
| MCP package | `@aegis-protocol/mcp-server` |
| npm version | `0.1.3` |
| MCP registry name | `io.github.im-sham/aegis-protocol` |
| Short description | Trustless escrow for AI agent-to-agent transactions on Base L2 with ERC-8004 identity and USDC. |
| One-liner | AEGIS adds escrow, validation, and dispute resolution to high-value agent transactions. |
| Install command | `npx -y @aegis-protocol/mcp-server` |
| Smithery command | `npx -y smithery mcp add aegis-protocol/mcp-server` |
| Config file | `mcp/server.json` |
| Smithery file | `mcp/smithery.yaml` |
| Primary docs | `README.md`, `mcp/README.md`, `docs/integrations/OPERATOR-ADOPTION-KIT.md` |
| License | MIT |
| Tags | `mcp`, `model-context-protocol`, `aegis`, `escrow`, `ai-agents`, `erc-8004`, `base`, `usdc` |

## Registry/account status

| Priority | Surface | URL | Account/status | Listing status | Next action | Blocker/escalation |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Official MCP Registry | `https://registry.modelcontextprotocol.io` | No separate Pallas account verified | Live listing found via `/v0/servers?search=im-sham`, but registry copy is stale at `0.1.1` while npm is `0.1.3` | Submit/trigger registry metadata refresh using updated `mcp/server.json` | Escalate if GitHub-owner verification or repo OAuth write permission is required |
| P0 | Smithery | `https://smithery.ai/servers/@aegis-protocol/mcp-server` | Email signup attempted with `pallas@aegis-protocol.xyz`; WorkOS returned `Access blocked, please contact support`; no account created | Public listing exists; page says no deployments found / hosted deployment pending paid plan | Use existing public listing; contact Smithery support only if hosted deployment becomes necessary | Paid plan/support gate |
| P0 | MCP.so | `https://mcp.so` | No Pallas account yet; Google/GitHub sign-in required | Submission form attempted, but no visible completion/success message | Complete interactive OAuth session and retry submission | Stop on CAPTCHA/phone/broad OAuth/payment |
| P1 | mcpservers.com | `https://mcpservers.com` | No Pallas account yet; Google sign-in required | Search returned no Aegis listing | Complete interactive Google auth and submit | Stop on CAPTCHA/phone/broad OAuth/payment |
| P1 | MCP Market | `https://mcpmarket.com/server/aegis-protocol` | No separate account required for current state | Listed; submission form reported Aegis already exists | Monitor listing freshness and update only if metadata drifts | Stop on CAPTCHA/phone/broad OAuth/payment |
| P1 | ACI.dev | `https://aci.dev` | Not created | Appears to be consulting/automation platform, not a public MCP registry | Deprioritize unless a concrete integration path appears | Stop on payment/legal/broad OAuth |
| P1 | Composio | `https://composio.dev` | Agent identity created via `agents.composio.dev` and stored locally under `~/.hermes/secrets/` | Not yet confirmed as registry/integration channel | Configure CLI from saved agent identity, then determine if AEGIS can be added as toolkit/app | Stop on payment/legal/broad OAuth |
| P2 | mcp.run | `https://mcp.run` | Pending | Pending | Determine submission/account model | Stop on payment/legal/broad OAuth |

## Current verification notes

- `npm whoami` reports `srehman`; package and scope access are read-write for `@aegis-protocol/mcp-server`, `types`, `abis`, and `sdk`.
- Least-privilege npm team `@aegis-protocol:mcp-maintainers` exists with read-write access only to `@aegis-protocol/mcp-server`; it has no members yet pending Pallas npm account creation.
- `npm view @aegis-protocol/mcp-server` reports version `0.1.3` and `latest` dist-tag `0.1.3`.
- `mcp/README.md` already contains registry references for npm, Smithery, and official MCP Registry.
- `mcp/server.json` and MCP runtime server metadata were updated on 2026-05-11 from stale versions to `0.1.3` so repo metadata matches the published npm package.
- Official MCP Registry still serves stale `0.1.1` metadata as of 2026-05-11; follow-up is a registry refresh/submission, not another npm publish.
- Smithery public page resolves and exposes install instructions, but sign-up via email/password was blocked before account creation.
- MCP Market public listing exists at `https://mcpmarket.com/server/aegis-protocol`.

## Account credential handling

- Do not paste generated account passwords into chat.
- Temporary/generated credentials, if needed for low-risk registry accounts, live only under `~/.hermes/secrets/` with `0600` permissions until migrated to Sham-controlled password management.
- If a service supports Google/OAuth through `pallas@aegis-protocol.xyz`, prefer that over password credentials.
