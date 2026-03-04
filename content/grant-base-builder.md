# Base Builder Grant — Application Text

## How the review team finds projects

Base Builder Grants are retroactive — the review team finds projects through Twitter, Farcaster, and community nominations at docs.base.org/get-started/get-funded. They test and use projects before issuing grants. They don't respond to all requests, only reaching out if selected.

## Action items

1. Self-nominate at https://docs.base.org/get-started/get-funded
2. Post about AEGIS on Twitter/X and Farcaster (tag @base, @BuildOnBase)
3. Make sure the repo, site, and npm packages are all linked and professional

## Application text (paste into nomination form)

### Project name
AEGIS Protocol

### One-liner
Trustless escrow middleware for AI agent-to-agent transactions on Base.

### Description

AEGIS is the trust layer for the agent economy on Base. We compose ERC-8004 (Trustless Agents) and x402 (HTTP-native stablecoin payments) into escrow middleware that locks USDC in smart contracts, validates work through on-chain registries, and resolves disputes autonomously.

Neither ERC-8004 nor x402 answers a critical question: what happens when an agent takes payment and delivers garbage? AEGIS fills that gap.

**What we've shipped:**
- 4 smart contracts deployed to Base Sepolia (AegisEscrow, AegisDispute, AegisTreasury, AegisJobFactory)
- TypeScript SDK published on npm (@aegis-protocol/sdk)
- MCP Server published on npm (@aegis-protocol/mcp-server) — 10 tools for AI agent integration
- REST API relay server with real-time event streaming
- The Graph subgraph for full event indexing
- 202 tests passing including fuzz tests

**Why Base:**
- USDC settlement (native to Base via Coinbase)
- x402 composability (Coinbase's payment protocol)
- Low gas costs make escrow economically viable for micro-transactions ($5-50)
- ERC-8004 ecosystem alignment

**ERC-8004 composability (our moat):**
AEGIS is the only protocol composing all three ERC-8004 registries — Identity, Reputation, and Validation. Every AEGIS settlement generates reputation data that strengthens the ecosystem. Every registered ERC-8004 agent (24,000+) is a potential AEGIS user.

### Links
- GitHub: https://github.com/im-sham/aegis-protocol
- Website: https://aegis-protocol.xyz
- npm SDK: https://www.npmjs.com/package/@aegis-protocol/sdk
- npm MCP: https://www.npmjs.com/package/@aegis-protocol/mcp-server
- AegisEscrow on BaseScan: https://sepolia.basescan.org/address/0xD5140b684Ea05a9e5fB6090cb89ED53eeE22A42a

---

# Base Batches 2026 — Startup Track Application

**DEADLINE: March 9, 2026** — apply at basebatches.xyz

## Key facts about the program
- Top 15 teams: $10K grant + 8-week virtual program + Demo Day in SF
- Minimum 3 teams: $50K investment from Base Ecosystem Fund
- Target: pre-product to pre-seed, raised less than ~$250K
- AEGIS fits perfectly: pre-seed, solo founder, deployed code, no funding raised

## Application text (adapt to their form fields)

### What are you building?
AEGIS Protocol — trustless escrow middleware for AI agent-to-agent transactions on Base. We compose ERC-8004 and x402 into a complete transaction safety layer. USDC is locked in smart contracts, work is validated through on-chain registries, and disputes resolve autonomously.

### What problem does it solve?
AI agents are starting to transact with each other — hiring specialists, buying data, commissioning work. x402 handles simple payments. But for high-value work ($50+ code audits, data analyses, document generation), fire-and-forget doesn't work. There's no recourse if the agent delivers garbage. AEGIS is the escrow layer that makes these transactions safe.

### What's your traction?
- Deployed 4 smart contracts + 3 mock registries to Base Sepolia testnet
- Published TypeScript SDK and MCP Server on npm
- 202 tests passing including fuzz tests
- REST API and Graph subgraph operational
- Open source under MIT License
- First protocol to compose all three ERC-8004 registries

### Why Base?
AEGIS is deeply aligned with Base's ecosystem. We compose Coinbase's x402 payment protocol, settle in USDC (native to Base), and benefit from Base's low gas costs that make escrow viable for micro-transactions. The x402 + ERC-8004 + AEGIS stack is a complete agent commerce layer — and it only works on Base.

### What's your background?
Solo founder, full-stack engineer with deep Web3 and AI experience. Built the entire stack (contracts, SDK, API, subgraph, MCP server) in under 3 weeks. Looking for the Base Batches program to accelerate agent framework integrations and prepare for mainnet launch.

### What do you need most from the program?
1. Introductions to the x402 Foundation team (for the escrow header extension proposal)
2. Connections to agent framework teams (AutoGPT, CrewAI, LangChain)
3. Guidance on Sherlock audit process and timing
4. Feedback on go-to-market from teams who've launched infrastructure protocols on Base
