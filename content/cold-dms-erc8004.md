# Cold DMs to ERC-8004 Co-Authors

## Sending strategy
- Send on Twitter/X (DMs or tagged posts if DMs are closed)
- Keep it short — these people get hundreds of messages
- Lead with what you've built (deployed code), not what you want (attention)
- One ask per message
- Space them out: don't DM all four on the same day

## Handles
- **Davide Crapis** (EF dAI team lead): @DavideCrapis on X
- **Marco De Rossi** (MetaMask, lead author): @MarcoMetaMask on X — but verify, may be @marco_derossi
- **Erik Reppel** (Coinbase, x402 author): @ErikReppel on X
- **Jordan Ellis** (Google): email jordanellis@google.com per EIP listing (no public Twitter found)

---

## DM to Davide Crapis (@DavideCrapis)

**Priority: #1 — send first**

Hey Davide — I built AEGIS Protocol, escrow middleware that composes all three ERC-8004 registries (Identity, Reputation, Validation) on Base L2.

It answers the gap between x402 payments and ERC-8004 trust: USDC locked in smart contracts, work validated through the Validation Registry, settlements auto-generate reputation feedback. 4 contracts deployed to Base Sepolia, SDK + MCP server on npm, 202 tests passing.

Just posted details in the Magicians thread. Would love your feedback on the composability approach — especially our design of reputation feedback as best-effort (try/catch, never blocks settlement).

GitHub: github.com/im-sham/aegis-protocol
Site: aegis-protocol.xyz

---

## DM to Marco De Rossi (@marco_derossi / @MarcoMetaMask)

Hey Marco — been building on ERC-8004 and shipped something I think you'd want to see.

AEGIS Protocol is escrow middleware composing all three registries. Identity for agent verification, Validation for work scoring, Reputation for post-settlement feedback. Deployed to Base Sepolia with a TypeScript SDK and MCP server on npm.

I think this is the first protocol to compose all three registries into a production-ready system. I've posted details in the Magicians thread — curious if this aligns with what you envisioned for composability on the standard.

github.com/im-sham/aegis-protocol

---

## DM to Erik Reppel (@ErikReppel)

Hey Erik — I built AEGIS Protocol, which composes x402 and ERC-8004 into escrow middleware for agent transactions on Base.

The thesis: x402 handles simple pay-per-request, but for high-value agent work ($50+ code audits, data analyses), you need escrow protection between payment and delivery. AEGIS locks USDC, validates work through ERC-8004, and auto-settles or disputes autonomously.

Deployed to Base Sepolia, SDK + MCP server on npm. Planning to propose an x402 extension for escrow-recommended headers on high-value transactions.

Would value your perspective on whether this composability makes sense from the x402 side.

github.com/im-sham/aegis-protocol

---

## Email to Jordan Ellis (jordanellis@google.com)

**Subject:** AEGIS Protocol — composing ERC-8004 registries into escrow middleware on Base

Hi Jordan,

I've been building on ERC-8004 and wanted to share AEGIS Protocol — escrow middleware that composes all three registries (Identity, Reputation, Validation) into a trustless transaction layer for AI agents on Base L2.

The protocol locks USDC in smart contracts, routes deliverables through the Validation Registry for quality scoring, auto-settles on passing scores, and runs a 3-tier dispute resolution when validation fails. Every settlement generates reputation feedback, creating a data flywheel that strengthens the ERC-8004 ecosystem.

We've deployed to Base Sepolia with a TypeScript SDK and MCP server on npm. 202 tests passing. Open source under MIT.

I've also published an A2A Agent Card for AEGIS, making it discoverable via the A2A protocol — a natural complement to the A2A work you've been involved with at Google.

Happy to discuss the composability approach or get feedback on our registry integration patterns.

GitHub: https://github.com/im-sham/aegis-protocol
Site: https://aegis-protocol.xyz

Best,
Sham

---

## Additional outreach: awesome-erc8004 PR

**Action:** Open a PR to https://github.com/sudeepb02/awesome-erc8004 adding AEGIS to the "Implementations" or "Projects" section. This is visible to the entire ERC-8004 community.

**PR description:**
Add AEGIS Protocol — escrow middleware composing all three ERC-8004 registries on Base L2. Deployed to Base Sepolia, TypeScript SDK + MCP server on npm.

**Entry to add:**
- [AEGIS Protocol](https://github.com/im-sham/aegis-protocol) - Trustless escrow middleware composing ERC-8004 Identity, Reputation, and Validation registries for AI agent-to-agent transactions on Base L2. Includes TypeScript SDK, MCP Server, REST API, and Graph subgraph.
