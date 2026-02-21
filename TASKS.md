# Tasks

## Active

### Development (Phase 1 — Core Contracts) ✅ COMPLETE
- [x] ~~**Compile contracts and fix any errors**~~ - all 4 contracts compile clean with forge build (2026-02-18)
- [x] ~~**Get all tests passing**~~ - 217 tests across 6 suites (212 unit/fuzz + 5 invariants) (2026-02-20)
- [x] ~~**Gas optimization review**~~ - all functions economically viable on Base L2 (2026-02-18)
- [x] ~~**Deploy mocks + AEGIS to Base Sepolia testnet**~~ - 7 contracts deployed via Deploy.s.sol (2026-02-18)

### Development (Phase 2.5 — Agent-Native Distribution)
- [x] ~~**Build AEGIS MCP Server**~~ - 10 tools, dual-mode (read-only/signing), stdio transport, 17 tests passing (2026-02-18)
- [~] **Test MCP Server with Claude Desktop** - config wired, partially tested. Need to exercise all 10 tools end-to-end
- [x] ~~**Publish MCP Server to npm**~~ - @aegis-protocol/mcp-server v0.1.2 (2026-02-18, updated 2026-02-21)
- [x] ~~**Publish to official MCP Registry**~~ - io.github.im-sham/aegis-protocol live at registry.modelcontextprotocol.io (2026-02-21)
- [~] **Publish to Smithery** - namespace `aegis-protocol/mcp-server` created, server scans correctly, hosted deploy requires paid plan. Revisit when upgrading or when Smithery adds free stdio support
- [x] ~~**Create A2A Agent Card**~~ - `site/.well-known/agent-card.json` (2026-02-18)
- [ ] **Host A2A Agent Card** - serve at `aegis-protocol.xyz/.well-known/agent-card.json`
- [ ] **Register AEGIS in ERC-8004 Identity Registry** - on Ethereum mainnet
- [ ] **AutoGPT integration** - P0 framework integration, plugin/tool
- [ ] **CrewAI integration** - P0 framework integration
- [ ] **LangChain integration** - P0 framework integration

### Pre-Public Repo ✅ COMPLETE
- [x] ~~**Scrub git history for secrets**~~ - clean 5-commit linear history (2026-02-18)
- [x] ~~**Add MIT LICENSE file**~~ - to repo root (2026-02-18)
- [x] ~~**Make repo public on GitHub**~~ - github.com/im-sham/aegis-protocol (2026-02-18)

### Security & Audit
- [x] ~~**Internal security audit pass**~~ - 6 findings fixed (SEC-001..006), 3 hardening items (BH-001..003) (2026-02-20)
- [x] ~~**Invariant test suite**~~ - 5 invariant tests, 640k handler calls, fund conservation + state machine + solvency (2026-02-20)
- [x] ~~**Custom error migration**~~ - all string reverts → typed errors across 4 contracts (2026-02-20)
- [ ] **Sign up for Sherlock AI** - connect GitHub repo for real-time scanning during development
- [ ] **Contact Sherlock sales for audit quote** - timing: after testnet deploy. Pitch: ERC-8004 + x402 escrow on Base, ~1,500 nSLOC, 4 contracts, public contest preferred
- [ ] **Run Solidity Metrics on codebase** - get exact nSLOC count for Sherlock quote

### Wallet & Infrastructure
- [ ] **Purchase Ledger hardware wallet** - for mainnet deployment. Ledger Nano S Plus (~$79)
- [ ] **Set up deployment wallet** - fresh wallet on Ledger for contract ownership
- [ ] **Plan Safe multisig transition** - 2-of-3 or 3-of-5 setup, 1-2 months post-mainnet

