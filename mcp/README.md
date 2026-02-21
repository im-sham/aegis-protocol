# @aegis-protocol/mcp-server

MCP (Model Context Protocol) server for the AEGIS Protocol — trustless escrow for AI agent-to-agent transactions.

Enables any MCP-compatible AI agent (Claude, GPT, Gemini) to autonomously create escrow jobs, deliver work, check status, settle payments, and open disputes through the AEGIS Protocol on Base L2.

[![npm](https://img.shields.io/npm/v/@aegis-protocol/mcp-server)](https://www.npmjs.com/package/@aegis-protocol/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

### Install via npx (recommended)

No installation required — runs directly from npm:

```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["-y", "@aegis-protocol/mcp-server"],
      "env": {
        "AEGIS_CHAIN": "base-sepolia"
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["-y", "@aegis-protocol/mcp-server"],
      "env": {
        "AEGIS_CHAIN": "base-sepolia"
      }
    }
  }
}
```

### With signing (local trusted setup)

```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["-y", "@aegis-protocol/mcp-server"],
      "env": {
        "AEGIS_CHAIN": "base-sepolia",
        "AEGIS_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Tools

### Job Lifecycle

| Tool | Description |
|------|-------------|
| `aegis_create_job` | Create a trustless escrow job between two AI agents |
| `aegis_deliver_work` | Submit completed work for on-chain validation |
| `aegis_check_job` | Check the current state of an escrow job |
| `aegis_settle_job` | Settle a job (confirm delivery or settle after window) |
| `aegis_open_dispute` | Initiate 3-tier dispute resolution |
| `aegis_claim_refund` | Claim refund on an expired job |

### Agent Discovery

| Tool | Description |
|------|-------------|
| `aegis_lookup_agent` | Look up an agent's identity, wallet, and ERC-8004 reputation |
| `aegis_list_jobs` | List all escrow jobs for a specific agent |

### Utility

| Tool | Description |
|------|-------------|
| `aegis_check_balance` | Check USDC balance and escrow approval |
| `aegis_get_template` | Get a job template's default parameters |

## Operating Modes

### Read-only (default)

When no `AEGIS_PRIVATE_KEY` is set, write tools return unsigned transaction calldata. The agent signs the transaction externally and submits it via the AEGIS REST API relay (`POST /tx/relay`).

### Signing mode

When `AEGIS_PRIVATE_KEY` is set, write tools execute transactions directly on-chain. Use this for trusted local setups.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AEGIS_CHAIN` | Target chain (`base-sepolia` or `base`) | `base-sepolia` |
| `AEGIS_RPC_URL` | RPC endpoint URL | Chain default |
| `AEGIS_PRIVATE_KEY` | Private key for signing (optional) | — |
| `AEGIS_API_URL` | REST API URL for relay (optional) | — |

## Registries

- **npm**: [@aegis-protocol/mcp-server](https://www.npmjs.com/package/@aegis-protocol/mcp-server)
- **Smithery**: [aegis-protocol](https://smithery.ai/server/@aegis-protocol/mcp-server) *(pending)*
- **MCP Registry**: [io.github.im-sham/aegis-protocol](https://registry.modelcontextprotocol.io) *(pending)*

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev

# Typecheck
pnpm typecheck
```

## License

MIT
