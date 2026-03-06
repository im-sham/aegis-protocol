/**
 * AEGIS Protocol — LangChain/LangGraph Agent Example
 *
 * This example wires AEGIS escrow tools into a ReAct agent.
 *
 * Read-only mode (no signing):
 *   OPENAI_API_KEY=... npm run langchain-agent -- "Check job 0x... status"
 *
 * Read-write mode (enables escrow writes):
 *   OPENAI_API_KEY=... AEGIS_PRIVATE_KEY=0x... npm run langchain-agent -- "Approve 5 USDC for escrow and create a job..."
 */

import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createPublicClient, createWalletClient, http, fallback } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { AegisClient, CHAIN_CONFIGS, type Hex } from "@aegis-protocol/sdk";
import { createAegisLangChainTools } from "@aegis-protocol/langchain";

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const RPC_URLS = [
  process.env.AEGIS_RPC_URL,
  process.env.BASE_SEPOLIA_RPC_URL_PRIMARY,
  process.env.BASE_SEPOLIA_RPC_URL_SECONDARY,
  CHAIN_CONFIGS["base-sepolia"].rpcUrl,
].filter(Boolean) as string[];

function getPromptFromArgs(): string {
  const prompt = process.argv.slice(2).join(" ").trim();
  if (prompt.length > 0) return prompt;
  return [
    "Run an AEGIS preflight on Base Sepolia:",
    "1) call aegis_should_i_escrow for a $75 code-review job from a new provider that requires objective validation,",
    "2) lookup agent 1 reputation,",
    "3) check balance for my signer (or ask for address if read-only),",
    "4) summarize whether it's safe to create a new escrow job right now.",
  ].join(" ");
}

function createTransport() {
  const transports = RPC_URLS.map((rpcUrl) => http(rpcUrl, { timeout: 20_000 }));
  return transports.length === 1 ? transports[0] : fallback(transports);
}

function createAegisClient(): { client: AegisClient; writeEnabled: boolean } {
  const privateKey = process.env.AEGIS_PRIVATE_KEY as Hex | undefined;
  const transport = createTransport();
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport,
  });

  if (!privateKey) {
    return {
      client: AegisClient.readOnly({
        chain: "base-sepolia",
        rpcUrls: RPC_URLS,
      }),
      writeEnabled: false,
    };
  }

  const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: baseSepolia,
    transport,
  });

  return {
    client: AegisClient.fromViem({
      walletClient,
      publicClient,
      chain: "base-sepolia",
    }),
    writeEnabled: true,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const prompt = getPromptFromArgs();
  const { client, writeEnabled } = createAegisClient();
  const tools = createAegisLangChainTools({
    client,
    chain: "base-sepolia",
    enableWriteTools: writeEnabled,
  });

  const llm = new ChatOpenAI({
    model: OPENAI_MODEL,
    temperature: 0,
  });

  const agent = createReactAgent({
    llm,
    tools,
  });

  console.log(`Mode: ${writeEnabled ? "read-write" : "read-only"}`);
  console.log(`Prompt: ${prompt}\n`);

  const result = await agent.invoke({
    messages: [{ role: "user", content: prompt }],
  });

  const messages = result.messages as Array<{ content: unknown }>;
  const last = messages[messages.length - 1];
  console.log("Agent response:\n");
  console.log(
    typeof last?.content === "string"
      ? last.content
      : JSON.stringify(last?.content, null, 2),
  );
}

main().catch((error) => {
  console.error("LangChain example failed:", error);
  process.exit(1);
});
