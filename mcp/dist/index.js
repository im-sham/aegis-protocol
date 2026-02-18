#!/usr/bin/env node

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/config.ts
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
function loadConfig() {
  const chain = process.env.AEGIS_CHAIN ?? "base-sepolia";
  if (!CHAIN_CONFIGS[chain]) {
    throw new Error(
      `Unsupported chain: ${chain}. Valid: ${Object.keys(CHAIN_CONFIGS).join(", ")}`
    );
  }
  const rpcUrl = process.env.AEGIS_RPC_URL ?? CHAIN_CONFIGS[chain].rpcUrl;
  return {
    chain,
    rpcUrl,
    privateKey: process.env.AEGIS_PRIVATE_KEY,
    apiUrl: process.env.AEGIS_API_URL
  };
}

// src/sdk-client.ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import { AegisClient } from "@aegis-protocol/sdk";
var CHAIN_MAP = { "base-sepolia": baseSepolia, base };
function createSdkClient(config2) {
  const viemChain = CHAIN_MAP[config2.chain];
  if (config2.privateKey) {
    const account = privateKeyToAccount(config2.privateKey);
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(config2.rpcUrl)
    });
    const walletClient = createWalletClient({
      account,
      chain: viemChain,
      transport: http(config2.rpcUrl)
    });
    return AegisClient.fromViem({
      walletClient,
      publicClient,
      chain: config2.chain
    });
  }
  return AegisClient.readOnly({
    rpcUrl: config2.rpcUrl,
    chain: config2.chain
  });
}
function isSigningClient(config2) {
  return !!config2.privateKey;
}

// src/tools/check-job.ts
import { z } from "zod";

// src/helpers/format.ts
import { JobState, DisputeResolution } from "@aegis-protocol/types";
import { formatUSDC } from "@aegis-protocol/sdk";
var JOB_STATE_LABELS = {
  [JobState.CREATED]: "Created",
  [JobState.FUNDED]: "Funded \u2014 waiting for provider to deliver",
  [JobState.DELIVERED]: "Delivered \u2014 awaiting validation",
  [JobState.VALIDATING]: "Validating on-chain",
  [JobState.DISPUTE_WINDOW]: "Dispute window open (24h)",
  [JobState.SETTLED]: "Settled \u2014 payment released",
  [JobState.DISPUTED]: "Disputed \u2014 under resolution",
  [JobState.RESOLVED]: "Dispute resolved",
  [JobState.EXPIRED]: "Expired \u2014 deadline missed",
  [JobState.REFUNDED]: "Refunded to client",
  [JobState.CANCELLED]: "Cancelled"
};
var DISPUTE_METHOD_LABELS = {
  [DisputeResolution.NONE]: "None",
  [DisputeResolution.RE_VALIDATION]: "Automated re-validation",
  [DisputeResolution.ARBITRATOR]: "Arbitrator ruling",
  [DisputeResolution.TIMEOUT_DEFAULT]: "Timeout default (50/50)",
  [DisputeResolution.CLIENT_CONFIRM]: "Client confirmed"
};
function formatTimestamp(ts) {
  if (ts === 0n) return "N/A";
  return new Date(Number(ts) * 1e3).toISOString();
}
function formatJobForLLM(jobId, job) {
  return {
    jobId,
    state: JOB_STATE_LABELS[job.state] ?? `Unknown (${job.state})`,
    stateCode: job.state,
    clientAgentId: job.clientAgentId.toString(),
    providerAgentId: job.providerAgentId.toString(),
    clientAddress: job.clientAddress,
    providerWallet: job.providerWallet,
    amount: `${formatUSDC(job.amount)} USDC`,
    protocolFee: `${Number(job.protocolFeeBps) / 100}%`,
    validationScore: job.validationScore,
    validationThreshold: job.validationThreshold,
    jobSpecURI: job.jobSpecURI,
    deliverableURI: job.deliverableURI || "Not yet delivered",
    deadline: formatTimestamp(job.deadline),
    createdAt: formatTimestamp(job.createdAt),
    deliveredAt: formatTimestamp(job.deliveredAt),
    settledAt: formatTimestamp(job.settledAt),
    disputeWindowEnd: formatTimestamp(job.disputeWindowEnd),
    resolution: DISPUTE_METHOD_LABELS[job.resolution] ?? `Unknown (${job.resolution})`
  };
}
function formatTemplateForLLM(templateId, template) {
  return {
    templateId,
    name: template.name,
    active: template.active,
    creator: template.creator,
    defaultValidator: template.defaultValidator,
    defaultTimeout: `${Number(template.defaultTimeout) / 3600} hours`,
    fee: `${Number(template.feeBps) / 100}%`,
    minValidationScore: template.minValidation,
    defaultDisputeSplit: template.defaultDisputeSplit
  };
}
function formatReputationForLLM(agentId, summary) {
  const score = summary.count > 0n ? Number(summary.summaryValue) / 10 ** summary.summaryValueDecimals : 0;
  return {
    agentId,
    feedbackCount: summary.count.toString(),
    averageScore: score.toFixed(2),
    hasReputation: summary.count > 0n
  };
}

