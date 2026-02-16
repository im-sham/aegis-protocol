import { JobState, DisputeResolution } from "./enums";

/** Hex-encoded string (0x-prefixed). */
export type Hex = `0x${string}`;

/**
 * On-chain job record, mirrors the Solidity Job struct in AegisTypes.sol.
 */
export interface Job {
  clientAgentId: bigint;
  providerAgentId: bigint;
  clientAddress: Hex;
  providerWallet: Hex;
  jobSpecHash: Hex;
  jobSpecURI: string;
  templateId: bigint;
  validatorAddress: Hex;
  validationRequestHash: Hex;
  validationScore: number;
  validationThreshold: number;
  amount: bigint;
  protocolFeeBps: bigint;
  createdAt: bigint;
  deadline: bigint;
  deliveredAt: bigint;
  settledAt: bigint;
  disputeWindowEnd: bigint;
  deliverableHash: Hex;
  deliverableURI: string;
  state: JobState;
  resolution: DisputeResolution;
}

/**
 * On-chain dispute record, mirrors the Solidity Dispute struct in AegisTypes.sol.
 */
export interface Dispute {
  jobId: Hex;
  initiator: Hex;
  respondent: Hex;
  initiatorEvidenceURI: string;
  initiatorEvidenceHash: Hex;
  respondentEvidenceURI: string;
  respondentEvidenceHash: Hex;
  respondentSubmitted: boolean;
  arbitrator: Hex;
  ruling: number;
  rationaleURI: string;
  rationaleHash: Hex;
  createdAt: bigint;
  evidenceDeadline: bigint;
  resolutionDeadline: bigint;
  initiatorBond: bigint;
  resolved: boolean;
  method: DisputeResolution;
}

/**
 * Job template definition, mirrors the Solidity JobTemplate struct in AegisTypes.sol.
 */
export interface JobTemplate {
  name: string;
  defaultValidator: Hex;
  defaultTimeout: bigint;
  feeBps: bigint;
  minValidation: number;
  defaultDisputeSplit: number;
  active: boolean;
  creator: Hex;
}

/**
 * Arbitrator performance stats, mirrors the Solidity ArbitratorStats struct in AegisTypes.sol.
 */
export interface ArbitratorStats {
  totalResolutions: bigint;
  successfulResolutions: bigint;
  totalFeesEarned: bigint;
  lastActiveAt: bigint;
}
