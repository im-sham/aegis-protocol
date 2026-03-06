import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { createPublicClient, createWalletClient, fallback, http } from "viem";
import { z } from "zod";
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
import type {
  Action,
  ActionExample,
  ActionResult,
  HandlerCallback,
  HandlerOptions,
  IAgentRuntime,
  Memory,
  Plugin,
  Provider,
  ProviderResult,
  State,
} from "@elizaos/core";

const HEX_40_REGEX = /^0x[a-fA-F0-9]{40}$/;
const HEX_64_REGEX = /^0x[a-fA-F0-9]{64}$/;

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

const CHAIN_MAP = {
  "base-sepolia": baseSepolia,
  base,
} as const;

export interface CreateAegisElizaPluginOptions {
  chain?: SupportedChain;
  enableWriteActions?: boolean;
  defaultDeadlineSeconds?: number;
  defaultValidationThreshold?: number;
  createClient?: (runtime: IAgentRuntime) => AegisClient | Promise<AegisClient>;
}

interface RuntimeAegisConfig {
  chain: SupportedChain;
  rpcUrls: string[];
  privateKey?: Hex;
}

const clientCache = new WeakMap<IAgentRuntime, Promise<AegisClient>>();

const shouldIEscrowSchema = z.object({
  transactionValueUsd: z.coerce.number().nonnegative(),
  providerReputationScore: z.coerce.number().min(0).max(100).optional(),
  jobType: z.string().min(2),
  previousInteractions: z.coerce.number().int().min(0).optional(),
  requiresObjectiveValidation: z.coerce.boolean().optional(),
});

const lookupAgentSchema = z.object({
  agentId: z.string().regex(/^\d+$/, "Agent ID must be an unsigned integer string"),
});

const checkBalanceSchema = z.object({
  address: z.string().regex(HEX_40_REGEX, "Expected a 0x-prefixed address").optional(),
});

const checkJobSchema = z.object({
  jobId: z.string().regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte job ID"),
});

const approveEscrowSchema = z.object({
  amountUSDC: z.string().min(1),
});

const createJobSchema = z.object({
  clientAgentId: z.string().regex(/^\d+$/, "Client agent ID must be an unsigned integer string"),
  providerAgentId: z.string().regex(/^\d+$/, "Provider agent ID must be an unsigned integer string"),
  amountUSDC: z.string().min(1),
  jobSpecURI: z.string().url(),
  jobSpecHash: z.string().regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte hash"),
  validatorAddress: z.string().regex(HEX_40_REGEX, "Expected a 0x-prefixed address"),
  deadlineSeconds: z.coerce.number().int().positive().max(2_592_000).optional(),
  validationThreshold: z.coerce.number().int().min(0).max(100).optional(),
  disputeSplit: z.coerce.number().int().min(0).max(100).optional(),
});

const submitDeliverableSchema = z.object({
  jobId: z.string().regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte job ID"),
  deliverableURI: z.string().url(),
  deliverableHash: z.string().regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte hash"),
});

const settleJobSchema = z.object({
  jobId: z.string().regex(HEX_64_REGEX, "Expected a 0x-prefixed 32-byte job ID"),
  action: z.enum(["confirm", "settle_after_window"]),
});

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

function runtimeSetting(runtime: IAgentRuntime, key: string): string | undefined {
  const value = runtime.getSetting(key);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const envValue = process.env[key];
  if (!envValue) return undefined;
  const trimmed = envValue.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseRpcList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isValidRpcUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
  }
  return output;
}

function resolveChain(runtime: IAgentRuntime, override?: SupportedChain): SupportedChain {
  const chain = override ?? (runtimeSetting(runtime, "AEGIS_CHAIN") as SupportedChain | undefined) ?? "base-sepolia";
  if (!CHAIN_CONFIGS[chain]) {
    throw new Error(`Unsupported AEGIS chain: ${chain}`);
  }
  return chain;
}

