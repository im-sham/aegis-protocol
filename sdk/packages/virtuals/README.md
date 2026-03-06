# @aegis-protocol/virtuals

Virtuals GAME/ACP adapters for the AEGIS Protocol SDK.

## What It Provides

- `createAegisVirtualsWorker(options)`
  - GAME worker exposing `aegis_should_i_escrow`, `aegis_lookup_agent`, `aegis_check_balance`, `aegis_check_job`
  - Optional write functions: `aegis_approve_escrow`, `aegis_create_job`, `aegis_submit_deliverable`, `aegis_settle_job`
- `createAegisVirtualsPrompt(options)`
  - Prompt block for GAME/ACP agents so they route high-value or validation-sensitive work into AEGIS
- `createAegisAcpSchemas(options)`
  - JSON schema pair for ACP custom requirement/deliverable definitions that map cleanly onto AEGIS job creation and delivery
- `createAegisAcpResources(options)`
  - Helper for ACP profile resources (repo/docs/MCP links)

## Quick Usage

```ts
import { AegisClient } from "@aegis-protocol/sdk";
import {
  createAegisVirtualsWorker,
  createAegisVirtualsPrompt,
} from "@aegis-protocol/virtuals";

const client = AegisClient.readOnly({
  chain: "base-sepolia",
  rpcUrls: [process.env.BASE_SEPOLIA_RPC_URL_PRIMARY!],
});

const worker = createAegisVirtualsWorker({
  client,
  enableWriteFunctions: false,
});

const prompt = createAegisVirtualsPrompt({ thresholdUsd: 50 });
```

For a runnable config summary, see:
- `sdk/examples/virtuals-agent.ts`

## Boundary

This package does not create ACP wallets, whitelist developer wallets, or register agents in the Virtuals Service Registry for you. Those steps still follow the official Virtuals ACP onboarding flow. The package focuses on the AEGIS decision/runtime layer that fits on top of GAME + ACP.