### Grants (Sequenced by Timing)
- [ ] **Apply: Base Builder Grants** - timing: immediately after testnet deploy. Self-nominate at docs.base.org/get-started/get-funded
- [ ] **Apply: Base Batches 2026** - check application window at basebatches.xyz. Startup track.
- [ ] **Apply: Ethereum Foundation ESP** - timing: after testnet + first framework integration (week 4-6). Submit at esp.ethereum.foundation/applicants
- [ ] **Begin x402 Foundation relationship** - join Discord/forum, introduce AEGIS, post technical writeup
- [ ] **Apply: x402 Foundation Developer Grant** - timing: after shipping escrow header extension proposal (month 2-3)

### Community & GTM
- [ ] **Post on Ethereum Magicians forum** - ERC-8004 discussion thread, announce AEGIS (draft ready in `content/`)
- [ ] **DM Davide Crapis (EF dAI team lead)** - Twitter/Farcaster, link to deployed contracts + one-paragraph pitch
- [ ] **DM ERC-8004 co-authors** - Marco De Rossi (MetaMask), Jordan Ellis (Google), Erik Reppel (Coinbase) (draft ready in `content/`)
- [ ] **Join x402 Foundation developer community** - Discord/forum
- [ ] **Write "Introducing AEGIS" blog post** - Mirror / blog (draft ready in `content/`)

### Legal & Entity
- [ ] **Set up LLC** - for legal entity, grant applications, terms of service
- [ ] **Draft Terms of Service** - for protocol usage
- [ ] **Get legal opinion letter on money transmitter status** - crypto-specialized attorney, ~$500-1K. Pre-mainnet.

### Pre-Mainnet Incident Readiness
- [ ] **Test pause() and unpause() on testnet** - verify emergency stop works correctly
- [ ] **Document owner wallet access procedure** - where hardware wallet is stored, who else knows
- [ ] **Set up on-chain monitoring alerts** - use subgraph + API for anomaly detection (dispute rate spikes, unusual patterns)
- [ ] **Draft incident communication templates** - tweet/post templates for P0-P3 severity levels
- [ ] **Confirm Sherlock Shield coverage** - ensure coverage is active and claims process is understood

### Pricing Strategy
- [ ] **Launch V1 with 2.5% flat fee** - simple, ship fast, gather data
- [ ] **Evaluate tiered pricing after 2-3 months of data** - analyze where volume concentrates
- [ ] **Consider zero-fee bootstrap promotion** - first 90 days or first 100 jobs at 0% to solve cold-start problem

### Content Calendar (First 12 Weeks Post-Launch)
- [ ] **Week 1: "Introducing AEGIS: Trustless Escrow for the Agent Economy"** - Mirror / blog
- [ ] **Week 2: "How AEGIS Composes ERC-8004 + x402"** - Mirror + Ethereum Magicians
- [ ] **Week 3: "Add Escrow to Your Agent in 5 Minutes" (AutoGPT)** - Dev.to + AutoGPT Discord
- [ ] **Week 4: "Add Escrow to Your Agent in 5 Minutes" (CrewAI)** - Dev.to + CrewAI Discord
- [ ] **Week 6: "Why x402 Needs Escrow for High-Value Transactions"** - x402 community + Mirror
- [ ] **Week 8: "The Agent Escrow Design Space: A Survey"** - Mirror + Twitter thread
- [ ] **Week 10: "AEGIS Month 2: What We've Learned"** - Mirror / blog
- [ ] **Week 12: "Building Agent-Native Infrastructure"** - Mirror + Farcaster

## Waiting On

- [ ] **ERC-8004 registry deployment on Base L2** - currently mainnet only, team plans to extend to L2s. since 2026-02-18
- [ ] **Base Batches 2026 startup track application window** - check basebatches.xyz for dates. since 2026-02-18
- [ ] **Sherlock AI access/pricing** - need to sign up and evaluate. since 2026-02-18

## Someday

