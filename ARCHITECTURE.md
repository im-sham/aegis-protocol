# AEGIS Protocol — Architecture Decisions

## Protocol Stack Position

```
APPLICATION LAYER    Agent Orchestrators, Marketplaces, DAO Tooling
                     (consumers of AEGIS)
─────────────────────────────────────────────────────────────────
→ AEGIS PROTOCOL ←   Escrow Contracts, Validation Bridge,
                     Dispute Engine, Settlement Router
─────────────────────────────────────────────────────────────────
MIDDLEWARE           The Graph (Indexing), Chainlink (Oracles), IPFS (Storage)
─────────────────────────────────────────────────────────────────
INFRASTRUCTURE       ERC-8004 (Identity + Reputation + Validation)
                     x402 (Payments), Base L2, USDC
```

## Integration Flow (6 Steps)

### Step 1: Agent Discovery & Verification
Client Agent → ERC-8004 Identity Registry
- Query by skill/endpoint → get providerAgentId, agentWallet, supportedTrust
- Parse agentURI → check services[], x402Support, active status

### Step 2: Reputation Check
AEGIS → ERC-8004 Reputation Registry
- Read provider's historical feedback from trusted clients before escrow creation
- Can enforce minimum reputation threshold at application layer

### Step 3: Escrow Funding
Client Agent → AEGIS + USDC
- Client approves USDC, AEGIS locks in vault atomically with job creation
- Job stored with spec hash (IPFS CID), validator address, deadline

### Step 4: Work Submission & Validation
Provider Agent → AEGIS → ERC-8004 Validation Registry
- Provider submits deliverable URI + hash
- AEGIS triggers `validationRequest()` on ERC-8004
- Validator contract runs verification, responds with 0-100 score
- Score ≥ threshold → auto-settle
- Score < threshold → dispute window opens

### Step 5: Settlement & Payment
AEGIS → Provider agentWallet
- USDC released to provider's agentWallet (from ERC-8004 Identity Registry)
- Protocol fee deducted and sent to Treasury
- Settlement receipt usable as x402 proof-of-payment

### Step 6: Reputation Feedback
AEGIS → ERC-8004 Reputation Registry
- Auto-submit feedback with validation score, job outcome
- Links proof-of-payment (txHash) for verifiable on-chain reputation
- Feeds the data flywheel: more jobs → more reputation signals → better agent selection

---

## Key Architecture Decisions & Rationale

### ADR-001: Atomic Job Creation + Funding
**Decision:** Combine job creation and USDC transfer in a single transaction.
**Rationale:** Prevents "phantom jobs" (created but never funded) that pollute state. Simplifies the state machine. One approval + one tx from the client's perspective.

### ADR-002: Provider Wallet from ERC-8004 (not msg.sender)
**Decision:** Payment always goes to `identityRegistry.getAgentWallet(providerAgentId)`.
**Rationale:** Agents may have their NFT owned by one address (e.g., a multisig) but want payments routed to a different wallet. ERC-8004 handles this with cryptographic proof. We respect the agent's declared payment address.

### ADR-003: Permissionless Validation Processing
**Decision:** `processValidation()` can be called by anyone, not just job parties.
**Rationale:** Validators respond asynchronously to the ERC-8004 Validation Registry. Anyone reading that on-chain state can trigger settlement. Enables keeper networks, automated settlement bots, and removes dependency on either party being online.

### ADR-004: Best-Effort Reputation Feedback
**Decision:** `giveFeedback()` wrapped in try/catch — never blocks settlement.
**Rationale:** Settlement is the critical path. If the Reputation Registry is down, congested, or reverts, the provider still gets paid. Reputation is important but not worth blocking payments over.

### ADR-005: Protocol Fee Snapshot Per Job
**Decision:** Store `protocolFeeBps` in the Job struct at creation time.
**Rationale:** Admin can change protocol fee at any time, but existing jobs keep the fee they were created with. Prevents mid-job fee changes affecting already-agreed terms.

### ADR-006: No Upgradeability in V1
**Decision:** All contracts are immutable (no proxy patterns).
**Rationale:** Trust is our core value prop. Users need to verify the code they're interacting with won't change under them. V2 would deploy as new contracts with migration tooling. This is a deliberate trust tradeoff.

