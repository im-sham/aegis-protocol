# AEGIS REST API — Design Document

**Date:** 2026-02-17
**Status:** Approved
**Author:** Sham + Claude

## Overview

Thin relay server that wraps the AEGIS TypeScript SDK into HTTP endpoints for AI agent frameworks. The server holds no private keys — agents sign transactions locally, the API validates and broadcasts them.

One-liner: **"HTTP interface so any AI agent can use AEGIS without importing a Web3 SDK."**

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Target consumer | AI agent frameworks (CrewAI, LangChain, AutoGPT) | Primary market for AEGIS |
| Auth model | Agent signs, server relays | Trustless — server never touches private keys |
| Tech stack | Node/TypeScript + Hono | Same runtime as SDK, viem-native, strongest type safety chain |
| Real-time | Server-Sent Events (SSE) | One-way push, HTTP-native, auto-reconnect, x402-aligned |
| Architecture | Thin relay server (SDK-native) | SDK does the heavy lifting, API is transport |
| Deployment | Fly.io (`ewr` region) | 99.9% SLA, WireGuard isolation, near Coinbase/Base infra, ~$6-12/mo |
| API auth | Unauthenticated V1 | Agent signature IS the auth for writes; reads are public on-chain data |

## Architecture

```
┌──────────────┐     HTTP/SSE      ┌──────────────────┐     RPC (WS)     ┌──────────────┐
│   AI Agent   │ ◄──────────────► │  AEGIS REST API  │ ◄──────────────► │  Base L2 RPC │
│ (CrewAI etc) │                  │  (Hono + SDK)    │                  │  (Alchemy)   │
└──────────────┘                  └────────┬─────────┘                  └──────────────┘
                                           │ GraphQL
                                           ▼
                                  ┌──────────────────┐
                                  │  AEGIS Subgraph  │
                                  │  (The Graph)     │
                                  └──────────────────┘
```

Three responsibilities:
1. **Read proxy** — SDK read methods + subgraph queries as REST endpoints
2. **Transaction relay** — Accept pre-signed raw txs, validate, broadcast, return receipt
3. **Event stream** — SSE backed by viem `watchContractEvent`

## Transaction Relay Flow

The security-critical path. The server is a dumb broadcast pipe — contracts are the security boundary.

```
Agent                          API                           RPC
  │                              │                             │
  │  POST /tx/relay              │                             │
  │  { signedTx: "0x..." }      │                             │
  │─────────────────────────────►│                             │
  │                              │  1. decode raw tx           │
  │                              │  2. verify `to` is AEGIS    │
  │                              │  3. verify chain ID         │
  │                              │  4. recover signer address  │
  │                              │                             │
  │                              │  eth_sendRawTransaction     │
  │                              │────────────────────────────►│
  │                              │                             │
  │                              │  tx hash                    │
  │                              │◄────────────────────────────│
  │                              │                             │
  │                              │  eth_getTransactionReceipt  │
  │                              │────────────────────────────►│
  │                              │  receipt + logs             │
  │                              │◄────────────────────────────│
  │                              │                             │
  │  { txHash, status, events }  │                             │
  │◄─────────────────────────────│                             │
```

**Why a single `/tx/relay` instead of per-action endpoints?**
Per-action endpoints (e.g., `POST /jobs` that signs the tx) require server-held keys. Since agents sign their own txs, the server doesn't care what the transaction does — it only validates the `to` address is whitelisted and broadcasts. One endpoint handles all writes.

## Endpoints

### Reads — Job Lifecycle

```
GET  /jobs/:id                    → getJob (contract state)
GET  /jobs/:id/history            → subgraph: all events for job
GET  /jobs?state=FUNDED&limit=20  → subgraph: filterable job list
GET  /agents/:id/jobs             → getAgentJobs
GET  /agents/:id/jobs/count       → getAgentJobCount
GET  /protocol/stats              → getProtocolStats
GET  /protocol/stats/daily        → subgraph: DailyStats entities
```

### Reads — Disputes

```
GET  /disputes/:id                → getDispute
GET  /disputes/job/:jobId         → getDisputeForJob
GET  /arbitrators/count           → getActiveArbitratorCount
GET  /arbitrators/:address        → getArbitratorStats
```

### Reads — Templates

```
GET  /templates/:id               → getTemplate
GET  /templates/:id/active        → isTemplateActive
GET  /templates?active=true       → subgraph: list templates
```

### Reads — ERC-8004 (Identity / Reputation / Validation)

```
GET  /agents/:id/wallet           → getAgentWallet
GET  /agents/:id/owner            → ownerOf
GET  /agents/:id/reputation       → getSummary
GET  /agents/:id/reputation/clients → getClients
GET  /validation/:hash            → getValidationStatus
GET  /agents/:id/validations      → getAgentValidations
```

### Reads — USDC

```
GET  /usdc/balance/:address       → balanceOf
GET  /usdc/allowance/:owner/:spender → allowance
```

### Reads — Treasury

```
GET  /treasury/balance            → totalBalance
GET  /treasury/balances           → getBalances (breakdown)
```

### Write — Transaction Relay

```
POST /tx/relay                    → broadcast signed tx
     Body: { signedTx: "0x..." }
     Query: ?wait=true            → wait for receipt (default: true)
     Response: {
       txHash: "0x...",
       blockNumber: 12345,
       status: "success" | "reverted",
       events: [{ name, args }]
     }
```

### Stream — Server-Sent Events