- [ ] **Python SDK** - for non-JS agent ecosystem
- [ ] **Set up Safe multisig for protocol ownership** - 1-2 months post-mainnet
- [ ] **Propose x402 AEGIS-ESCROW-RECOMMENDED header extension** - month 2-3 post-launch
- [ ] **Apply: Optimism RetroPGF** - needs 2-3 months of mainnet metrics first
- [ ] **Premium job templates** - secondary revenue stream, post-launch
- [ ] **Protocol governance discussions** - when monthly revenue exceeds ~$10K
- [ ] **Foundation entity consideration** - 12-18 months post-mainnet if warranted
- [ ] **Security monitor agent on local PC** - investigate fine-tuning open source model for crypto security (RTX 3080 Ti, 12GB VRAM)

## Done

- [x] ~~Core contracts written (AegisEscrow, AegisDispute, AegisTreasury, AegisJobFactory)~~ (2026-02)
- [x] ~~ERC-8004 interface definitions~~ (2026-02)
- [x] ~~AegisTypes.sol shared library~~ (2026-02)
- [x] ~~Mock ERC-8004 registries for testing~~ (2026-02)
- [x] ~~Comprehensive test suite (25 tests + fuzz)~~ (2026-02)
- [x] ~~Deploy script for Base Sepolia~~ (2026-02)
- [x] ~~TypeScript SDK (@aegis-protocol/sdk)~~ (2026-02)
- [x] ~~SDK integration tests against Base Sepolia~~ (2026-02)
- [x] ~~SDK DX enhancements~~ (2026-02)
- [x] ~~Subgraph (The Graph) for full event indexing~~ (2026-02)
- [x] ~~REST API relay server~~ (2026-02)
- [x] ~~Investor one-pager PDF (2 pages)~~ (2026-02-18)
- [x] ~~Strategic Research Brief v1.0~~ (2026-02-18)
- [x] ~~Strategic Research Brief v2.0 — expanded GTM, agent distribution, Sherlock, grants, open source strategy~~ (2026-02-18)
- [x] ~~Updated CLAUDE.md with strategic context~~ (2026-02-18)
- [x] ~~AEGIS MCP Server — 10 tools, dual-mode, 17 tests~~ (2026-02-18)
- [x] ~~Contracts compile clean — zero errors, forge build~~ (2026-02-18)
- [x] ~~217 tests passing — 6 test suites (212 unit/fuzz + 5 invariants)~~ (2026-02-20)
- [x] ~~Gas report reviewed — all functions viable on Base L2~~ (2026-02-18)
- [x] ~~Base Sepolia testnet deployment — 7 contracts (4 AEGIS + 3 mock ERC-8004)~~ (2026-02-18)
- [x] ~~Git history scrubbed for secrets~~ (2026-02-18)
- [x] ~~MIT LICENSE added~~ (2026-02-18)
- [x] ~~Repo made public — github.com/im-sham/aegis-protocol~~ (2026-02-18)
- [x] ~~All SDK packages published to npm — types, abis, sdk, mcp-server v0.1.0~~ (2026-02-18)
- [x] ~~README + landing page + social preview images~~ (2026-02-18)
- [x] ~~A2A Agent Card created — site/.well-known/agent-card.json~~ (2026-02-18)
- [x] ~~Security audit pass — 6 findings fixed (SEC-001..006), 3 hardening items (BH-001..003)~~ (2026-02-20)
- [x] ~~Custom error migration — all string reverts → typed errors across 4 contracts~~ (2026-02-20)
- [x] ~~Invariant test suite — 5 tests, 640k handler calls, CI profile added~~ (2026-02-20)
- [x] ~~Security tracker + best practices report — docs/security/~~ (2026-02-20)
- [x] ~~Content assets drafted — blog post, grant app, forum post, cold DMs in content/~~ (2026-02-18)
- [x] ~~MCP Server published to official MCP Registry — io.github.im-sham/aegis-protocol~~ (2026-02-21)
- [x] ~~MCP Server v0.1.2 — createSandboxServer export for registry scanners, server.json manifest~~ (2026-02-21)
- [x] ~~Smithery namespace created — aegis-protocol/mcp-server (hosted deploy pending paid plan)~~ (2026-02-21)
