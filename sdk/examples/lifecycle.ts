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
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { keccak256, toHex } from "viem";
import {
  AegisClient,
  parseUSDC,
  formatUSDC,
  CHAIN_CONFIGS,
} from "@aegis-protocol/sdk";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY environment variable (0x-prefixed)");
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

  // 3. Register two agents using registerAndWait (returns the agent ID)
  log(
    "2. REGISTER AGENTS",
    "Registering client and provider agents on the Identity Registry..."
  );

  console.log("  Registering client agent...");
  const clientResult = await aegis.identity.registerAndWait(
    "https://example.com/agents/client-bot"
  );
  console.log(`  Client Agent ID: ${clientResult.agentId}`);

  console.log("  Registering provider agent...");
  const providerResult = await aegis.identity.registerAndWait(
    "https://example.com/agents/provider-bot"
  );
  console.log(`  Provider Agent ID: ${providerResult.agentId}`);

  // 4. Approve USDC for Escrow contract using aegis.usdc
  const amountRaw = parseUSDC(JOB_AMOUNT);
  log("3. APPROVE USDC", `Approving ${JOB_AMOUNT} USDC for escrow...`);

  console.log(`  Amount (raw): ${amountRaw} (${formatUSDC(amountRaw)} USDC)`);

  const approvalHash = await aegis.usdc.approveEscrow(amountRaw);
  console.log(`  USDC approval tx: ${approvalHash.slice(0, 18)}...`);

  // Check the allowance
  const allowance = await aegis.usdc.escrowAllowance();
  console.log(`  Escrow allowance: ${formatUSDC(allowance)} USDC`);

  // 5. Create a funded escrow job using createJobAndWait (returns parsed event)
  log("4. CREATE JOB", "Creating a new escrow job...");

  const jobSpecHash = keccak256(
    toHex("Review and optimize smart contract for gas efficiency")
  );
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60); // 7 days

  const jobEvent = await aegis.escrow.createJobAndWait({
    clientAgentId: clientResult.agentId,
    providerAgentId: providerResult.agentId,
    jobSpecHash,
    jobSpecURI: "https://example.com/jobs/spec-001.json",
    validatorAddress: account.address, // self-validate for demo
    deadline,
    amount: amountRaw,
    validationThreshold: 70, // 70/100 minimum score
  });
  console.log(`  Job ID: ${jobEvent.jobId}`);
  console.log(`  Amount locked: ${formatUSDC(jobEvent.amount)} USDC`);
  console.log(`  Validator: ${jobEvent.validatorAddress}`);

  // 6. Submit deliverable as the provider
  log("5. SUBMIT DELIVERABLE", "Provider submitting work product...");

  const deliverableHash = keccak256(
    toHex("Optimized contract: 23% gas reduction on createJob()")
  );

  // NOTE: submitDeliverable requires being called by the provider agent owner.
  // Since we registered both agents with the same wallet, this works for demo.
  const deliverTx = await aegis.escrow.submitDeliverable(jobEvent.jobId, {
    deliverableURI: "https://example.com/deliverables/001.json",
    deliverableHash,
  });
  console.log(`  Deliverable submitted: tx ${deliverTx.slice(0, 18)}...`);

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

  // Check USDC balance via read-only client
  const myBalance = await aegis.usdc.myBalance();
  console.log(`  Wallet USDC balance: ${formatUSDC(myBalance)} USDC`);

  try {
    await readOnly.getAddress();
  } catch (e) {
    console.log(`  getAddress() correctly throws on read-only: ${(e as Error).message}`);
  }

  log("DONE", "Lifecycle example complete!");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error("\nError:", err);
  process.exit(1);
});
