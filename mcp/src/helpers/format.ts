import { JobState, DisputeResolution } from "@aegis-protocol/types";
import type { Job, Dispute, JobTemplate } from "@aegis-protocol/types";
import { formatUSDC } from "@aegis-protocol/sdk";
import type { ReputationSummary } from "@aegis-protocol/sdk";

const JOB_STATE_LABELS: Record<number, string> = {
  [JobState.CREATED]: "Created",
  [JobState.FUNDED]: "Funded — waiting for provider to deliver",
  [JobState.DELIVERED]: "Delivered — awaiting validation",
  [JobState.VALIDATING]: "Validating on-chain",
  [JobState.DISPUTE_WINDOW]: "Dispute window open (24h)",
  [JobState.SETTLED]: "Settled — payment released",
  [JobState.DISPUTED]: "Disputed — under resolution",
  [JobState.RESOLVED]: "Dispute resolved",
  [JobState.EXPIRED]: "Expired — deadline missed",
  [JobState.REFUNDED]: "Refunded to client",
  [JobState.CANCELLED]: "Cancelled",
};

const DISPUTE_METHOD_LABELS: Record<number, string> = {
  [DisputeResolution.NONE]: "None",
  [DisputeResolution.RE_VALIDATION]: "Automated re-validation",
  [DisputeResolution.ARBITRATOR]: "Arbitrator ruling",
  [DisputeResolution.TIMEOUT_DEFAULT]: "Timeout default (50/50)",
  [DisputeResolution.CLIENT_CONFIRM]: "Client confirmed",
};

export function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return "N/A";
  return new Date(Number(ts) * 1000).toISOString();
}

export function formatJobForLLM(jobId: string, job: Job) {
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
    resolution:
      DISPUTE_METHOD_LABELS[job.resolution] ?? `Unknown (${job.resolution})`,
  };
}

export function formatDisputeForLLM(disputeId: string, dispute: Dispute) {
  return {
    disputeId,
    jobId: dispute.jobId,
    initiator: dispute.initiator,
    respondent: dispute.respondent,
    resolved: dispute.resolved,
    method:
      DISPUTE_METHOD_LABELS[dispute.method] ?? `Unknown (${dispute.method})`,
    ruling: dispute.ruling,
    initiatorEvidenceURI: dispute.initiatorEvidenceURI,
    respondentEvidenceURI: dispute.respondentEvidenceURI || "Not submitted",
    respondentSubmitted: dispute.respondentSubmitted,
    arbitrator: dispute.arbitrator,
    createdAt: formatTimestamp(dispute.createdAt),
    evidenceDeadline: formatTimestamp(dispute.evidenceDeadline),
    resolutionDeadline: formatTimestamp(dispute.resolutionDeadline),
    initiatorBond: `${formatUSDC(dispute.initiatorBond)} USDC`,
  };
}

export function formatTemplateForLLM(
  templateId: string,
  template: JobTemplate,
) {
  return {
    templateId,
    name: template.name,
    active: template.active,
    creator: template.creator,
    defaultValidator: template.defaultValidator,
    defaultTimeout: `${Number(template.defaultTimeout) / 3600} hours`,
    fee: `${Number(template.feeBps) / 100}%`,
    minValidationScore: template.minValidation,
    defaultDisputeSplit: template.defaultDisputeSplit,
  };
}

export function formatReputationForLLM(
  agentId: string,
  summary: ReputationSummary,
) {
  const score =
    summary.count > 0n
      ? Number(summary.summaryValue) /
        10 ** summary.summaryValueDecimals
      : 0;

  return {
    agentId,
    feedbackCount: summary.count.toString(),
    averageScore: score.toFixed(2),
    hasReputation: summary.count > 0n,
  };
}