// src/tools/check-job.ts
var checkJobDef = {
  name: "aegis_check_job",
  description: "Check the current state of an escrow job \u2014 whether it's funded, delivered, in validation, settled, or disputed. Use this to monitor job progress before taking your next action.",
  inputSchema: {
    jobId: z.string().describe("The escrow job ID (0x-prefixed hex string)")
  }
};
async function handleCheckJob(client2, args) {
  const job = await client2.escrow.getJob(args.jobId);
  return formatJobForLLM(args.jobId, job);
}

// src/tools/lookup-agent.ts
import { z as z2 } from "zod";
var lookupAgentDef = {
  name: "aegis_lookup_agent",
  description: "Look up an AI agent's on-chain identity and reputation before creating a job with them. Returns their wallet address, owner, and reputation score from the ERC-8004 registry. Always check reputation before committing funds to a new provider.",
  inputSchema: {
    agentId: z2.string().describe("The ERC-8004 agent ID (numeric string, e.g. '1')")
  }
};
async function handleLookupAgent(client2, args) {
  const id = BigInt(args.agentId);
  const [wallet, owner, clients] = await Promise.all([
    client2.identity.getAgentWallet(id),
    client2.identity.ownerOf(id),
    client2.reputation.getClients(id)
  ]);
  const summary = await client2.reputation.getSummary(id, clients);
  const reputation = formatReputationForLLM(args.agentId, summary);
  return {
    agentId: args.agentId,
    wallet,
    owner,
    exists: true,
    feedbackCount: reputation.feedbackCount,
    averageScore: reputation.averageScore,
    hasReputation: reputation.hasReputation
  };
}

// src/tools/list-jobs.ts
import { z as z3 } from "zod";
var listJobsDef = {
  name: "aegis_list_jobs",
  description: "List all escrow jobs for a specific agent. Use this to review an agent's job history or check your own active jobs.",
  inputSchema: {
    agentId: z3.string().describe("The ERC-8004 agent ID (numeric string, e.g. '1')")
  }
};
async function handleListJobs(client2, args) {
  const id = BigInt(args.agentId);
  const jobIds = await client2.escrow.getAgentJobs(id);
  if (jobIds.length === 0) {
    return { agentId: args.agentId, jobs: [], message: "No jobs found for this agent." };
  }
  const jobs = await Promise.all(
    jobIds.map(async (jobId) => {
      const job = await client2.escrow.getJob(jobId);
      return formatJobForLLM(jobId, job);
    })
  );
  return { agentId: args.agentId, totalJobs: jobs.length, jobs };
}

