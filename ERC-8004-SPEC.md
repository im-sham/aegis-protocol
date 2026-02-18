# ERC-8004 Specification Reference (Trustless Agents)

> Source: https://eips.ethereum.org/EIPS/eip-8004
> Status: Draft (Standards Track: ERC)
> Authors: Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), Erik Reppel (Coinbase)
> Mainnet: January 29, 2026

## Overview

Three lightweight on-chain registries enabling agent discovery and trust. Designed as singletons per chain. Agents can operate cross-chain.

---

## 1. Identity Registry (ERC-721 based)

Each agent = NFT with globally unique identifier.

**Agent ID format:**
- `agentRegistry`: `{namespace}:{chainId}:{identityRegistry}` (e.g., `eip155:1:0x742...`)
- `agentId`: ERC-721 tokenId (assigned incrementally)

**Registration file (agentURI resolves to JSON):**
```json
{
  "type": "agent",
  "name": "DataProcessor-v3",
  "description": "Processes and validates structured data",
  "image": "ipfs://...",
  "services": [
    { "type": "a2a", "endpoint": "https://agent.example.com/a2a" },
    { "type": "mcp", "endpoint": "https://agent.example.com/mcp" }
  ],
  "x402Support": true,
  "active": true,
  "registrations": [...],
  "supportedTrust": ["reputation", "crypto-economic", "tee-attestation"]
}
```

**Key functions we use:**
- `register(agentURI) → agentId` — registers new agent
- `ownerOf(agentId) → address` — standard ERC-721, reverts if not registered
- `getAgentWallet(agentId) → address` — reserved metadata key, set via EIP-712 signature
- `setAgentWallet(agentId, newWallet, deadline, signature)` — requires cryptographic proof
- `getMetadata(agentId, key) → bytes` — arbitrary metadata
- `tokenURI(agentId) → string` — the agent's registration file URI

**agentWallet special handling:**
- Reserved metadata key, cannot be set via generic `setMetadata()`
- Requires EIP-712 signature (EOA) or ERC-1271 (smart contract wallet) to change
- Auto-cleared on agent NFT transfer (security measure)
- THIS is where AEGIS sends payment — not to the NFT owner

**URI schemes supported:** `ipfs://`, `https://`, `data:application/json;base64,...` (fully on-chain)

---

## 2. Reputation Registry

Stores feedback from clients about agents. Per (agentId, clientAddress) pair with incrementing feedbackIndex.

**Feedback structure (on-chain):**
- `value`: int128 signed fixed-point (e.g., 85 for 85/100)
- `valueDecimals`: uint8 (0-18)
- `tag1`: string — primary category (e.g., "starred", "responseTime", "jobCompletion")
- `tag2`: string — secondary category (e.g., "code-review", "data-analysis")
- `isRevoked`: bool
- `feedbackIndex`: uint64

**Emitted but NOT stored on-chain (gas optimization):**
- `endpoint`, `feedbackURI`, `feedbackHash`

**Key functions we use:**
- `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`
- `getSummary(agentId, clientAddresses[], tag1, tag2) → (count, summaryValue, summaryValueDecimals)`

**CRITICAL SECURITY:** `getSummary()` REQUIRES non-empty `clientAddresses` array to prevent Sybil attacks. Results without filtering by trusted reviewers are subject to spam. AEGIS submits feedback as `msg.sender` (the escrow contract address), making it a trusted reviewer by default.

**Example tag1 values from the spec:**
- `starred` (0-100 quality score)
- `reachable` (binary)
- `uptime` (percentage)
- `responseTime` (ms)
- `revenues` (USD)
- `tradingYield` (percentage)

**AEGIS uses:**
- `tag1: "jobCompletion"` with tag2: `"settled"`, `"deadline-missed"`
- `tag1: "disputeResolution"` with tag2: `"re-validation"`, `"arbitrator"`, `"timeout-default"`

**Off-chain feedback file (optional, linked via feedbackURI):**
```json
{
  "agentRegistry": "eip155:8453:0x...",
  "agentId": "42",
  "clientAddress": "0x...",
  "value": 85,
  "tag1": "jobCompletion",
  "tag2": "code-review",
  "proofOfPayment": {
    "fromAddress": "0x...(escrow)",
    "toAddress": "0x...(provider wallet)",
    "chainId": 8453,
    "txHash": "0x..."
  }
}
```

---

## 3. Validation Registry

Enables agents to request work verification from validator smart contracts.

**Validation request flow:**
1. AEGIS calls `validationRequest(validatorAddress, agentId, requestURI, requestHash)`
2. Validator contract processes work (re-execution, ZK proof, TEE attestation, manual review)
3. Validator calls `validationResponse(requestHash, response, responseURI, responseHash, tag)`
4. AEGIS reads result via `getValidationStatus(requestHash)`

**Response encoding:** uint8 (0-100)
- 0 = failed
- 100 = passed
- Intermediate values for nuanced outcomes
- Multiple responses per requestHash allowed (soft/hard finality via `tag`)

**On-chain storage:**
- `requestHash`, `validatorAddress`, `agentId`, `response`, `responseHash`, `lastUpdate`, `tag`

**Key functions we use:**
- `validationRequest(validatorAddress, agentId, requestURI, requestHash)` — submit request
- `validationResponse(requestHash, response, responseURI, responseHash, tag)` — validator responds
- `getValidationStatus(requestHash) → (validatorAddress, agentId, response, responseHash, tag, lastUpdate)`

**Validator types (out of scope for ERC-8004, in scope for AEGIS):**
- Stake-secured re-execution (run the same computation again)
- zkML verifiers (zero-knowledge machine learning proofs)
- TEE oracles (trusted execution environment attestation)
- Manual review panels

---

## Design Philosophy

- Flexible: supports MCP, A2A, future protocols
- Gas-efficient: emits events instead of storing non-critical data
- Sybil-aware: public signals with standard schema, expects ecosystem filtering
- Cross-chain: agents can operate across chains
- Composable: singletons designed for other protocols to build on (like AEGIS)

## Current Deployment Status

- EIP published: January 29, 2026
- Status: Draft
- Known deployments: Unknown (very new)
- Base deployment: TBD — we may need to deploy mock registries for testnet