```
GET  /events/stream               → all AEGIS contract events
GET  /events/stream?job=0x...     → events for specific job
GET  /events/stream?contract=escrow → events for one contract
GET  /events/stream?type=JobSettled → specific event type
```

Filters are combinable: `/events/stream?job=0x...&type=JobSettled`

### Meta

```
GET  /health                      → liveness (Fly.io health check target)
GET  /info                        → contract addresses, chain ID, subgraph URL, version
```

### Not Exposed

Admin-only treasury operations (withdraw, sweep, distributeArbitratorRewards) stay SDK-only. They require the contract owner's key and have no business on a public API.

## Security Model

The fundamental insight: **the API is a read cache + dumb broadcast pipe. The contracts are the security boundary.** If the contracts are secure (ReentrancyGuard, SafeERC20, Ownable, Pausable), the API can't make them less secure.

### Threats and Mitigations

| # | Threat | Mitigation |
|---|--------|------------|
| 1 | **Contract whitelist bypass** | Relay only broadcasts to the 4 AEGIS contracts. `to` address validated before broadcast. |
| 2 | **Wrong chain** | Chain ID validated against Base Sepolia (84532) / Base Mainnet (8453). |
| 3 | **Key exfiltration** | Server holds no keys. Zero attack surface. |
| 4 | **Replay attacks** | Ethereum nonces handle this natively. RPC rejects duplicate nonces. |
| 5 | **Relay DDoS / RPC quota burn** | Rate limiting per IP (Hono middleware) + Fly.io Anycast absorption. Malformed txs rejected at API layer before hitting RPC. |
| 6 | **Gas griefing** | Agent pays their own gas. Low-gas txs sit in mempool — agent's problem, not ours. |
| 7 | **SSE connection exhaustion** | Max concurrent SSE connections per IP + global cap (~500-1000 on shared-cpu-2x/512MB). |
| 8 | **Subgraph query abuse** | Query complexity limits, response caching. Subgraph Studio has its own rate limits. |
| 9 | **Malicious calldata to valid contract** | Contracts enforce access control (onlyOwner, onlyAuthorized). API doesn't decode calldata — contracts are the security boundary. |
| 10 | **Error information leakage** | Sanitized error responses in production. RPC errors mapped to clean API error codes. |

## Tech Stack

| Component | Choice |
|-----------|--------|
| Runtime | Node.js 20+ / TypeScript |
| Framework | Hono (edge-compatible, Zod validation, OpenAPI generation) |
| SDK | `@aegis-protocol/sdk` (direct import) |
| Blockchain | viem (tx decoding, signature recovery, event watching) |
| Subgraph client | graphql-request (lightweight, typed) |
| Validation | Zod schemas for all request/response types |
| Testing | Vitest |
| Deployment | Fly.io (`ewr` region, shared-cpu-2x, 512MB) |
| CI | GitHub Actions (lint, typecheck, test) |

## Deployment Configuration

```toml
# fly.toml
app = "aegis-api"
primary_region = "ewr"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  grace_period = "5s"
  interval = "15s"
  method = "GET"
  path = "/health"
  timeout = "2s"
```

**Secrets (via `fly secrets set`):**
- `RPC_URL` — Alchemy/Infura WebSocket endpoint for Base
- `SUBGRAPH_URL` — The Graph Studio query endpoint

No private keys. No API keys. Two secrets total.

## Project Structure

```
api/
├── src/
│   ├── index.ts              # Hono app entry, mounts all routers
│   ├── config.ts             # Environment config (RPC URL, chain, addresses)
│   ├── middleware/
│   │   ├── rate-limit.ts     # Per-IP rate limiting
│   │   ├── error-handler.ts  # Sanitized error responses
│   │   └── cors.ts           # CORS for browser-based agents
│   ├── routes/
│   │   ├── jobs.ts           # /jobs/* read endpoints
│   │   ├── disputes.ts       # /disputes/* read endpoints
│   │   ├── templates.ts      # /templates/* read endpoints
│   │   ├── agents.ts         # /agents/* read endpoints (identity, reputation)
│   │   ├── usdc.ts           # /usdc/* read endpoints
│   │   ├── treasury.ts       # /treasury/* read endpoints
│   │   ├── relay.ts          # POST /tx/relay
│   │   ├── events.ts         # GET /events/stream (SSE)
│   │   └── meta.ts           # /health, /info
│   ├── services/
│   │   ├── sdk.ts            # AegisClient singleton (read-only)
│   │   ├── subgraph.ts       # Subgraph query client
│   │   ├── relay.ts          # Tx validation + broadcast logic
│   │   └── events.ts         # viem event watcher + SSE manager
│   └── schemas/
│       ├── relay.ts          # Zod schemas for relay request/response
│       ├── query.ts          # Zod schemas for query params
│       └── responses.ts      # Zod schemas for all response types
├── tests/
│   ├── relay.test.ts         # Tx relay validation tests
│   ├── routes.test.ts        # Endpoint integration tests
│   └── events.test.ts        # SSE stream tests
├── Dockerfile
├── fly.toml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Future Enhancements (Not in V1)

- **API key authentication** — Gate relay access for paid tier / trusted agents. Bolts on as Hono middleware when needed.
- **WebSocket upgrade** — Bidirectional comms if agents need to stream data back.
- **Response caching** — Redis/Upstash for hot read paths (job state, protocol stats).
- **Multi-chain** — Support Base Mainnet + other L2s by parameterizing chain config.
- **OpenAPI spec export** — Auto-generated from Zod schemas for SDK generation in any language.