// src/tools/check-balance.ts
import { z as z4 } from "zod";
import { formatUSDC as formatUSDC2 } from "@aegis-protocol/sdk";
var checkBalanceDef = {
  name: "aegis_check_balance",
  description: "Check an address's USDC balance and current escrow approval amount. Use this before creating a job to verify the client has sufficient funds and has approved the escrow contract.",
  inputSchema: {
    address: z4.string().describe("Ethereum address to check (0x-prefixed)")
  }
};
async function handleCheckBalance(client2, args) {
  const address = args.address;
  const escrowAddress = "0xe988128467299fD856Bb45D2241811837BF35E77";
  const [balance, allowance] = await Promise.all([
    client2.usdc.balanceOf(address),
    client2.usdc.allowance(address, escrowAddress)
  ]);
  return {
    address: args.address,
    usdcBalance: `${formatUSDC2(balance)} USDC`,
    usdcBalanceRaw: balance.toString(),
    escrowAllowance: `${formatUSDC2(allowance)} USDC`,
    escrowAllowanceRaw: allowance.toString(),
    canCreateJob: balance > 0n && allowance > 0n
  };
}

// src/tools/get-template.ts
import { z as z5 } from "zod";
var getTemplateDef = {
  name: "aegis_get_template",
  description: "Get the default parameters for a job template. Templates provide pre-configured validator, timeout, and validation threshold for common job types like code-review or data-analysis. Use a template to create jobs faster with standardized terms.",
  inputSchema: {
    templateId: z5.string().describe("Template ID (numeric string, e.g. '1')")
  }
};
async function handleGetTemplate(client2, args) {
  const id = BigInt(args.templateId);
  const template = await client2.factory.getTemplate(id);
  return formatTemplateForLLM(args.templateId, template);
}

// src/tools/create-job.ts
import { z as z6 } from "zod";
import { parseUSDC, formatUSDC as formatUSDC3 } from "@aegis-protocol/sdk";
import { CHAIN_CONFIGS as CHAIN_CONFIGS2 } from "@aegis-protocol/types";

// src/helpers/tx-encoder.ts
import { encodeFunctionData } from "viem";
import {
  aegisEscrowAbi
} from "@aegis-protocol/abis";
function encodeCreateJobTx(addresses, chainId, args) {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "createJob",
      args: [
        args.clientAgentId,
        args.providerAgentId,
        args.jobSpecHash,
        args.jobSpecURI,
        args.validatorAddress,
        args.deadline,
        args.amount,
        args.validationThreshold
      ]
    }),
    value: "0",
    chainId,
    description: `Create escrow job: ${args.clientAgentId} \u2192 ${args.providerAgentId}`
  };
}
function encodeDeliverWorkTx(addresses, chainId, args) {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "submitDeliverable",
      args: [args.jobId, args.deliverableURI, args.deliverableHash]
    }),
    value: "0",
    chainId,
    description: `Submit deliverable for job ${args.jobId}`
  };
}
function encodeConfirmDeliveryTx(addresses, chainId, jobId) {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "confirmDelivery",
      args: [jobId]
    }),
    value: "0",
    chainId,
    description: `Confirm delivery for job ${jobId}`
  };
}
function encodeSettleAfterWindowTx(addresses, chainId, jobId) {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "settleAfterDisputeWindow",
      args: [jobId]
    }),
    value: "0",
    chainId,
    description: `Settle job ${jobId} after dispute window`
  };
}
function encodeRaiseDisputeTx(addresses, chainId, args) {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "raiseDispute",
      args: [args.jobId, args.evidenceURI, args.evidenceHash]
    }),
    value: "0",
    chainId,
    description: `Raise dispute on job ${args.jobId}`
  };
}
function encodeClaimTimeoutTx(addresses, chainId, jobId) {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "claimTimeout",
      args: [jobId]
    }),
    value: "0",
    chainId,
    description: `Claim timeout refund for job ${jobId}`
  };
}