function resolveRuntimeConfig(
  runtime: IAgentRuntime,
  options: CreateAegisElizaPluginOptions,
): RuntimeAegisConfig {
  const chain = resolveChain(runtime, options.chain);
  const candidates = [
    runtimeSetting(runtime, "AEGIS_RPC_URL"),
    ...parseRpcList(runtimeSetting(runtime, "AEGIS_RPC_URLS")),
    ...(chain === "base-sepolia"
      ? [
          runtimeSetting(runtime, "BASE_SEPOLIA_RPC_URL_PRIMARY"),
          runtimeSetting(runtime, "BASE_SEPOLIA_RPC_URL_SECONDARY"),
          runtimeSetting(runtime, "BASE_SEPOLIA_RPC_URL"),
        ]
      : [
          runtimeSetting(runtime, "BASE_RPC_URL"),
          runtimeSetting(runtime, "BASE_MAINNET_RPC_URL"),
        ]),
    CHAIN_CONFIGS[chain].rpcUrl,
  ].filter((value): value is string => typeof value === "string" && isValidRpcUrl(value));

  const rpcUrls = dedupePreserveOrder(candidates);
  const privateKey = runtimeSetting(runtime, "AEGIS_PRIVATE_KEY") as Hex | undefined;
  return { chain, rpcUrls, privateKey };
}

function buildTransport(rpcUrls: string[]) {
  const transports = rpcUrls.map((rpcUrl) =>
    http(rpcUrl, {
      timeout: 20_000,
      retryCount: 1,
      retryDelay: 300,
    }),
  );
  return transports.length === 1 ? transports[0] : fallback(transports);
}

async function createAegisClientFromRuntime(
  runtime: IAgentRuntime,
  options: CreateAegisElizaPluginOptions,
): Promise<AegisClient> {
  if (options.createClient) {
    return await options.createClient(runtime);
  }

  const config = resolveRuntimeConfig(runtime, options);
  if (!config.privateKey) {
    return AegisClient.readOnly({
      chain: config.chain,
      rpcUrls: config.rpcUrls,
    });
  }

  const viemChain = CHAIN_MAP[config.chain];
  const transport = buildTransport(config.rpcUrls);
  const publicClient = createPublicClient({
    chain: viemChain,
    transport,
  });
  const walletClient = createWalletClient({
    account: privateKeyToAccount(config.privateKey),
    chain: viemChain,
    transport,
  });

  return AegisClient.fromViem({
    walletClient,
    publicClient: publicClient as any,
    chain: config.chain,
  });
}

async function getAegisClient(
  runtime: IAgentRuntime,
  options: CreateAegisElizaPluginOptions,
): Promise<AegisClient> {
  if (options.createClient) {
    return options.createClient(runtime);
  }

  const cached = clientCache.get(runtime);
  if (cached) return cached;

  const promise = createAegisClientFromRuntime(runtime, options);
  clientCache.set(runtime, promise);
  return promise;
}

function isWriteEnabled(
  runtime: IAgentRuntime,
  options: CreateAegisElizaPluginOptions,
): boolean {
  if (options.enableWriteActions === false) return false;
  const { privateKey } = resolveRuntimeConfig(runtime, options);
  return Boolean(privateKey);
}

function actionExamples(...texts: string[]): ActionExample[][] {
  return texts.map((text) => [{ name: "operator", content: { text } }]);
}

function mergePreviousResults(options?: HandlerOptions): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const previousResults = options?.actionContext?.previousResults ?? [];
  for (const result of previousResults) {
    if (result.success && result.data && typeof result.data === "object") {
      Object.assign(output, result.data as Record<string, unknown>);
    }
  }
  return output;
}

function stateAegisValues(state?: State): Record<string, unknown> {
  const value = state?.values?.aegis;
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function contentRecord(message: Memory): Record<string, unknown> {
  const content = message.content as Record<string, unknown> | undefined;
  if (content && typeof content === "object") {
    return content;
  }
  return {};
}

function nestedAegisRecord(message: Memory): Record<string, unknown> {
  const content = contentRecord(message);
  const nested = content.aegis;
  if (nested && typeof nested === "object") {
    return nested as Record<string, unknown>;
  }
  return {};
}

function collectActionPayload(
  message: Memory,
  state?: State,
  options?: HandlerOptions,
): Record<string, unknown> {
  return {
    ...mergePreviousResults(options),
    ...stateAegisValues(state),
    ...contentRecord(message),
    ...nestedAegisRecord(message),
  };
}

function inputErrorResult(actionName: string, error: z.ZodError): ActionResult {
  const details = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "input";
    return `${path}: ${issue.message}`;
  });
  const text = `${actionName} requires structured AEGIS input. ${details.join("; ")}`;
  return {
    success: false,
    text,
    error: text,
  };
}

async function sendCallback(
  callback: HandlerCallback | undefined,
  text: string,
): Promise<void> {
  if (!callback) return;
  await callback({ text });
}

