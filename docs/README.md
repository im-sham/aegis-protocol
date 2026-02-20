# AEGIS Protocol Documentation

> Trustless escrow middleware for AI agent-to-agent transactions

---

## 📚 Documentation Index

### Core Protocol Documentation

| Document | Size | Purpose |
|----------|------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | TBD | Full protocol architecture and design decisions |
| [COMPETITIVE-ANALYSIS.md](./COMPETITIVE-ANALYSIS.md) | TBD | Detailed competitor breakdown |
| [ERC-8004-SPEC.md](./ERC-8004-SPEC.md) | TBD | Complete ERC-8004 specification notes |

### SDK Research (February 2026)

| Document | Size | Purpose |
|----------|------|---------|
| **[SDK-RESEARCH-SUMMARY.md](./SDK-RESEARCH-SUMMARY.md)** | 11 KB | **START HERE** — Executive summary with recommendations |
| [SDK-ARCHITECTURE-RESEARCH.md](./SDK-ARCHITECTURE-RESEARCH.md) | 30 KB | Detailed analysis of 7 Web3 SDKs, patterns, best practices |
| [SDK-COMPARISON-TABLE.md](./SDK-COMPARISON-TABLE.md) | 17 KB | Quick reference comparison tables |
| [SDK-CODE-EXAMPLES.md](./SDK-CODE-EXAMPLES.md) | 28 KB | Full implementation examples with code |

**Total SDK Research:** 86 KB across 4 documents

### Security Documentation

| Document | Purpose |
|----------|---------|
| [security/security_best_practices_report.md](./security/security_best_practices_report.md) | Security findings, remediation details, and verification evidence |
| [security/SECURITY-TRACKER.md](./security/SECURITY-TRACKER.md) | Living tracker for finding status, ownership, and hardening backlog |

---

## 🎯 Quick Navigation

### For Developers Building on AEGIS

**"I want to understand the protocol"**
→ Start with [ARCHITECTURE.md](./ARCHITECTURE.md)

**"I want to use the TypeScript SDK"**
→ Start with [SDK-RESEARCH-SUMMARY.md](./SDK-RESEARCH-SUMMARY.md) then see [SDK-CODE-EXAMPLES.md](./SDK-CODE-EXAMPLES.md)

**"I want to compare AEGIS to alternatives"**
→ Read [COMPETITIVE-ANALYSIS.md](./COMPETITIVE-ANALYSIS.md)

**"I want to understand ERC-8004 integration"**
→ Read [ERC-8004-SPEC.md](./ERC-8004-SPEC.md)

### For SDK Developers

**"I need to implement the SDK"**
1. Read [SDK-RESEARCH-SUMMARY.md](./SDK-RESEARCH-SUMMARY.md) (decisions + rationale)
2. Review [SDK-CODE-EXAMPLES.md](./SDK-CODE-EXAMPLES.md) (implementation patterns)
3. Reference [SDK-ARCHITECTURE-RESEARCH.md](./SDK-ARCHITECTURE-RESEARCH.md) (deep dives)
4. Use [SDK-COMPARISON-TABLE.md](./SDK-COMPARISON-TABLE.md) (quick lookups)

**"I want to understand a specific pattern"**
→ Use [SDK-COMPARISON-TABLE.md](./SDK-COMPARISON-TABLE.md) for quick lookups, then dive into [SDK-ARCHITECTURE-RESEARCH.md](./SDK-ARCHITECTURE-RESEARCH.md) for details

---

## 📊 SDK Research Summary

### SDKs Analyzed

1. **Uniswap SDK** (v3/v4) — DEX protocol, library-agnostic, immutable objects
2. **Aave SDK** — Lending protocol, service pattern, ethers v5
3. **Safe SDK** — Smart accounts, adapter pattern, monorepo pioneer
4. **Across Protocol SDK** — Cross-chain bridge, viem-native, functional API
5. **Hyperlane SDK** — Interchain messaging, multi-chain coordinator
6. **Alchemy SDK** — Infrastructure provider, namespace organization
7. **thirdweb SDK** — Web3 platform, v5 rewrite (class → functional)

### Key Findings

**Industry Consensus (2025-2026):**
- ✅ **Monorepo:** pnpm + Turborepo (90%+ adoption)
- ✅ **Types:** abitype over TypeChain (creator endorsement)
- ✅ **Provider:** viem over ethers for new projects (70%+ new SDKs)
- ✅ **Adapters:** Multi-library support via adapter pattern
- ✅ **Build:** tsup (20x faster than Rollup) or Turborepo orchestration