// src/tools/create-job.ts
var createJobDef = {
  name: "aegis_create_job",
  description: "Create a trustless escrow job when you need to pay another AI agent for work but want to ensure quality before releasing payment. The USDC payment is locked in a smart contract and only released when the work passes on-chain validation. Use this instead of direct payment whenever the task value exceeds $5 or when you haven't worked with the provider agent before.",
  inputSchema: {
    clientAgentId: z6.string().describe("Your ERC-8004 agent ID (numeric string)"),
    providerAgentId: z6.string().describe("The provider agent's ERC-8004 ID (numeric string)"),
    amount: z6.string().describe('USDC amount to escrow (e.g. "50.00")'),
    jobSpecURI: z6.string().describe("URL to the job specification document"),
    jobSpecHash: z6.string().describe("Keccak256 hash of the job spec (0x-prefixed)"),
    validatorAddress: z6.string().describe("Address of the on-chain validator contract (0x-prefixed)"),
    deadlineSeconds: z6.number().describe("Seconds from now until deadline (e.g. 86400 for 24 hours)"),
    validationThreshold: z6.number().optional().describe("Minimum validation score 0-100 to pass (default: 70)")
  }
};
async function handleCreateJob(client2, config2, args) {
  const amount = parseUSDC(args.amount);
  const deadline = BigInt(Math.floor(Date.now() / 1e3) + args.deadlineSeconds);
  const threshold = args.validationThreshold ?? 70;
  const params = {
    clientAgentId: BigInt(args.clientAgentId),
    providerAgentId: BigInt(args.providerAgentId),
    jobSpecHash: args.jobSpecHash,
    jobSpecURI: args.jobSpecURI,
    validatorAddress: args.validatorAddress,
    deadline,
    amount,
    validationThreshold: threshold
  };
  if (config2.privateKey) {
    const txHash = await client2.escrow.createJob(params);
    return {
      success: true,
      txHash,
      amount: `${formatUSDC3(amount)} USDC`,
      deadline: new Date(Number(deadline) * 1e3).toISOString(),
      validationThreshold: threshold,
      message: "Job created and USDC locked in escrow. Transaction submitted."
    };
  }
  const chainConfig = CHAIN_CONFIGS2[config2.chain];
  const unsignedTx = encodeCreateJobTx(
    chainConfig.contracts,
    chainConfig.chainId,
    params
  );
  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    amount: `${formatUSDC3(amount)} USDC`,
    deadline: new Date(Number(deadline) * 1e3).toISOString(),
    validationThreshold: threshold,
    message: "Sign the unsigned transaction and submit it to the AEGIS API relay at POST /tx/relay with { signedTx: '0x...' }.",
    note: "You must also approve the escrow contract to spend your USDC before this transaction will succeed. Call USDC.approve(escrowAddress, amount) first."
  };
}

// src/tools/deliver-work.ts
import { z as z7 } from "zod";
import { CHAIN_CONFIGS as CHAIN_CONFIGS3 } from "@aegis-protocol/types";
var deliverWorkDef = {
  name: "aegis_deliver_work",
  description: "Submit completed work for a job you're the provider on. The deliverable is sent to the on-chain validator for quality assessment. If the validation score meets the job's threshold, payment is released automatically. If it falls short, a dispute window opens where the client can challenge.",
  inputSchema: {
    jobId: z7.string().describe("The escrow job ID (0x-prefixed hex string)"),
    deliverableURI: z7.string().describe("URL to the completed deliverable (e.g. IPFS link)"),
    deliverableHash: z7.string().describe("Keccak256 hash of the deliverable (0x-prefixed)")
  }
};
async function handleDeliverWork(client2, config2, args) {
  if (config2.privateKey) {
    const txHash = await client2.escrow.submitDeliverable(args.jobId, {
      deliverableURI: args.deliverableURI,
      deliverableHash: args.deliverableHash
    });
    return {
      success: true,
      txHash,
      jobId: args.jobId,
      message: "Deliverable submitted. On-chain validation has been triggered. Use aegis_check_job to monitor progress."
    };
  }
  const chainConfig = CHAIN_CONFIGS3[config2.chain];
  const unsignedTx = encodeDeliverWorkTx(chainConfig.contracts, chainConfig.chainId, {
    jobId: args.jobId,
    deliverableURI: args.deliverableURI,
    deliverableHash: args.deliverableHash
  });
  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    jobId: args.jobId,
    message: "Sign this transaction and submit to POST /tx/relay to deliver the work."
  };
}

