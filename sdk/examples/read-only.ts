/**
 * AEGIS Protocol — Read-Only Example
 *
 * Demonstrates querying the AEGIS Protocol without a private key.
 * Perfect for dashboards, monitoring, and analytics.
 *
 * Usage:
 *   npx tsx examples/read-only.ts
 */

import { AegisClient, formatUSDC, JobState } from "@aegis-protocol/sdk";

async function main() {
  // Create a read-only client — no wallet needed
  const aegis = AegisClient.readOnly({ chain: "base-sepolia" });

  console.log("AEGIS Protocol — Base Sepolia Dashboard\n");

  // Protocol stats
  const stats = await aegis.escrow.getProtocolStats();
  console.log("📊 Protocol Stats");
  console.log(`   Total jobs created:  ${stats.totalJobsCreated}`);
  console.log(
    `   Total volume settled: ${formatUSDC(stats.totalVolumeSettled)} USDC`
  );

  // Treasury balance
  const treasuryBalance = await aegis.treasury.totalBalance();
  console.log(
    `\n🏦 Treasury Balance: ${formatUSDC(treasuryBalance)} USDC`
  );

  // Check a specific job
  const jobId =
    "0x0000000000000000000000000000000000000000000000000000000000000001";
  const exists = await aegis.escrow.jobExists(jobId);
  console.log(`\n🔍 Job ${jobId.slice(0, 18)}... exists: ${exists}`);

  if (exists) {
    const job = await aegis.escrow.getJob(jobId);
    console.log(`   State: ${JobState[Number(job.state)] ?? job.state}`);
    console.log(`   Amount: ${formatUSDC(job.amount)} USDC`);
    console.log(`   Client Agent: ${job.clientAgentId}`);
    console.log(`   Provider Agent: ${job.providerAgentId}`);
  }

  // Chain info
  const chainId = await aegis.getChainId();
  console.log(`\n⛓️  Chain ID: ${chainId}`);
  console.log(
    `   Read-only mode: no wallet connected (write calls will throw)\n`
  );
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
