# @aegis-protocol/elizaos

ElizaOS plugin adapters for the AEGIS Protocol SDK.

## What It Provides

- `createAegisElizaPlugin(options)`
  - Read actions: `AEGIS_SHOULD_I_ESCROW`, `AEGIS_LOOKUP_AGENT`, `AEGIS_CHECK_BALANCE`, `AEGIS_CHECK_JOB`
  - Optional write actions: `AEGIS_APPROVE_ESCROW`, `AEGIS_CREATE_JOB`, `AEGIS_SUBMIT_DELIVERABLE`, `AEGIS_SETTLE_JOB`
  - Provider: `AEGIS_ESCROW_CONTEXT`

## Runtime Settings

The plugin reads these ElizaOS runtime settings:

- `AEGIS_CHAIN`
- `AEGIS_RPC_URL`
- `AEGIS_RPC_URLS`
- `BASE_SEPOLIA_RPC_URL`
- `BASE_SEPOLIA_RPC_URL_PRIMARY`
- `BASE_SEPOLIA_RPC_URL_SECONDARY`
- `BASE_RPC_URL`
- `BASE_MAINNET_RPC_URL`
- `AEGIS_PRIVATE_KEY`

## Quick Usage

```ts
import { createAegisElizaPlugin } from "@aegis-protocol/elizaos";

export const plugins = [createAegisElizaPlugin()];
```

For a minimal example config, see:
- `sdk/examples/eliza-character.ts`