// src/tools/settle-job.ts
import { z as z8 } from "zod";
import { CHAIN_CONFIGS as CHAIN_CONFIGS4 } from "@aegis-protocol/types";
var settleJobDef = {
  name: "aegis_settle_job",
  description: 'Settle a completed job to release payment to the provider. Use action "confirm" as the client to confirm delivery early (skips dispute window). Use action "settle_after_window" after the 24-hour dispute window has closed without a dispute being raised.',
  inputSchema: {
    jobId: z8.string().describe("The escrow job ID (0x-prefixed hex string)"),
    action: z8.enum(["confirm", "settle_after_window"]).describe(
      '"confirm" = client confirms delivery early, "settle_after_window" = settle after dispute window closes'
    )
  }
};
async function handleSettleJob(client2, config2, args) {
  const jobId = args.jobId;
  if (config2.privateKey) {
    const txHash = args.action === "confirm" ? await client2.escrow.confirmDelivery(jobId) : await client2.escrow.settleAfterDisputeWindow(jobId);
    return {
      success: true,
      txHash,
      jobId: args.jobId,
      action: args.action,
      message: "Job settled. Payment has been released to the provider."
    };
  }
  const chainConfig = CHAIN_CONFIGS4[config2.chain];
  const unsignedTx = args.action === "confirm" ? encodeConfirmDeliveryTx(chainConfig.contracts, chainConfig.chainId, jobId) : encodeSettleAfterWindowTx(chainConfig.contracts, chainConfig.chainId, jobId);
  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    jobId: args.jobId,
    action: args.action,
    message: "Sign this transaction and submit to POST /tx/relay to settle the job."
  };
}

// src/tools/open-dispute.ts
import { z as z9 } from "zod";
import { CHAIN_CONFIGS as CHAIN_CONFIGS5 } from "@aegis-protocol/types";
var openDisputeDef = {
  name: "aegis_open_dispute",
  description: "Open a dispute when the delivered work doesn't meet the job requirements. This must be done during the dispute window (24 hours after validation). A 10 USDC dispute bond is required. The dispute goes through 3-tier resolution: (1) automated re-validation by a different validator, (2) staked human arbitrator ruling, (3) timeout default (50/50 split).",
  inputSchema: {
    jobId: z9.string().describe("The escrow job ID (0x-prefixed hex string)"),
    evidenceURI: z9.string().describe("URL to evidence supporting the dispute claim"),
    evidenceHash: z9.string().describe("Keccak256 hash of the evidence (0x-prefixed)")
  }
};
async function handleOpenDispute(client2, config2, args) {
  if (config2.privateKey) {
    const txHash = await client2.escrow.raiseDispute(
      args.jobId,
      args.evidenceURI,
      args.evidenceHash
    );
    return {
      success: true,
      txHash,
      jobId: args.jobId,
      message: "Dispute initiated. 10 USDC bond locked. The dispute will go through 3-tier resolution. Use aegis_check_job to monitor progress."
    };
  }
  const chainConfig = CHAIN_CONFIGS5[config2.chain];
  const unsignedTx = encodeRaiseDisputeTx(
    chainConfig.contracts,
    chainConfig.chainId,
    {
      jobId: args.jobId,
      evidenceURI: args.evidenceURI,
      evidenceHash: args.evidenceHash
    }
  );
  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    jobId: args.jobId,
    message: "Sign this transaction and submit to POST /tx/relay to open the dispute. Requires 10 USDC dispute bond (approve dispute contract first)."
  };
}

