import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  AegisClient,
  CHAIN_CONFIGS,
  formatUSDC,
  JobState,
  parseUSDC,
  type Job,
  type SupportedChain,
} from "@aegis-protocol/sdk";
import type { Hex } from "@aegis-protocol/sdk";

const HEX_40_REGEX = /^0x[a-fA-F0-9]{40}$/;
const HEX_64_REGEX = /^0x[a-fA-F0-9]{64}$/;

const HIGH_RISK_JOB_KEYWORDS = [
  "code",
  "audit",
  "security",
  "analysis",
  "research",
  "strategy",
  "trading",
  "deploy",
  "integration",
];

const LOW_RISK_JOB_KEYWORDS = [
  "swap",
  "transfer",
  "simple",
  "ping",
  "healthcheck",
  "test",
];

type Recommendation =
  | "STRONGLY_RECOMMENDED"
  | "RECOMMENDED"
  | "OPTIONAL"
  | "NOT_NECESSARY";

const JOB_STATE_LABELS: Record<number, string> = {
  [JobState.CREATED]: "Created",
  [JobState.FUNDED]: "Funded",
  [JobState.DELIVERED]: "Delivered",
  [JobState.VALIDATING]: "Validating",
  [JobState.DISPUTE_WINDOW]: "Dispute window",
  [JobState.SETTLED]: "Settled",
  [JobState.DISPUTED]: "Disputed",
  [JobState.RESOLVED]: "Resolved",
  [JobState.EXPIRED]: "Expired",
  [JobState.REFUNDED]: "Refunded",
  [JobState.CANCELLED]: "Cancelled",
};

export interface CreateAegisLangChainToolsOptions {
  client: AegisClient;
  chain?: SupportedChain;
  enableWriteTools?: boolean;
  defaultDeadlineSeconds?: number;
  defaultValidationThreshold?: number;
}

function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return "N/A";
  return new Date(Number(ts) * 1000).toISOString();
}

function formatJob(jobId: Hex, job: Job) {
  return {
    jobId,
    stateCode: Number(job.state),
    state: JOB_STATE_LABELS[Number(job.state)] ?? `Unknown (${job.state})`,
    amount: `${formatUSDC(job.amount)} USDC`,
    protocolFee: `${Number(job.protocolFeeBps) / 100}%`,
    clientAgentId: job.clientAgentId.toString(),
    providerAgentId: job.providerAgentId.toString(),
    clientAddress: job.clientAddress,
    providerWallet: job.providerWallet,
    validatorAddress: job.validatorAddress,
    validationScore: job.validationScore,
    validationThreshold: job.validationThreshold,
    jobSpecURI: job.jobSpecURI,
    deliverableURI: job.deliverableURI || "Not yet delivered",
    createdAt: formatTimestamp(job.createdAt),
    deadline: formatTimestamp(job.deadline),
    deliveredAt: formatTimestamp(job.deliveredAt),
    settledAt: formatTimestamp(job.settledAt),
    disputeWindowEnd: formatTimestamp(job.disputeWindowEnd),
  };
}

async function resolveAddress(client: AegisClient, address?: string): Promise<Hex> {
  if (address) return address as Hex;
  try {
    return await client.getAddress();
  } catch {
    throw new Error(
      "Address is required for read-only clients. Pass `address` explicitly.",
    );
  }
}

function evaluateEscrowNeed(input: {
  transactionValueUsd: number;
  providerReputationScore?: number;
  jobType: string;
  previousInteractions?: number;
  requiresObjectiveValidation?: boolean;
}) {
  const jobType = input.jobType.toLowerCase();
  const rationale: string[] = [];
  let score = 0;

  if (input.transactionValueUsd >= 100) {
    score += 3;
    rationale.push("Value is at least $100.");
  } else if (input.transactionValueUsd >= 50) {
    score += 2;
    rationale.push("Value is between $50 and $99.");
  } else if (input.transactionValueUsd >= 20) {
    score += 1;
    rationale.push("Value is between $20 and $49.");
  }

  if (input.requiresObjectiveValidation) {
    score += 3;
    rationale.push("Deliverable needs objective validation before payment release.");
  }

  if (HIGH_RISK_JOB_KEYWORDS.some((keyword) => jobType.includes(keyword))) {
    score += 2;
    rationale.push("Job type matches high-risk work keywords.");
  }

  if (LOW_RISK_JOB_KEYWORDS.some((keyword) => jobType.includes(keyword))) {
    score -= 1;
    rationale.push("Job type looks low-risk or easy to verify manually.");
  }

  if ((input.providerReputationScore ?? 100) < 60) {
    score += 2;
    rationale.push("Provider reputation is below 60.");
  }

  if ((input.previousInteractions ?? 0) === 0) {
    score += 1;
    rationale.push("No prior interactions with this counterparty.");
  }

  let recommendation: Recommendation = "NOT_NECESSARY";
  if (score >= 6) recommendation = "STRONGLY_RECOMMENDED";
  else if (score >= 4) recommendation = "RECOMMENDED";
  else if (score >= 2) recommendation = "OPTIONAL";

  return {
    recommendation,
    rationale,
    recommendedTools:
      recommendation === "NOT_NECESSARY"
        ? ["aegis_lookup_agent"]
        : ["aegis_lookup_agent", "aegis_check_balance", "aegis_create_job"],
  };
}

