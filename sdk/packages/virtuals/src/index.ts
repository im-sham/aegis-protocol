import {
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
  GameFunction,
  GameWorker,
} from "@virtuals-protocol/game";
import {
  AegisClient,
  CHAIN_CONFIGS,
  formatUSDC,
  JobState,
  parseUSDC,
  type Hex,
  type Job,
  type SupportedChain,
} from "@aegis-protocol/sdk";

const HEX_40_REGEX = /^0x[a-fA-F0-9]{40}$/;
const HEX_64_REGEX = /^0x[a-fA-F0-9]{64}$/;
const INTEGER_REGEX = /^\d+$/;

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

const DEFAULT_HIGH_RISK_JOB_KEYWORDS = [
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

const DEFAULT_LOW_RISK_JOB_KEYWORDS = [
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

type ClientResolver =
  | AegisClient
  | Promise<AegisClient>
  | (() => AegisClient | Promise<AegisClient>);

export interface CreateAegisVirtualsWorkerOptions {
  client: ClientResolver;
  chain?: SupportedChain;
  enableWriteFunctions?: boolean;
  defaultDeadlineSeconds?: number;
  defaultValidationThreshold?: number;
  workerId?: string;
  workerName?: string;
  workerDescription?: string;
}

export interface CreateAegisVirtualsPromptOptions {
  thresholdUsd?: number;
  highRiskKeywords?: string[];
  lowRiskKeywords?: string[];
}

export interface CreateAegisAcpResourcesOptions {
  thresholdUsd?: number;
  repoUrl?: string;
  docsUrl?: string;
  mcpUrl?: string;
}

export interface CreateAegisAcpSchemasOptions {
  defaultValidationThreshold?: number;
}

export interface AegisAcpResource {
  name: string;
  description: string;
  url: string;
  parameters?: Record<string, unknown>;
}

export interface AegisAcpSchemas {
  requirementSchema: Record<string, unknown>;
  deliverableSchema: Record<string, unknown>;
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

function getClientPromise(resolver: ClientResolver): Promise<AegisClient> {
  if (typeof resolver === "function") {
    return Promise.resolve(resolver());
  }
  return Promise.resolve(resolver);
}

async function resolveAddress(client: AegisClient, address?: string): Promise<Hex> {
  if (address) return address as Hex;
  try {
    return await client.getAddress();
  } catch {
    throw new Error(
      "Address is required for read-only clients. Pass `address` explicitly or use a signer-backed client.",
    );
  }
}

function parseRequiredInteger(value: string | undefined, label: string): bigint {
  if (!value || !INTEGER_REGEX.test(value)) {
    throw new Error(`${label} must be an unsigned integer string.`);
  }
  return BigInt(value);
}

function parseRequiredHex(value: string | undefined, regex: RegExp, label: string): Hex {
  if (!value || !regex.test(value)) {
    throw new Error(`${label} is required and must be a 0x-prefixed hex value.`);
  }
  return value as Hex;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  throw new Error(`Expected a boolean-like value, received "${value}".`);
}

function parseOptionalNumber(value: string | undefined, label: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be numeric.`);
  }
  return parsed;
}

function parseOptionalInteger(value: string | undefined, label: string): number | undefined {
  const parsed = parseOptionalNumber(value, label);
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }
  return parsed;
}

function makeSuccess(payload: Record<string, unknown>) {
  return new ExecutableGameFunctionResponse(
    ExecutableGameFunctionStatus.Done,
    JSON.stringify(payload, null, 2),
  );
}

function makeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return new ExecutableGameFunctionResponse(
    ExecutableGameFunctionStatus.Failed,
    message,
  );
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

  if (DEFAULT_HIGH_RISK_JOB_KEYWORDS.some((keyword) => jobType.includes(keyword))) {
    score += 2;
    rationale.push("Job type matches high-risk work keywords.");
  }

  if (DEFAULT_LOW_RISK_JOB_KEYWORDS.some((keyword) => jobType.includes(keyword))) {
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
    recommendedFunctions:
      recommendation === "NOT_NECESSARY"
        ? ["aegis_lookup_agent"]
        : [
            "aegis_lookup_agent",
            "aegis_check_balance",
            "aegis_create_job",
          ],
  };
}

function buildWorkerDescription(): string {
  return [
    "Use this worker when an ACP or GAME task may need escrow, counterparty verification, or a tracked on-chain settlement path.",
    "Start with aegis_should_i_escrow for any outsourced task above roughly $50 or any job that needs objective validation before payment release.",
    "Then use aegis_lookup_agent and aegis_check_balance before aegis_create_job.",
    "Use the write functions only when the runtime is connected to a signing wallet.",
  ].join(" ");
}

export function createAegisVirtualsPrompt(
  options: CreateAegisVirtualsPromptOptions = {},
): string {
  const thresholdUsd = options.thresholdUsd ?? 50;
  const highRiskKeywords = options.highRiskKeywords ?? DEFAULT_HIGH_RISK_JOB_KEYWORDS;
  const lowRiskKeywords = options.lowRiskKeywords ?? DEFAULT_LOW_RISK_JOB_KEYWORDS;

  return [
    `AEGIS is the escrow and validation layer for high-value agent work. Use it by default when job value is at least $${thresholdUsd}, when the deliverable needs objective validation, or when the counterparty is new or low-reputation.`,
    `Treat these as higher-risk keywords that usually justify escrow: ${highRiskKeywords.join(", ")}.`,
    `Treat these as lower-risk keywords that may not need escrow unless value is still high: ${lowRiskKeywords.join(", ")}.`,
    "Preferred sequence: aegis_should_i_escrow -> aegis_lookup_agent -> aegis_check_balance -> aegis_create_job -> aegis_submit_deliverable -> aegis_settle_job.",
    "Agent-first does not mean human-free: ACP wallet setup, whitelisting, and agent registry configuration are still operator responsibilities.",
  ].join(" ");
}

export function createAegisAcpResources(
  options: CreateAegisAcpResourcesOptions = {},
): AegisAcpResource[] {
  const thresholdUsd = options.thresholdUsd ?? 50;
  const resources: AegisAcpResource[] = [];

  if (options.repoUrl) {
    resources.push({
      name: "AEGIS Protocol Repository",
      description: "Contracts, SDK packages, and integration references for escrow-protected agent commerce.",
      url: options.repoUrl,
    });
  }

  if (options.docsUrl) {
    resources.push({
      name: "AEGIS Escrow Decision Guide",
      description: `Decision surface for when ACP work should route into escrow, especially above $${thresholdUsd}.`,
      url: options.docsUrl,
      parameters: { thresholdUsd },
    });
  }

  if (options.mcpUrl) {
    resources.push({
      name: "AEGIS MCP Server",
      description: "Machine-readable AEGIS tools for advisory checks and escrow execution from agent runtimes.",
      url: options.mcpUrl,
    });
  }

  return resources;
}

export function createAegisAcpSchemas(
  options: CreateAegisAcpSchemasOptions = {},
): AegisAcpSchemas {
  const defaultValidationThreshold = options.defaultValidationThreshold ?? 70;

  return {
    requirementSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "jobType",
        "scope",
        "acceptanceCriteria",
        "amountUSDC",
        "clientAgentId",
        "providerAgentId",
        "jobSpecURI",
        "jobSpecHash",
        "validatorAddress",
      ],
      properties: {
        jobType: {
          type: "string",
          description: "Short work category such as code-review, research, or integration.",
        },
        scope: {
          type: "string",
          description: "What the provider is expected to deliver.",
        },
        acceptanceCriteria: {
          type: "string",
          description: "Objective pass/fail standard used by the buyer or evaluator.",
        },
        amountUSDC: {
          type: "string",
          description: "USDC amount to escrow, represented as a decimal string.",
        },
        clientAgentId: {
          type: "string",
          pattern: "^\\d+$",
          description: "ERC-8004 agent ID for the buyer/client.",
        },
        providerAgentId: {
          type: "string",
          pattern: "^\\d+$",
          description: "ERC-8004 agent ID for the provider/seller.",
        },
        jobSpecURI: {
          type: "string",
          format: "uri",
          description: "URI for the full work specification stored off-chain.",
        },
        jobSpecHash: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{64}$",
          description: "Hash commitment for the job specification.",
        },
        validatorAddress: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{40}$",
          description: "Validator contract or designated validator address.",
        },
        requiresObjectiveValidation: {
          type: "boolean",
          description: "Whether the deliverable should be validated before funds release.",
        },
        validationThreshold: {
          type: "integer",
          minimum: 0,
          maximum: 100,
          default: defaultValidationThreshold,
          description: "Minimum validation score required for settlement.",
        },
        deadlineSeconds: {
          type: "integer",
          minimum: 60,
          maximum: 2592000,
          description: "Job deadline relative to creation time, in seconds.",
        },
      },
    },
    deliverableSchema: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "deliverableURI", "deliverableHash"],
      properties: {
        summary: {
          type: "string",
          description: "Short explanation of what was delivered.",
        },
        deliverableURI: {
          type: "string",
          format: "uri",
          description: "Canonical URI for the deliverable artifact.",
        },
        deliverableHash: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{64}$",
          description: "Hash commitment for the deliverable artifact.",
        },
        evidenceURI: {
          type: "string",
          format: "uri",
          description: "Optional URI for supporting evidence, logs, or proofs.",
        },
        validationNotes: {
          type: "string",
          description: "Optional notes for the buyer or evaluator.",
        },
      },
    },
  };
}

export function createAegisVirtualsFunctions(
  options: CreateAegisVirtualsWorkerOptions,
): GameFunction<any>[] {
  const clientPromise = getClientPromise(options.client);
  const chain = options.chain ?? "base-sepolia";
  const defaultDeadlineSeconds = options.defaultDeadlineSeconds ?? 86_400;
  const defaultValidationThreshold = options.defaultValidationThreshold ?? 70;
  const escrowAddress = CHAIN_CONFIGS[chain].contracts.escrow;

  const readFunctions = [
    new GameFunction({
      name: "aegis_should_i_escrow",
      description:
        "Decide whether a Virtuals ACP/GAME task should route through AEGIS escrow before payment.",
      hint:
        "Use before initiating ACP work, especially for outsourced tasks above $50 or any work needing objective validation.",
      args: [
        {
          name: "transactionValueUsd",
          type: "number",
          description: "Estimated USD value of the task.",
        },
        {
          name: "providerReputationScore",
          type: "number",
          description: "Optional 0-100 reputation score for the provider.",
          optional: true,
        },
        {
          name: "jobType",
          type: "string",
          description: "Short category such as code-review, research, or swap.",
        },
        {
          name: "previousInteractions",
          type: "number",
          description: "How many prior successful transactions you have with this provider.",
          optional: true,
        },
        {
          name: "requiresObjectiveValidation",
          type: "boolean",
          description: "Whether the deliverable needs objective validation before payment release.",
          optional: true,
        },
      ] as const,
      executable: async (args) => {
        try {
          const transactionValueUsd = parseOptionalNumber(
            args.transactionValueUsd,
            "transactionValueUsd",
          );
          if (transactionValueUsd === undefined || transactionValueUsd < 0) {
            throw new Error("transactionValueUsd must be a non-negative number.");
          }
          const providerReputationScore = parseOptionalNumber(
            args.providerReputationScore,
            "providerReputationScore",
          );
          const previousInteractions = parseOptionalInteger(
            args.previousInteractions,
            "previousInteractions",
          );
          const requiresObjectiveValidation = parseOptionalBoolean(
            args.requiresObjectiveValidation,
          );
          const jobType = (args.jobType ?? "").trim();
          if (jobType.length < 2) {
            throw new Error("jobType must be at least 2 characters.");
          }

          return makeSuccess({
            input: {
              transactionValueUsd,
              providerReputationScore,
              jobType,
              previousInteractions,
              requiresObjectiveValidation,
            },
            ...evaluateEscrowNeed({
              transactionValueUsd,
              providerReputationScore,
              jobType,
              previousInteractions,
              requiresObjectiveValidation,
            }),
          });
        } catch (error) {
          return makeFailure(error);
        }
      },
    }),
    new GameFunction({
      name: "aegis_lookup_agent",
      description:
        "Look up an ERC-8004 agent wallet, owner, and reputation summary before starting escrow.",
      args: [
        {
          name: "agentId",
          type: "string",
          description: "Unsigned integer ERC-8004 agent ID.",
        },
      ] as const,
      executable: async (args) => {
        try {
          const client = await clientPromise;
          const agentId = parseRequiredInteger(args.agentId, "agentId");
          const [wallet, owner, clients] = await Promise.all([
            client.identity.getAgentWallet(agentId),
            client.identity.ownerOf(agentId),
            client.reputation.getClients(agentId),
          ]);
          const summary = await client.reputation.getSummary(agentId, clients);
          const averageScore =
            summary.count > 0n
              ? Number(summary.summaryValue) / 10 ** summary.summaryValueDecimals
              : 0;

          return makeSuccess({
            agentId: agentId.toString(),
            wallet,
            owner,
            feedbackCount: summary.count.toString(),
            averageScore: averageScore.toFixed(2),
            hasReputation: summary.count > 0n,
          });
        } catch (error) {
          return makeFailure(error);
        }
      },
    }),
    new GameFunction({
      name: "aegis_check_balance",
      description:
        "Check USDC balance and AEGIS escrow allowance. In signer mode, address can be omitted.",
      args: [
        {
          name: "address",
          type: "string",
          description: "Optional wallet address to inspect.",
          optional: true,
        },
      ] as const,
      executable: async (args) => {
        try {
          const client = await clientPromise;
          const address = args.address?.trim();
          if (address && !HEX_40_REGEX.test(address)) {
            throw new Error("address must be a 0x-prefixed 40-byte hex address.");
          }
          const resolvedAddress = await resolveAddress(client, address);
          const [balance, allowance] = await Promise.all([
            client.usdc.balanceOf(resolvedAddress),
            client.usdc.allowance(resolvedAddress, escrowAddress),
          ]);
          return makeSuccess({
            address: resolvedAddress,
            usdcBalance: `${formatUSDC(balance)} USDC`,
            usdcBalanceRaw: balance.toString(),
            escrowAllowance: `${formatUSDC(allowance)} USDC`,
            escrowAllowanceRaw: allowance.toString(),
            canCreateJob: balance > 0n && allowance > 0n,
          });
        } catch (error) {
          return makeFailure(error);
        }
      },
    }),
    new GameFunction({
      name: "aegis_check_job",
      description: "Read full on-chain status for an AEGIS escrow job.",
      args: [
        {
          name: "jobId",
          type: "string",
          description: "0x-prefixed 32-byte job ID.",
        },
      ] as const,
      executable: async (args) => {
        try {
          const client = await clientPromise;
          const jobId = parseRequiredHex(args.jobId, HEX_64_REGEX, "jobId");
          const job = await client.escrow.getJob(jobId);
          return makeSuccess(formatJob(jobId, job));
        } catch (error) {
          return makeFailure(error);
        }
      },
    }),
  ];

  if (!options.enableWriteFunctions) {
    return readFunctions;
  }

  const writeFunctions = [
    new GameFunction({
      name: "aegis_approve_escrow",
      description:
        "Approve the AEGIS escrow contract to spend USDC from the connected signer wallet.",
      args: [
        {
          name: "amountUSDC",
          type: "string",
          description: "Decimal USDC amount to approve, such as 5.5.",
        },
      ] as const,
      executable: async (args) => {
        try {
          const client = await clientPromise;
          const amountRaw = parseUSDC((args.amountUSDC ?? "").trim());
          const txHash = await client.usdc.approveEscrow(amountRaw);
          return makeSuccess({
            txHash,
            amount: `${formatUSDC(amountRaw)} USDC`,
            amountRaw: amountRaw.toString(),
            escrowAddress,
          });
        } catch (error) {
          return makeFailure(error);
        }
      },
    }),
    new GameFunction({
      name: "aegis_create_job",
      description:
        "Create and fund an AEGIS escrow job for a Virtuals ACP/GAME workflow using the connected signer wallet.",
      args: [
        {
          name: "clientAgentId",
          type: "string",
          description: "ERC-8004 client agent ID.",
        },
        {
          name: "providerAgentId",
          type: "string",
          description: "ERC-8004 provider agent ID.",
        },
        {
          name: "amountUSDC",
          type: "string",
          description: "Decimal USDC amount to escrow.",
        },
        {
          name: "jobSpecURI",
          type: "string",
          description: "URI for the off-chain job spec.",
        },
        {
          name: "jobSpecHash",
          type: "string",
          description: "0x-prefixed 32-byte hash of the job spec.",
        },
        {
          name: "validatorAddress",
          type: "string",
          description: "0x-prefixed validator address.",
        },
        {
          name: "deadlineSeconds",
          type: "number",
          description: "Optional deadline offset in seconds.",
          optional: true,
        },
        {
          name: "validationThreshold",
          type: "number",
          description: "Optional validation threshold from 0 to 100.",
          optional: true,
        },
        {
          name: "disputeSplit",
          type: "number",
          description: "Optional dispute split percentage (0-100).",
          optional: true,
        },
      ] as const,
      executable: async (args) => {
        try {
          const client = await clientPromise;
          const deadlineSeconds =
            parseOptionalInteger(args.deadlineSeconds, "deadlineSeconds") ??
            defaultDeadlineSeconds;
          const validationThreshold =
            parseOptionalInteger(args.validationThreshold, "validationThreshold") ??
            defaultValidationThreshold;
          const disputeSplit =
            parseOptionalInteger(args.disputeSplit, "disputeSplit") ?? 0;
          const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
          const amount = parseUSDC((args.amountUSDC ?? "").trim());

          const txHash = await client.escrow.createJob({
            clientAgentId: parseRequiredInteger(args.clientAgentId, "clientAgentId"),
            providerAgentId: parseRequiredInteger(
              args.providerAgentId,
              "providerAgentId",
            ),
            amount,
            jobSpecURI: (args.jobSpecURI ?? "").trim(),
            jobSpecHash: parseRequiredHex(args.jobSpecHash, HEX_64_REGEX, "jobSpecHash"),
            validatorAddress: parseRequiredHex(
              args.validatorAddress,
              HEX_40_REGEX,
              "validatorAddress",
            ),
            deadline,
            validationThreshold,
            disputeSplit,
          });

          return makeSuccess({
            txHash,
            amount: `${formatUSDC(amount)} USDC`,
            amountRaw: amount.toString(),
            clientAgentId: args.clientAgentId,
            providerAgentId: args.providerAgentId,
            deadline: new Date(Number(deadline) * 1000).toISOString(),
            validationThreshold,
            disputeSplit,
          });
        } catch (error) {
          return makeFailure(error);
        }
      },
    }),
    new GameFunction({
      name: "aegis_submit_deliverable",
      description:
        "Submit the job deliverable URI/hash for an existing AEGIS escrow job.",
      args: [
        {
          name: "jobId",
          type: "string",
          description: "0x-prefixed 32-byte job ID.",
        },
        {
          name: "deliverableURI",
          type: "string",
          description: "URI for the delivered artifact.",
        },
        {
          name: "deliverableHash",
          type: "string",
          description: "0x-prefixed 32-byte hash of the deliverable.",
        },
      ] as const,
      executable: async (args) => {
        try {
          const client = await clientPromise;
          const jobId = parseRequiredHex(args.jobId, HEX_64_REGEX, "jobId");
          const txHash = await client.escrow.submitDeliverable(jobId, {
            deliverableURI: (args.deliverableURI ?? "").trim(),
            deliverableHash: parseRequiredHex(
              args.deliverableHash,
              HEX_64_REGEX,
              "deliverableHash",
            ),
          });
          return makeSuccess({
            txHash,
            jobId,
            deliverableURI: (args.deliverableURI ?? "").trim(),
            deliverableHash: args.deliverableHash,
          });
        } catch (error) {
          return makeFailure(error);
        }
      },
    }),
    new GameFunction({
      name: "aegis_settle_job",
      description:
        "Settle an AEGIS job after successful delivery. Use confirm or settle_after_window.",
      args: [
        {
          name: "jobId",
          type: "string",
          description: "0x-prefixed 32-byte job ID.",
        },
        {
          name: "action",
          type: "string",
          description: "confirm or settle_after_window.",
        },
      ] as const,
      executable: async (args) => {
        try {
          const client = await clientPromise;
          const jobId = parseRequiredHex(args.jobId, HEX_64_REGEX, "jobId");
          const action = (args.action ?? "").trim();
          if (action !== "confirm" && action !== "settle_after_window") {
            throw new Error("action must be 'confirm' or 'settle_after_window'.");
          }
          const txHash =
            action === "confirm"
              ? await client.escrow.confirmDelivery(jobId)
              : await client.escrow.settleAfterDisputeWindow(jobId);
          return makeSuccess({ jobId, action, txHash });
        } catch (error) {
          return makeFailure(error);
        }
      },
    }),
  ];

  return [...readFunctions, ...writeFunctions];
}

export function createAegisVirtualsWorker(
  options: CreateAegisVirtualsWorkerOptions,
): GameWorker {
  return new GameWorker({
    id: options.workerId ?? "aegis-escrow-operator",
    name: options.workerName ?? "AEGIS Escrow Operator",
    description: options.workerDescription ?? buildWorkerDescription(),
    functions: createAegisVirtualsFunctions(options),
  });
}