**AEGIS SDK Blueprint:**
- **Structure:** Monorepo (types, abis, sdk, examples)
- **Tech:** pnpm + Turborepo + tsup + abitype + viem (ethers adapter)
- **API:** Hybrid (functional for tree-shaking + client for convenience)
- **Timeline:** 12 weeks to v1.0

### Competitive Advantages

**What makes AEGIS SDK unique:**
1. **ERC-8004 first-class support** — Only SDK with native agent registry integration
2. **x402 HTTP payments** — Simplifies agent-to-agent stablecoin transfers
3. **Validation templates** — Pre-built logic for common job types
4. **Multi-standard composition** — ERC-8004 + x402 + ERC-4337 in one SDK

---

## 🏗 Project Status

### Smart Contracts (Phase 1) ✅
- [x] Core contracts written (Escrow, Dispute, Treasury, Factory)
- [x] 202 tests passing
- [x] Base Sepolia deployment
- [ ] Mainnet deployment (pending audit)

### TypeScript SDK (Phase 2) 🚧
- [x] Research complete (February 2026)
- [ ] Monorepo setup
- [ ] Provider adapters
- [ ] Service modules
- [ ] Unified client
- [ ] Tests + docs
- [ ] npm publish

### Integration Examples (Phase 3) 📋
- [ ] viem example
- [ ] ethers v6 example
- [ ] LangChain agent
- [ ] AutoGPT integration
- [ ] CrewAI integration

### Mainnet Launch (Phase 4) 🎯
- [ ] Security audit
- [ ] Partner integrations
- [ ] Documentation site
- [ ] Launch campaign

---

## 🔗 External Links

### Protocol Resources
- **GitHub:** [aegis-protocol](https://github.com/usmi-labs/aegis-protocol) (private)
- **Contracts:** Base Sepolia deployment (see deployment logs)
- **Standards:**
  - [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004) (Trustless Agents)
  - [x402 Documentation](https://docs.cdp.coinbase.com/x402/docs) (Coinbase Payments)

### SDK Inspiration
- [Uniswap SDKs](https://github.com/Uniswap/sdks)
- [Safe Core SDK](https://github.com/safe-global/safe-core-sdk)
- [thirdweb JS](https://github.com/thirdweb-dev/js)
- [Across Protocol SDK](https://github.com/across-protocol/sdk)
- [Hyperlane Monorepo](https://github.com/hyperlane-xyz/hyperlane-monorepo)

### Tools & Libraries
- [viem](https://viem.sh) — TypeScript interface for Ethereum
- [abitype](https://abitype.dev/) — Strict TypeScript types for ABIs
- [Turborepo](https://turbo.build/repo/docs) — Monorepo build system
- [tsup](https://tsup.egoist.dev/) — Fast TypeScript bundler

---

## 📝 Contributing

### Documentation Guidelines

**Adding new documentation:**
1. Follow existing naming conventions (`TOPIC-DESCRIPTION.md`)
2. Update this README.md with links
3. Keep technical depth appropriate for audience
4. Include code examples where relevant
5. Cross-reference related documents

**SDK Research Updates:**
- Update SDK-RESEARCH-SUMMARY.md for high-level changes
- Update SDK-ARCHITECTURE-RESEARCH.md for detailed analysis
- Update SDK-COMPARISON-TABLE.md for quick reference data
- Update SDK-CODE-EXAMPLES.md for implementation patterns

**Markdown Style:**
- Use H2 (`##`) for main sections
- Use H3 (`###`) for subsections
- Use tables for comparisons
- Use code blocks with language tags
- Use emoji sparingly for visual navigation (📚 🎯 ✅ 🚧 etc.)

### Document Lifecycle

**Status Indicators:**
- ✅ **Complete** — Reviewed and approved
- 🚧 **In Progress** — Being actively written
- 📋 **Planned** — On roadmap, not started
- 🎯 **Priority** — Needs attention soon
- ⚠️ **Outdated** — Needs updating

---

## 🏢 About USMI Labs

**US Machine Intelligence Labs** — Intelligence systems for scaling organizations

**AEGIS Protocol** is a USMI Labs project building trustless escrow infrastructure for the AI agent economy. Part of a broader portfolio of operational intelligence products.

**Contact:** shamim@usmilabs.com

---

## 📄 License

MIT License — See LICENSE file for details

---

**Last Updated:** February 15, 2026
**Version:** 0.1.0 (Pre-release)
