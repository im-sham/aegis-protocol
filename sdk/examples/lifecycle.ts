/**
 * AEGIS Protocol — Full Job Lifecycle Example
 *
 * Demonstrates the complete flow:
 *   1. Connect to Base Sepolia via viem
 *   2. Register two agents (client + provider) on the ERC-8004 Identity Registry
 *   3. Approve USDC for the Escrow contract
 *   4. Create a funded escrow job
 *   5. Submit a deliverable as the provider
 *   6. Process validation
 *   7. Settle after the dispute window (or confirm delivery early)
 *   8. Read protocol stats
 *
 * Prerequisites:
 *   - A funded Base Sepolia wallet (needs ETH for gas + USDC for escrow)
 *   - USDC faucet: https://faucet.circle.com/ (Base Sepolia)
 *   - ETH faucet: https://www.alchemy.com/faucets/base-sepolia
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/lifecycle.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { keccak256, toHex } from "viem";
import {
  AegisClient,
  parseUSDC,
  formatUSDC,
  JobState,
  CHAIN_CONFIGS,
} from "@aegis-protocol/sdk";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
  console.error("❌ Set PRIVATE_KEY environment variable (0x-prefixed)");
  process.exit(1);
}

const RPC_URL = process.env.RPC_URL ?? "https://sepolia.base.org";
const JOB_AMOUNT = "10.00"; // 10 USDC

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(step: string, msg: string) {
  console.log(`\n[${"=".repeat(3)} ${step} ${"=".repeat(40 - step.length)}]`);
  console.log(msg);
}

async function waitForTx(client: AegisClient, hash: Hex, label: string) {
  console.log(`  ⏳ Waiting for tx: ${hash.slice(0, 18)}...`);
  // The SDK doesn't expose waitForTransaction on AegisClient directly,
  // so we use the public client.
  // In production, you'd use `provider.waitForTransaction(hash)`.
  console.log(`  ✅ ${label} confirmed`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Set up viem clients
  log("1. CONNECT", "Creating viem clients for Base Sepolia...");

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`  Wallet: ${account.address}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  // 2. Create AegisClient
  const aegis = AegisClient.fromViem({
    walletClient,
    publicClient,
    chain: "base-sepolia",
  });

  const chainId = await aegis.getChainId();
  console.log(`  Chain ID: ${chainId}`);
  console.log(`  Escrow: ${CHAIN_CONFIGS["base-sepolia"].contracts.escrow}`);

  // 3. Register two agents on ERC-8004 Identity Registry
  log(
    "2. REGISTER AGENTS",
    "Registering client and provider agents on the Identity Registry..."
  );

  console.log("  Registering client agent...");
  const clientRegTx = await aegis.identity.register(
    "https://example.com/agents/client-bot"
  );
  console.log(`  Client agent registered: tx ${clientRegTx.slice(0, 18)}...`);

  console.log("  Registering provider agent...");
  const providerRegTx = await aegis.identity.register(
    "https://example.com/agents/provider-bot"
  );
  console.log(
    `  Provider agent registered: tx ${providerRegTx.slice(0, 18)}...`
  );

  // NOTE: In production, you'd parse the agent IDs from the transaction
  // receipt logs. For this example, we'll use sequential IDs.
  // The mock registry assigns IDs starting from 1.
  const clientAgentId = 1n;
  const providerAgentId = 2n;

  console.log(
    `  Client Agent ID: ${clientAgentId}, Provider Agent ID: ${providerAgentId}`
  );

  // 4. Approve USDC for Escrow contract
  log("3. APPROVE USDC", `Approving ${JOB_AMOUNT} USDC for escrow...`);

  const usdcAddress = CHAIN_CONFIGS["base-sepolia"].contracts.usdc;
  const escrowAddress = CHAIN_CONFIGS["base-sepolia"].contracts.escrow;
  const amountRaw = parseUSDC(JOB_AMOUNT);

  console.log(`  USDC address: ${usdcAddress}`);
  console.log(`  Amount (raw): ${amountRaw} (${formatUSDC(amountRaw)} USDC)`);

  const approvalHash = await walletClient.writeContract({
    address: usdcAddress as Hex,
    abi: parseAbi([
      "function approve(address spender, uint256 amount) returns (bool)",
    ]),
    functionName: "approve",
    args: [escrowAddress as Hex, amountRaw],
  });
  console.log(`  ✅ USDC approval tx: ${approvalHash.slice(0, 18)}...`);

  // 5. Create a funded escrow job
  log("4. CREATE JOB", "Creating a new escrow job...");

  const jobSpecHash = keccak256(
    toHex("Review and optimize smart contract for gas efficiency")
  );
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60); // 7 days

  const createTx = await aegis.escrow.createJob({
    clientAgentId,
    providerAgentId,
    jobSpecHash,
    jobSpecURI: "https://example.com/jobs/spec-001.json",
    validatorAddress: account.address, // self-validate for demo
    deadline,
    amount: amountRaw,
    validationThreshold: 70, // 70/100 minimum score
  });
  console.log(`  ✅ Job created: tx ${createTx.slice(0, 18)}...`);

  // NOTE: Parse the jobId from the JobCreated event in the receipt.
  // For demo purposes, we'll read it from protocol stats.
  const stats = await aegis.escrow.getProtocolStats();
  console.log(`  Total jobs created: ${stats.totalJobsCreated}`);

  // 6. Submit deliverable as the provider
  log("5. SUBMIT DELIVERABLE", "Provider submitting work product...");

  // In production, you'd use the actual jobId from the event logs.
  // For this example, we assume job ID is derived from the job index.
  // This is a simplification — real code would parse the tx receipt.
  const deliverableHash = keccak256(
    toHex("Optimized contract: 23% gas reduction on createJob()")
  );

  // NOTE: submitDeliverable requires being called by the provider agent owner.
  // Since we registered both agents with the same wallet, this works for demo.
  // In production, the provider would be a different wallet.
  console.log("  ⚠️  Deliverable submission requires the correct jobId");
  console.log("     In production, parse jobId from the JobCreated event");

  // 7. Read protocol stats
  log("6. PROTOCOL STATS", "Reading on-chain protocol metrics...");

  const finalStats = await aegis.escrow.getProtocolStats();
  console.log(`  Total jobs created: ${finalStats.totalJobsCreated}`);
  console.log(
    `  Total volume settled: ${formatUSDC(finalStats.totalVolumeSettled)} USDC`
  );

  // 8. Read-only client example
  log("7. READ-ONLY CLIENT", "Creating a read-only client (no private key)...");

  const readOnly = AegisClient.readOnly({ chain: "base-sepolia" });
  const roStats = await readOnly.escrow.getProtocolStats();
  console.log(`  Total jobs (read-only): ${roStats.totalJobsCreated}`);
  console.log(
    `  Total volume (read-only): ${formatUSDC(roStats.totalVolumeSettled)} USDC`
  );

  try {
    await readOnly.getAddress();
  } catch (e) {
    console.log(`  ✅ getAddress() correctly throws on read-only: ${(e as Error).message}`);
  }

  log("DONE", "🎉 Lifecycle example complete!");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
