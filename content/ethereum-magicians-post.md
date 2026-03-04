# Ethereum Magicians Forum Post

**Post to:** https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098
**Note:** This is a reply in the existing ERC-8004 discussion thread, not a new thread.

---

## Post title (subject line)

AEGIS Protocol: Composing all three ERC-8004 registries into trustless agent escrow

## Post body

Hey everyone — I've been building on ERC-8004 and wanted to share what I've shipped.

**AEGIS Protocol** is escrow middleware for AI agent-to-agent transactions. It composes all three ERC-8004 registries — Identity, Reputation, and Validation — into a complete transaction safety layer on Base L2, with USDC settlement.

The core question we're solving: x402 handles payments, ERC-8004 handles identity and trust, but what happens between payment and delivery for high-value work? AEGIS locks USDC in a smart contract, routes deliverables through the Validation Registry for scoring, auto-settles on passing scores, and runs a 3-tier dispute resolution if validation fails. Every settlement generates reputation feedback via the Reputation Registry.

**What's deployed (Base Sepolia testnet):**
- 4 contracts: AegisEscrow, AegisDispute, AegisTreasury, AegisJobFactory
- [AegisEscrow on BaseScan](https://sepolia.basescan.org/address/0xD5140b684Ea05a9e5fB6090cb89ED53eeE22A42a)
- TypeScript SDK: `@aegis-protocol/sdk` on npm
- MCP Server: `@aegis-protocol/mcp-server` on npm (10 tools for AI agent integration)
- REST API + The Graph subgraph
- 202 tests passing including fuzz

**How we use ERC-8004:**
- **Identity Registry:** `ownerOf()` and `getAgentWallet()` to verify agents and resolve payment addresses before job creation
- **Reputation Registry:** `getSummary()` for pre-job trust checks (with `clientAddresses` array to prevent Sybil), `giveFeedback()` on every settlement with proof-of-payment
- **Validation Registry:** `validationRequest()` on deliverable submission, `getValidationStatus()` to read scores and route through auto-settle vs. dispute window

**Key design decisions that might interest the working group:**
1. Reputation feedback uses try/catch — never blocks settlement. We think reputation should be best-effort, not a hard dependency.
2. We require `clientAddresses` in reputation queries to prevent agents from inflating their own scores.
3. Validation processing is permissionless — anyone can call `processValidation()` once the registry has a result.
4. Contracts are immutable (no upgradeability) by design. Trust comes from transparency.

Everything is MIT-licensed and open source: [github.com/im-sham/aegis-protocol](https://github.com/im-sham/aegis-protocol)

Would love feedback from anyone working on registry implementations, especially around validation scoring and reputation aggregation. Also happy to discuss the escrow pattern with anyone exploring similar composability.

Planning a more detailed technical writeup on the architecture decisions — will share here when it's ready.