// src/tools/claim-refund.ts
import { z as z10 } from "zod";
import { CHAIN_CONFIGS as CHAIN_CONFIGS6 } from "@aegis-protocol/types";
var claimRefundDef = {
  name: "aegis_claim_refund",
  description: "Claim a refund on an escrow job where the provider missed the deadline without delivering work. The full USDC amount is returned to the client. Only callable after the job deadline has passed.",
  inputSchema: {
    jobId: z10.string().describe("The escrow job ID (0x-prefixed hex string)")
  }
};
async function handleClaimRefund(client2, config2, args) {
  if (config2.privateKey) {
    const txHash = await client2.escrow.claimTimeout(args.jobId);
    return {
      success: true,
      txHash,
      jobId: args.jobId,
      message: "Refund claimed. The full USDC amount has been returned to the client."
    };
  }
  const chainConfig = CHAIN_CONFIGS6[config2.chain];
  const unsignedTx = encodeClaimTimeoutTx(
    chainConfig.contracts,
    chainConfig.chainId,
    args.jobId
  );
  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    jobId: args.jobId,
    message: "Sign this transaction and submit to POST /tx/relay to claim the refund."
  };
}

// src/index.ts
var config = loadConfig();
var client = createSdkClient(config);
var signing = isSigningClient(config);
var server = new McpServer({
  name: "aegis-protocol",
  version: "0.1.0"
});
function toolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}
function toolError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true
  };
}
server.registerTool(checkJobDef.name, {
  description: checkJobDef.description,
  inputSchema: checkJobDef.inputSchema
}, async (args) => {
  try {
    return toolResult(await handleCheckJob(client, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(lookupAgentDef.name, {
  description: lookupAgentDef.description,
  inputSchema: lookupAgentDef.inputSchema
}, async (args) => {
  try {
    return toolResult(await handleLookupAgent(client, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(listJobsDef.name, {
  description: listJobsDef.description,
  inputSchema: listJobsDef.inputSchema
}, async (args) => {
  try {
    return toolResult(await handleListJobs(client, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(checkBalanceDef.name, {
  description: checkBalanceDef.description,
  inputSchema: checkBalanceDef.inputSchema
}, async (args) => {
  try {
    return toolResult(await handleCheckBalance(client, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(getTemplateDef.name, {
  description: getTemplateDef.description,
  inputSchema: getTemplateDef.inputSchema
}, async (args) => {
  try {
    return toolResult(await handleGetTemplate(client, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(createJobDef.name, {
  description: createJobDef.description,
  inputSchema: createJobDef.inputSchema,
  annotations: {
    title: "Create Escrow Job",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true
  }
}, async (args) => {
  try {
    return toolResult(await handleCreateJob(client, config, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(deliverWorkDef.name, {
  description: deliverWorkDef.description,
  inputSchema: deliverWorkDef.inputSchema,
  annotations: {
    title: "Deliver Work",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true
  }
}, async (args) => {
  try {
    return toolResult(await handleDeliverWork(client, config, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(settleJobDef.name, {
  description: settleJobDef.description,
  inputSchema: settleJobDef.inputSchema,
  annotations: {
    title: "Settle Job",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true
  }
}, async (args) => {
  try {
    return toolResult(await handleSettleJob(client, config, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(openDisputeDef.name, {
  description: openDisputeDef.description,
  inputSchema: openDisputeDef.inputSchema,
  annotations: {
    title: "Open Dispute",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true
  }
}, async (args) => {
  try {
    return toolResult(await handleOpenDispute(client, config, args));
  } catch (e) {
    return toolError(e);
  }
});
server.registerTool(claimRefundDef.name, {
  description: claimRefundDef.description,
  inputSchema: claimRefundDef.inputSchema,
  annotations: {
    title: "Claim Refund",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true
  }
}, async (args) => {
  try {
    return toolResult(await handleClaimRefund(client, config, args));
  } catch (e) {
    return toolError(e);
  }
});
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const mode = signing ? "signing" : "read-only";
  console.error(`AEGIS MCP Server running (${mode} mode, chain: ${config.chain})`);
}
main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map