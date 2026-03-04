# @aegis-protocol/langchain

LangChain tool adapters for the AEGIS Protocol SDK.

## What It Provides

- `createAegisLangChainTools(options)`
  - Read tools: `aegis_check_balance`, `aegis_lookup_agent`, `aegis_check_job`
  - Optional write tools: `aegis_approve_escrow`, `aegis_create_job`, `aegis_submit_deliverable`

## Quick Usage

```ts
import { AegisClient } from "@aegis-protocol/sdk";
import { createAegisLangChainTools } from "@aegis-protocol/langchain";

const client = AegisClient.readOnly({ chain: "base-sepolia" });

const tools = createAegisLangChainTools({
  client,
  chain: "base-sepolia",
  enableWriteTools: false,
});
```

For a full runnable agent example, see:
- `sdk/examples/langchain-agent.ts`
