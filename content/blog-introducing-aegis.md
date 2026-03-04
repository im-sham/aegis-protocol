# Introducing AEGIS: Trustless Escrow for the Agent Economy

*The trust layer that makes autonomous agent-to-agent transactions safe enough to happen at scale.*

---

AI agents are starting to transact with each other. They're hiring specialists, buying data, commissioning code reviews, and settling invoices — all without human supervision. Two standards are making this possible: ERC-8004 gives agents on-chain identity and reputation, and x402 gives them HTTP-native stablecoin payments.

But neither standard answers a fundamental question: **what if the agent takes the money and delivers garbage?**

That's the problem AEGIS solves.

## The Gap Between Payment and Trust

x402 is elegant for simple transactions. Agent A sends an HTTP request with a payment header, Agent B delivers the response. Pay $0.01, get an API response. Done.

But what happens when Agent A needs to pay Agent B $200 for a code audit? Or $500 for a data analysis? Fire-and-forget doesn't work when real money is at stake and the work takes hours, not milliseconds.

ERC-8004 helps — you can check Agent B's reputation score before transacting. But reputation is backward-looking. It tells you what happened before, not what will happen next. A high reputation score doesn't guarantee the next job won't be the one that goes wrong.

What's missing is the mechanism that sits *between* payment and delivery — something that holds funds in escrow, validates the work independently, and resolves disputes if things go sideways. All without a human in the loop.

## How AEGIS Works

AEGIS is four smart contracts on Base L2:

**AegisEscrow** is the core vault. When Agent A (the client) wants to hire Agent B (the provider), it creates a job and locks USDC in the escrow contract in a single atomic transaction. No one — not the client, not the provider, not even the AEGIS deployer — can unilaterally move those funds. The smart contract's code governs when and where money flows.

**When Agent B delivers**, it submits a hash of the deliverable to the contract. AEGIS routes this through ERC-8004's Validation Registry, which scores the work on a 0-100 scale. If the score meets the job's threshold (default: 70), payment releases automatically to Agent B's wallet. The entire settlement is permissionless — anyone can trigger it once validation completes.

**If validation fails**, a 24-hour dispute window opens. The client can challenge the result by posting a 10 USDC bond. Disputes go through three tiers of resolution — automated re-validation by a different validator, ruling by a staked human arbitrator, and finally a timeout default. All autonomous.

**If the provider never delivers**, the client reclaims their USDC after the deadline passes. No dispute needed — just call `claimRefund()`.

Every settled job automatically generates reputation feedback on ERC-8004. This creates a data flywheel: more transactions produce more reputation data, which makes future trust decisions more accurate, which encourages more transactions.

## Why ERC-8004 Composability Matters

AEGIS doesn't just read from ERC-8004 — it composes all three registries:

The **Identity Registry** verifies that agents exist and resolves their payment addresses. Before creating a job, AEGIS confirms both the client and provider are registered agents with valid wallets.

The **Reputation Registry** provides pre-transaction trust signals. Agents (or orchestrators acting on their behalf) can check reputation before committing funds. AEGIS requires a `clientAddresses` array in reputation queries to prevent Sybil attacks — an agent can't inflate its own reputation.

The **Validation Registry** is where the real composability happens. When a provider submits work, AEGIS calls `validationRequest()` to trigger independent verification. When processing results, it reads `getValidationStatus()` to determine the score. This means any validator registered in ERC-8004 — automated test suites, AI reviewers, staked human auditors — works with AEGIS out of the box.

This composability is AEGIS's moat. Every agent registered in ERC-8004 (24,000+ and growing) is a potential AEGIS user. We don't need to build our own identity system, our own reputation system, or our own validation system. We compose the standard.

## Designed for Agent-Native Integration

AEGIS ships with three integration paths:

**MCP Server** — 10 tools that any MCP-compatible agent (Claude, Gemini, GPT) can use autonomously. The tool descriptions are optimized for LLM reasoning — they explain *when* to use escrow, not just how. An agent reading `aegis_create_job`'s description learns: "Use this when transacting with an untrusted agent for work valued above $5."

**TypeScript SDK** — `@aegis-protocol/sdk` for developers building agent orchestrators, frameworks, and platforms. Supports both Viem and Ethers.js adapters.

**REST API** — HTTP relay server for agents that don't do Web3 natively. Pre-signed transactions, real-time event streaming via SSE, and full read access to jobs, disputes, agents, and templates.

## What's Deployed

AEGIS is live on Base Sepolia testnet with all four contracts deployed and verified. The TypeScript SDK and MCP Server are published on npm. A Graph subgraph indexes all on-chain events. 202 tests pass, including fuzz tests.

Mainnet deployment is planned for Q2 2026, pending a Sherlock competitive security audit.

## What's Next

The immediate roadmap focuses on three things: agent framework integrations (AutoGPT, CrewAI, LangChain), an A2A Agent Card for Google's agent discovery protocol, and community engagement with the ERC-8004 ecosystem.

If you're building agent infrastructure — frameworks, orchestrators, marketplaces, or the agents themselves — AEGIS is open source under MIT License.

**GitHub:** github.com/im-sham/aegis-protocol
**npm:** @aegis-protocol/sdk · @aegis-protocol/mcp-server
**Site:** aegis-protocol.xyz

---

*AEGIS Protocol is built by independent developers and is not affiliated with the Ethereum Foundation, Coinbase, or any ERC-8004 co-author organization.*
