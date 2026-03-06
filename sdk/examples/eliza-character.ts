/**
 * AEGIS Protocol — ElizaOS Character/Plugin Example
 *
 * This file exports a minimal ElizaOS-friendly config snippet that wires in the
 * AEGIS plugin and prints a summary when run directly.
 *
 * Usage:
 *   npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/examples eliza-character
 */

import { fileURLToPath } from "node:url";
import { createAegisElizaPlugin } from "@aegis-protocol/elizaos";

const writeEnabled = Boolean(process.env.AEGIS_PRIVATE_KEY);
const rpcUrls = [
  process.env.AEGIS_RPC_URL,
  process.env.BASE_SEPOLIA_RPC_URL_PRIMARY,
  process.env.BASE_SEPOLIA_RPC_URL_SECONDARY,
].filter(Boolean) as string[];

export const aegisEscrowCharacter = {
  name: "AEGIS Escrow Operator",
  plugins: [createAegisElizaPlugin()],
  settings: {
    AEGIS_CHAIN: process.env.AEGIS_CHAIN ?? "base-sepolia",
    ...(rpcUrls.length > 0 ? { AEGIS_RPC_URLS: rpcUrls.join(",") } : {}),
    ...(process.env.AEGIS_PRIVATE_KEY
      ? { AEGIS_PRIVATE_KEY: process.env.AEGIS_PRIVATE_KEY }
      : {}),
  },
  system:
    "Use AEGIS actions to evaluate escrow risk, verify counterparties, and execute trusted agent-to-agent work on Base.",
};

function main() {
  const plugin = aegisEscrowCharacter.plugins[0];
  console.log(`Mode: ${writeEnabled ? "read-write" : "read-only"}`);
  console.log("ElizaOS AEGIS plugin summary:\n");
  console.log(
    JSON.stringify(
      {
        character: aegisEscrowCharacter.name,
        plugin: plugin.name,
        actions: plugin.actions?.map((action) => action.name) ?? [],
        providers: plugin.providers?.map((provider) => provider.name) ?? [],
        settings: aegisEscrowCharacter.settings,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