function scoreTransactionValue(value: number) {
  if (value >= 500) return { score: 35, reason: "Transaction value is very high (>= $500)." };
  if (value >= 100) return { score: 30, reason: "Transaction value is high (>= $100)." };
  if (value >= 50) return { score: 24, reason: "Transaction value is moderate-to-high (>= $50)." };
  if (value >= 20) return { score: 16, reason: "Transaction value is meaningful (>= $20)." };
  if (value >= 5) return { score: 8, reason: "Transaction value is above micro-payment range (>= $5)." };
  return { score: 3, reason: "Transaction value is low (< $5)." };
}

function scoreReputation(score: number | undefined) {
  if (score === undefined) {
    return { score: 18, reason: "Provider reputation is unknown." };
  }
  if (score <= 40) return { score: 30, reason: "Provider reputation is low (<= 40)." };
  if (score <= 60) return { score: 20, reason: "Provider reputation is below average (<= 60)." };
  if (score <= 75) return { score: 10, reason: "Provider reputation is moderate (<= 75)." };
  return { score: 2, reason: "Provider reputation is strong (> 75)." };
}

function scoreRelationship(previousInteractions: number) {
  if (previousInteractions === 0) {
    return { score: 20, reason: "No prior interactions with this provider." };
  }
  if (previousInteractions <= 2) {
    return { score: 12, reason: "Limited history with this provider (<= 2 interactions)." };
  }
  if (previousInteractions <= 5) {
    return { score: 6, reason: "Some history with this provider (<= 5 interactions)." };
  }
  return { score: 2, reason: "Established history with this provider (> 5 interactions)." };
}

function scoreJobType(jobType: string) {
  const normalized = jobType.toLowerCase();
  if (HIGH_RISK_JOB_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return { score: 15, reason: "Job type is complex or high-impact." };
  }
  if (LOW_RISK_JOB_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return { score: 3, reason: "Job type appears simple or low-risk." };
  }
  return { score: 8, reason: "Job type risk is moderate or unclear." };
}

function recommendationFor(score: number): Recommendation {
  if (score >= 70) return "STRONGLY_RECOMMENDED";
  if (score >= 45) return "RECOMMENDED";
  if (score >= 25) return "OPTIONAL";
  return "NOT_NECESSARY";
}

function recommendedToolsFor(
  recommendation: Recommendation,
  providerReputationScore: number | undefined,
  previousInteractions: number,
): string[] {
  const needsLookup = providerReputationScore === undefined || previousInteractions === 0;
  if (recommendation === "NOT_NECESSARY") {
    return needsLookup ? ["AEGIS_LOOKUP_AGENT"] : [];
  }

  return [
    ...(needsLookup ? ["AEGIS_LOOKUP_AGENT"] : []),
    "AEGIS_CHECK_BALANCE",
    "AEGIS_CREATE_JOB",
  ];
}

interface ActionContext<T> {
  runtime: IAgentRuntime;
  client: AegisClient;
  message: Memory;
  state?: State;
  options?: HandlerOptions;
  callback?: HandlerCallback;
  input: T;
}

interface StructuredActionDefinition<T> {
  name: string;
  description: string;
  similes?: string[];
  examples?: ActionExample[][];
  requiresWrite?: boolean;
  schema: z.ZodType<T>;
  validate?: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
  run: (context: ActionContext<T>) => Promise<ActionResult>;
}

function createStructuredAction<T>(
  definition: StructuredActionDefinition<T>,
  pluginOptions: CreateAegisElizaPluginOptions,
): Action {
  return {
    name: definition.name,
    description: definition.description,
    similes: definition.similes,
    examples: definition.examples,
    validate: async (runtime, message, state) => {
      if (definition.requiresWrite && !isWriteEnabled(runtime, pluginOptions)) {
        return false;
      }
      if (definition.validate) {
        return definition.validate(runtime, message, state);
      }
      return true;
    },
    handler: async (runtime, message, state, handlerOptions, callback) => {
      if (definition.requiresWrite && !isWriteEnabled(runtime, pluginOptions)) {
        const text = `${definition.name} requires AEGIS_PRIVATE_KEY in runtime settings.`;
        await sendCallback(callback, text);
        return {
          success: false,
          text,
          error: text,
        };
      }

      const parsed = definition.schema.safeParse(
        collectActionPayload(message, state, handlerOptions),
      );
      if (!parsed.success) {
        const result = inputErrorResult(definition.name, parsed.error);
        await sendCallback(callback, result.text ?? `${definition.name} input error.`);
        return result;
      }

      try {
        const client = await getAegisClient(runtime, pluginOptions);
        const result = await definition.run({
          runtime,
          client,
          message,
          state,
          options: handlerOptions,
          callback,
          input: parsed.data,
        });
        if (result.text) {
          await sendCallback(callback, result.text);
        }
        return result;
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        const text = `${definition.name} failed: ${messageText}`;
        await sendCallback(callback, text);
        return {
          success: false,
          text,
          error: messageText,
        };
      }
    },
  };
}