### ADR-007: Three-Tier Dispute Resolution
**Decision:** Escalating system — automated → human → timeout.
**Rationale:**
- Tier 1 (re-validation) handles the 80% case cheaply and fast
- Tier 2 (arbitrator) handles subjective disputes that need judgment
- Tier 3 (timeout) ensures no job is stuck forever
Each tier has different cost/speed tradeoffs matching dispute severity.

### ADR-008: Arbitrator Stake Weighting
**Decision:** Arbitrators selected pseudo-randomly weighted by stake amount.
**Rationale:** Higher stake = more skin in the game = more trusted. Slashing for non-responsiveness or poor rulings creates self-correcting incentive loop. Uses `block.prevrandao` for selection — acceptable for V1 (low-stakes disputes), should upgrade to Chainlink VRF for high-value disputes in V2.

### ADR-009: Base L2 as Target Chain
**Decision:** Deploy on Base (Coinbase L2).
**Rationale:** x402 is a Coinbase standard with best support on Base. Base has $0.00025 tx costs and 400ms finality. USDC is natively supported. ERC-8004 co-authored by Coinbase's Erik Reppel. The ecosystem alignment is natural.

### ADR-010: USDC Only (V1)
**Decision:** Only accept USDC for escrow, not arbitrary ERC-20s.
**Rationale:** Simplifies pricing, eliminates oracle dependencies for token conversion, and matches the agent economy's dominant settlement token. x402 processes 100M+ USDC payments. Multi-token support is a V2 feature.

---

## Dispute Resolution Deep Dive

### Tier 1: Automated Re-Validation (~minutes, gas only)
- Either party requests second validation from different validator
- If both validators agree within ±10 points (tolerance band), average is binding
- If no consensus, must escalate to Tier 2 or wait for Tier 3
- Best for: deterministic tasks (code compilation, data format, API checks)

### Tier 2: Staked Arbitrator (~24-72 hours, dispute bond + fee)
- Arbitrators stake ≥1,000 USDC to participate
- Selected pseudo-randomly, weighted by stake amount
- Evidence window: 48 hours for both parties
- Issues binding 0-100 ruling (% of funds to client)
- Slashed 10% of stake for non-response or consistently bad rulings
- Best for: subjective quality, ambiguous deliverables, partial completion

### Tier 3: Timeout Default (after 7 day TTL)
- If no resolution within TTL, 50/50 split (configurable per template)
- Non-responsive arbitrator gets slashed
- Both parties' bonds returned
- Best for: edge cases, deadlocked disputes

### Arbitrator Economics
- Stake USDC → earn fees from resolutions
- Higher reputation (ERC-8004) → more dispute assignments → more fees
- Bad rulings → stake slashing + reputation damage
- Self-correcting: best arbitrators earn most, bad ones get pruned

---

## Competitive Differentiation

### Why AEGIS Wins

**Composability moat:** Not building new identity or payment rails. Building critical middleware on ERC-8004 (Ethereum Foundation, Coinbase, Google, MetaMask) and x402 (Coinbase, Cloudflare, Google, Vercel). Every agent that registers with ERC-8004 is a potential AEGIS user. Every x402 payment is a potential AEGIS-escrowed payment.

**Data flywheel:** Every settled job generates reputation data written to ERC-8004 Reputation Registry. More jobs → more reputation signals → better agent selection → more jobs. First escrow protocol to reach critical mass of reputation data wins.

**Timing:** ERC-8004 is 2 weeks old. x402 V2 is 2 months old. We're building the first middleware that composes both. This timing advantage compounds as more agents register.

### Competitors (None Compose ERC-8004 + x402)
- Circle AI Escrow: Human-in-loop, Circle APIs only
- AgentEscrowProtocol: Single dev, own basic reputation
- Kite Protocol: Own L1 blockchain
- Coral Protocol: Session vaults, no standard integration
- Virtuals Protocol: Agent launchpad, not escrow
- NEAR Shade Agents: TEE-focused, different architecture

---

## Future Considerations (V2+)

1. **Multi-token support** — Accept any ERC-20, use Chainlink price feeds for conversion
2. **Chainlink VRF** — Replace `block.prevrandao` for high-value arbitrator selection
3. **Multi-validator consensus** — Require N-of-M validators to agree
4. **Governance token** — AEGIS token for protocol governance and staking rewards
5. **Cross-chain escrow** — Lock on one chain, settle on another via bridges
6. **x402 native integration** — AEGIS as an x402 facilitator (verify + settle)
7. **ERC extension proposal** — Submit AEGIS patterns as companion to ERC-8004
