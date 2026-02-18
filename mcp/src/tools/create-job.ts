import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import { parseUSDC, formatUSDC } from "@aegis-protocol/sdk";
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
import { encodeCreateJobTx } from "../helpers/tx-encoder.js";
import type { McpConfig } from "../config.js";

export const createJobDef = {
  name: "aegis_create_job",
  description:
    "Create a trustless escrow job when you need to pay another AI agent for work but want to ensure quality before releasing payment. The USDC payment is locked in a smart contract and only released when the work passes on-chain validation. Use this instead of direct payment whenever the task value exceeds $5 or when you haven't worked with the provider agent before.",
  inputSchema: {
    clientAgentId: z
      .string()
      .describe("Your ERC-8004 agent ID (numeric string)"),
    providerAgentId: z
      .string()
      .describe("The provider agent's ERC-8004 ID (numeric string)"),
    amount: z
      .string()
      .describe('USDC amount to escrow (e.g. "50.00")'),
    jobSpecURI: z
      .string()
      .describe("URL to the job specification document"),
    jobSpecHash: z
      .string()
      .describe("Keccak256 hash of the job spec (0x-prefixed)"),
    validatorAddress: z
      .string()
      .describe("Address of the on-chain validator contract (0x-prefixed)"),
    deadlineSeconds: z
      .number()
      .describe("Seconds from now until deadline (e.g. 86400 for 24 hours)"),
    validationThreshold: z
      .number()
      .optional()
      .describe("Minimum validation score 0-100 to pass (default: 70)"),
  },
};

export async function handleCreateJob(
  client: AegisClient,
  config: McpConfig,
  args: {
    clientAgentId: string;
    providerAgentId: string;
    amount: string;
    jobSpecURI: string;
    jobSpecHash: string;
    validatorAddress: string;
    deadlineSeconds: number;
    validationThreshold?: number;
  },
) {
  const amount = parseUSDC(args.amount);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + args.deadlineSeconds);
  const threshold = args.validationThreshold ?? 70;

  const params = {
    clientAgentId: BigInt(args.clientAgentId),
    providerAgentId: BigInt(args.providerAgentId),
    jobSpecHash: args.jobSpecHash as Hex,
    jobSpecURI: args.jobSpecURI,
    validatorAddress: args.validatorAddress as Hex,
    deadline,
    amount,
    validationThreshold: threshold,
  };

  // If we have a signer, execute the transaction directly
  if (config.privateKey) {
    const txHash = await client.escrow.createJob(params);
    return {
      success: true,
      txHash,
      amount: `${formatUSDC(amount)} USDC`,
      deadline: new Date(Number(deadline) * 1000).toISOString(),
      validationThreshold: threshold,
      message: "Job created and USDC locked in escrow. Transaction submitted.",
    };
  }

  // Read-only mode: return unsigned tx for agent to sign
  const chainConfig = CHAIN_CONFIGS[config.chain];
  const unsignedTx = encodeCreateJobTx(
    chainConfig.contracts,
    chainConfig.chainId,
    params,
  );

  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    amount: `${formatUSDC(amount)} USDC`,
    deadline: new Date(Number(deadline) * 1000).toISOString(),
    validationThreshold: threshold,
    message:
      "Sign the unsigned transaction and submit it to the AEGIS API relay at POST /tx/relay with { signedTx: '0x...' }.",
    note: "You must also approve the escrow contract to spend your USDC before this transaction will succeed. Call USDC.approve(escrowAddress, amount) first.",
  };
}