export function createAegisElizaProvider(
  options: CreateAegisElizaPluginOptions = {},
): Provider {
  return {
    name: "AEGIS_ESCROW_CONTEXT",
    description:
      "Summarizes when AEGIS escrow should be used and whether the runtime can execute write actions.",
    get: async (runtime, _message, _state): Promise<ProviderResult> => {
      const chain = resolveChain(runtime, options.chain);
      const writeEnabled = isWriteEnabled(runtime, options);
      const text = writeEnabled
        ? `AEGIS escrow is available on ${chain} in signing mode. Use AEGIS_SHOULD_I_ESCROW before direct payment, then AEGIS_CHECK_BALANCE and AEGIS_CREATE_JOB when the transaction should be escrowed.`
        : `AEGIS escrow is available on ${chain} in read-only mode. Use AEGIS_SHOULD_I_ESCROW for advisory decisions and gather signer credentials before attempting write actions.`;
      return {
        text,
        values: {
          aegisChain: chain,
          aegisWriteEnabled: writeEnabled,
        },
        data: {
          chain,
          writeEnabled,
          recommendedEntryAction: "AEGIS_SHOULD_I_ESCROW",
        },
      };
    },
  };
}

export function createAegisElizaActions(
  options: CreateAegisElizaPluginOptions = {},
): Action[] {
  const defaultDeadlineSeconds = options.defaultDeadlineSeconds ?? 86_400;
  const defaultValidationThreshold = options.defaultValidationThreshold ?? 70;

  const readActions: Action[] = [
    createStructuredAction(
      {
        name: "AEGIS_SHOULD_I_ESCROW",
        description:
          "Primary advisory action for agent-to-agent payments. Use this before paying another agent directly or before creating an escrow job.",
        similes: ["aegis_should_i_escrow", "evaluate escrow risk", "should use escrow"],
        examples: actionExamples(
          "Decide whether I should escrow a $120 code review with a new provider. {\"aegis\":{\"transactionValueUsd\":120,\"jobType\":\"code-review\",\"previousInteractions\":0,\"requiresObjectiveValidation\":true}}",
        ),
        schema: shouldIEscrowSchema,
        run: async ({ input }) => {
          const previousInteractions = input.previousInteractions ?? 0;
          const requiresObjectiveValidation = input.requiresObjectiveValidation ?? true;
          const value = scoreTransactionValue(input.transactionValueUsd);
          const reputation = scoreReputation(input.providerReputationScore);
          const relationship = scoreRelationship(previousInteractions);
          const jobType = scoreJobType(input.jobType);
          const validationFit = requiresObjectiveValidation
            ? {
                score: 5,
                reason:
                  "Deliverable is objectively verifiable, which fits escrow and validation well.",
              }
            : {
                score: 1,
                reason:
                  "Deliverable is subjective, so escrow protection is lower but still available.",
              };
          const riskScore =
            value.score +
            reputation.score +
            relationship.score +
            jobType.score +
            validationFit.score;
          const recommendation = recommendationFor(riskScore);
          const recommendedTools = recommendedToolsFor(
            recommendation,
            input.providerReputationScore,
            previousInteractions,
          );
          const suggestedAction =
            recommendation === "NOT_NECESSARY"
              ? "Direct payment may be acceptable for this profile. If trust is still unclear, run AEGIS_LOOKUP_AGENT first."
              : "Use escrow for this transaction. Review provider trust with AEGIS_LOOKUP_AGENT if needed, confirm funding with AEGIS_CHECK_BALANCE, then run AEGIS_CREATE_JOB.";
          return {
            success: true,
            text: `Escrow recommendation: ${recommendation} (risk score ${riskScore}). ${suggestedAction}`,
            data: {
              recommendation,
              riskScore,
              confidence:
                input.providerReputationScore === undefined ? "medium" : "high",
              suggestedAction,
              recommendedTools,
              reasoning: [
                value.reason,
                reputation.reason,
                relationship.reason,
                jobType.reason,
                validationFit.reason,
              ].join(" "),
              factors: {
                transactionValue: value,
                reputation,
                relationship,
                jobType,
                validationFit,
              },
            },
          };
        },
      },
      options,
    ),
    createStructuredAction(
      {
        name: "AEGIS_LOOKUP_AGENT",
        description:
          "Trust-check a provider's ERC-8004 identity and reputation before assigning paid work or deciding whether escrow is necessary.",
        similes: ["aegis_lookup_agent", "lookup provider reputation", "check agent reputation"],
        examples: actionExamples(
          "Look up provider agent 42 before I assign paid work. {\"aegis\":{\"agentId\":\"42\"}}",
        ),
        schema: lookupAgentSchema,
        run: async ({ client, input }) => {
          const agentId = BigInt(input.agentId);
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

          return {
            success: true,
            text: `Agent ${input.agentId} reputation loaded. Average score ${averageScore.toFixed(2)} across ${summary.count.toString()} feedback entries.`,
            data: {
              agentId: input.agentId,
              wallet,
              owner,
              feedbackCount: summary.count.toString(),
              averageScore: averageScore.toFixed(2),
              hasReputation: summary.count > 0n,
            },
          };
        },
      },
      options,
    ),
    createStructuredAction(
      {
        name: "AEGIS_CHECK_BALANCE",
        description:
          "Verify the payer's USDC balance and escrow approval immediately before funding a job.",
        similes: ["aegis_check_balance", "check escrow allowance", "check wallet funding"],
        examples: actionExamples(
          "Check whether my signer can fund escrow right now.",
          "Check balance for 0x1111111111111111111111111111111111111111. {\"aegis\":{\"address\":\"0x1111111111111111111111111111111111111111\"}}",
        ),
        schema: checkBalanceSchema,
        run: async ({ client, input, runtime }) => {
          const chain = resolveChain(runtime, options.chain);
          const address = input.address ?? (await client.getAddress());
          const escrowAddress = CHAIN_CONFIGS[chain].contracts.escrow;
          const [balance, allowance] = await Promise.all([
            client.usdc.balanceOf(address as Hex),
            client.usdc.allowance(address as Hex, escrowAddress),
          ]);
          const canCreateJob = balance > 0n && allowance > 0n;

          return {
            success: true,
            text: `Balance check for ${address}: ${formatUSDC(balance)} USDC balance, ${formatUSDC(allowance)} USDC escrow allowance.`,
            data: {
              address,
              usdcBalance: `${formatUSDC(balance)} USDC`,
              usdcBalanceRaw: balance.toString(),
              escrowAllowance: `${formatUSDC(allowance)} USDC`,
              escrowAllowanceRaw: allowance.toString(),
              canCreateJob,
            },
          };
        },
      },
      options,
    ),
    createStructuredAction(
      {
        name: "AEGIS_CHECK_JOB",
        description:
          "Read full on-chain status for an AEGIS escrow job before delivering work, settling, or opening a dispute.",
        similes: ["aegis_check_job", "check escrow job", "job status"],
        examples: actionExamples(
          "Check job status for 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa. {\"aegis\":{\"jobId\":\"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}}",
        ),
        schema: checkJobSchema,
        run: async ({ client, input }) => {
          const job = await client.escrow.getJob(input.jobId as Hex);
          const formatted = formatJob(input.jobId as Hex, job);
          return {
            success: true,
            text: `Job ${input.jobId} is currently ${formatted.state}.`,
            data: formatted,
          };
        },
      },
      options,
    ),
  ];

  if (options.enableWriteActions === false) {
    return readActions;
  }

  const writeActions: Action[] = [
    createStructuredAction(
      {
        name: "AEGIS_APPROVE_ESCROW",
        description:
          "Approve AEGIS escrow to spend USDC from the connected signer wallet before creating a new funded job.",
        similes: ["approve escrow", "aegis_approve_escrow", "approve usdc"],
        examples: actionExamples(
          "Approve 25 USDC for escrow. {\"aegis\":{\"amountUSDC\":\"25.00\"}}",
        ),
        requiresWrite: true,
        schema: approveEscrowSchema,
        run: async ({ client, input }) => {
          const amount = parseUSDC(input.amountUSDC);
          const txHash = await client.usdc.approveEscrow(amount);
          return {
            success: true,
            text: `Escrow approval submitted for ${formatUSDC(amount)} USDC.`,
            data: {
              txHash,
              amount: `${formatUSDC(amount)} USDC`,
              amountRaw: amount.toString(),
            },
          };
        },
      },
      options,
    ),
    createStructuredAction(
      {
        name: "AEGIS_CREATE_JOB",
        description:
          "Create and fund an escrow job after the transaction has been deemed too risky for direct payment.",
        similes: ["aegis_create_job", "create escrow job", "fund escrow job"],
        examples: actionExamples(
          "Create a 50 USDC escrow job for provider 2. {\"aegis\":{\"clientAgentId\":\"1\",\"providerAgentId\":\"2\",\"amountUSDC\":\"50.00\",\"jobSpecURI\":\"https://example.com/spec\",\"jobSpecHash\":\"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"validatorAddress\":\"0x1111111111111111111111111111111111111111\"}}",
        ),
        requiresWrite: true,
        schema: createJobSchema,
        run: async ({ client, input }) => {
          const amount = parseUSDC(input.amountUSDC);
          const deadlineSeconds = input.deadlineSeconds ?? defaultDeadlineSeconds;
          const validationThreshold =
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
            validationThreshold,
            disputeSplit: input.disputeSplit ?? 0,
          });
          return {
            success: true,
            text: `Escrow job created for ${formatUSDC(amount)} USDC between client ${input.clientAgentId} and provider ${input.providerAgentId}.`,
            data: {
              txHash,
              amount: `${formatUSDC(amount)} USDC`,
              amountRaw: amount.toString(),
              clientAgentId: input.clientAgentId,
              providerAgentId: input.providerAgentId,
              deadline: new Date(Number(deadline) * 1000).toISOString(),
              validationThreshold,
            },
          };
        },
      },
      options,
    ),
    createStructuredAction(
      {
        name: "AEGIS_SUBMIT_DELIVERABLE",
        description:
          "Submit provider deliverable metadata for a funded AEGIS escrow job so validation can begin.",
        similes: ["submit deliverable", "aegis_submit_deliverable", "deliver work"],
        examples: actionExamples(
          "Submit deliverable for a job. {\"aegis\":{\"jobId\":\"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"deliverableURI\":\"https://example.com/deliverable\",\"deliverableHash\":\"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\"}}",
        ),
        requiresWrite: true,
        schema: submitDeliverableSchema,
        run: async ({ client, input }) => {
          const txHash = await client.escrow.submitDeliverable(input.jobId as Hex, {
            deliverableURI: input.deliverableURI,
            deliverableHash: input.deliverableHash as Hex,
          });
          return {
            success: true,
            text: `Deliverable submitted for job ${input.jobId}. Validation can now proceed.`,
            data: {
              txHash,
              jobId: input.jobId,
              deliverableURI: input.deliverableURI,
            },
          };
        },
      },
      options,
    ),
    createStructuredAction(
      {
        name: "AEGIS_SETTLE_JOB",
        description:
          "Settle a completed job either by confirming delivery early or settling after the dispute window closes.",
        similes: ["aegis_settle_job", "settle escrow job", "confirm delivery"],
        examples: actionExamples(
          "Confirm delivery on a completed job. {\"aegis\":{\"jobId\":\"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"action\":\"confirm\"}}",
        ),
        requiresWrite: true,
        schema: settleJobSchema,
        run: async ({ client, input }) => {
          const txHash =
            input.action === "confirm"
              ? await client.escrow.confirmDelivery(input.jobId as Hex)
              : await client.escrow.settleAfterDisputeWindow(input.jobId as Hex);
          return {
            success: true,
            text: `Settlement action ${input.action} submitted for job ${input.jobId}.`,
            data: {
              txHash,
              jobId: input.jobId,
              action: input.action,
            },
          };
        },
      },
      options,
    ),
  ];

  return [...readActions, ...writeActions];
}

export function createAegisElizaPlugin(
  options: CreateAegisElizaPluginOptions = {},
): Plugin {
  const actions = createAegisElizaActions(options);
  const providers = [createAegisElizaProvider(options)];

  return {
    name: "aegis-elizaos",
    description:
      "AEGIS trustless escrow plugin for ElizaOS agent workflows on Base.",
    actions,
    providers,
  };
}

export const aegisElizaPlugin = createAegisElizaPlugin();