export function createAegisLangChainTools(options: CreateAegisLangChainToolsOptions) {
  const chain = options.chain ?? "base-sepolia";
  const escrowAddress = CHAIN_CONFIGS[chain].contracts.escrow;
  const defaultDeadlineSeconds = options.defaultDeadlineSeconds ?? 86_400;
  const defaultValidationThreshold = options.defaultValidationThreshold ?? 70;
  const client = options.client;

  const readTools = [
    tool(
      async (input) => {
        return {
          input,
          ...evaluateEscrowNeed({
            transactionValueUsd: input.transactionValueUsd,
            providerReputationScore: input.providerReputationScore,
            jobType: input.jobType,
            previousInteractions: input.previousInteractions,
            requiresObjectiveValidation: input.requiresObjectiveValidation,
          }),
        };
      },
      {
        name: "aegis_should_i_escrow",
        description:
          "Advisory entry point for AEGIS. Use this first to decide whether a transaction should route through escrow before payment.",
        schema: z.object({
          transactionValueUsd: z.coerce.number().nonnegative(),
          providerReputationScore: z.coerce.number().min(0).max(100).optional(),
          jobType: z.string().min(2),
          previousInteractions: z.coerce.number().int().min(0).optional(),
          requiresObjectiveValidation: z.coerce.boolean().optional(),
        }),
      },
    ),
    tool(
      async (input) => {
        const address = await resolveAddress(client, input.address);
        const [balance, allowance] = await Promise.all([
          client.usdc.balanceOf(address),
          client.usdc.allowance(address, escrowAddress),
        ]);
        return {
          address,
          usdcBalance: `${formatUSDC(balance)} USDC`,
          usdcBalanceRaw: balance.toString(),
          escrowAllowance: `${formatUSDC(allowance)} USDC`,
          escrowAllowanceRaw: allowance.toString(),
          canCreateJob: balance > 0n && allowance > 0n,
        };
      },
      {
        name: "aegis_check_balance",
        description:
          "Check USDC balance and escrow allowance for an address. In signer mode, `address` can be omitted to use the connected wallet.",
        schema: z.object({
          address: z
            .string()
            .regex(HEX_40_REGEX, "Expected a 0x-prefixed 40-byte hex address")
            .optional(),
        }),
      },
    ),
    tool(
      async (input) => {
        const agentId = BigInt(input.agentId);
        const [wallet, owner, clients] = await Promise.all([
          client.identity.getAgentWallet(agentId),
          client.identity.ownerOf(agentId),
          client.reputation.getClients(agentId),
        ]);
        const summary = await client.reputation.getSummary(agentId, clients);
        const avgScore =
          summary.count > 0n
            ? Number(summary.summaryValue) / 10 ** summary.summaryValueDecimals
            : 0;
        return {
          agentId: input.agentId,
          wallet,
          owner,
          feedbackCount: summary.count.toString(),
          averageScore: avgScore.toFixed(2),
          hasReputation: summary.count > 0n,
        };
      },
      {
        name: "aegis_lookup_agent",
        description:
          "Look up an ERC-8004 agent's wallet/owner plus reputation summary for escrow risk checks.",
        schema: z.object({
          agentId: z
            .string()
            .regex(/^\d+$/, "Agent ID must be an unsigned integer string"),
        }),
      },
    ),
    tool(
      async (input) => {
        const jobId = input.jobId as Hex;
        const job = await client.escrow.getJob(jobId);
        return formatJob(jobId, job);
      },
      {
        name: "aegis_check_job",
        description: "Read full on-chain status for an AEGIS escrow job.",
        schema: z.object({
          jobId: z
            .string()
            .regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte job ID"),
        }),
      },
    ),
  ];

  if (!options.enableWriteTools) return readTools;

  const writeTools = [
    tool(
      async (input) => {
        const amountRaw = parseUSDC(input.amountUSDC);
        const txHash = await client.usdc.approveEscrow(amountRaw);
        return {
          txHash,
          amount: `${formatUSDC(amountRaw)} USDC`,
          amountRaw: amountRaw.toString(),
          escrowAddress,
        };
      },
      {
        name: "aegis_approve_escrow",
        description:
          "Approve AEGIS escrow to spend USDC from the connected signer wallet.",
        schema: z.object({
          amountUSDC: z.string().min(1),
        }),
      },
    ),
    tool(
      async (input) => {
        const amount = parseUSDC(input.amountUSDC);
        const deadlineSeconds = input.deadlineSeconds ?? defaultDeadlineSeconds;
        const threshold =
          input.validationThreshold ?? defaultValidationThreshold;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

        const txHash = await client.escrow.createJob({
          clientAgentId: BigInt(input.clientAgentId),
          providerAgentId: BigInt(input.providerAgentId),
          jobSpecHash: input.jobSpecHash as Hex,
          jobSpecURI: input.jobSpecURI,
          validatorAddress: input.validatorAddress as Hex,
          deadline,
          amount,
          validationThreshold: threshold,
          disputeSplit: input.disputeSplit ?? 0,
        });

        return {
          txHash,
          amount: `${formatUSDC(amount)} USDC`,
          amountRaw: amount.toString(),
          clientAgentId: input.clientAgentId,
          providerAgentId: input.providerAgentId,
          deadline: new Date(Number(deadline) * 1000).toISOString(),
          validationThreshold: threshold,
        };
      },
      {
        name: "aegis_create_job",
        description:
          "Create and fund a new escrow job between a client and provider agent.",
        schema: z.object({
          clientAgentId: z
            .string()
            .regex(/^\d+$/, "Client agent ID must be an unsigned integer string"),
          providerAgentId: z
            .string()
            .regex(
              /^\d+$/,
              "Provider agent ID must be an unsigned integer string",
            ),
          amountUSDC: z.string().min(1),
          jobSpecURI: z.string().url(),
          jobSpecHash: z
            .string()
            .regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte hash"),
          validatorAddress: z
            .string()
            .regex(HEX_40_REGEX, "Expected a 0x-prefixed 40-byte hex address"),
          deadlineSeconds: z.number().int().positive().max(2_592_000).optional(),
          validationThreshold: z.number().int().min(0).max(100).optional(),
          disputeSplit: z.number().int().min(0).max(100).optional(),
        }),
      },
    ),
    tool(
      async (input) => {
        const txHash = await client.escrow.submitDeliverable(
          input.jobId as Hex,
          {
            deliverableURI: input.deliverableURI,
            deliverableHash: input.deliverableHash as Hex,
          },
        );
        return {
          txHash,
          jobId: input.jobId,
          deliverableURI: input.deliverableURI,
        };
      },
      {
        name: "aegis_submit_deliverable",
        description:
          "Submit provider deliverable metadata for a funded escrow job.",
        schema: z.object({
          jobId: z
            .string()
            .regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte job ID"),
          deliverableURI: z.string().url(),
          deliverableHash: z
            .string()
            .regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte hash"),
        }),
      },
    ),
    tool(
      async (input) => {
        const txHash =
          input.action === "confirm"
            ? await client.escrow.confirmDelivery(input.jobId as Hex)
            : await client.escrow.settleAfterDisputeWindow(input.jobId as Hex);

        return {
          txHash,
          jobId: input.jobId,
          action: input.action,
        };
      },
      {
        name: "aegis_settle_job",
        description:
          "Settle an AEGIS job after delivery. Use `confirm` for normal acceptance or `settle_after_window` after the dispute window expires.",
        schema: z.object({
          jobId: z
            .string()
            .regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte job ID"),
          action: z.enum(["confirm", "settle_after_window"]),
        }),
      },
    ),
  ];

  return [...readTools, ...writeTools];
}
