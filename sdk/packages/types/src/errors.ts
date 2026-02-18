import { JobState } from "./enums";
import type { Hex } from "./contracts";

// ---------------------------------------------------------------------------
// Discriminated union covering all 30 custom Solidity errors from AegisTypes.sol
// ---------------------------------------------------------------------------

// === Identity Errors ===
export interface AgentNotRegisteredError {
  name: "AgentNotRegistered";
  args: { agentId: bigint };
}

export interface NotAgentOwnerError {
  name: "NotAgentOwner";
  args: { agentId: bigint; caller: Hex };
}

export interface AgentWalletNotSetError {
  name: "AgentWalletNotSet";
  args: { agentId: bigint };
}

// === Job Errors ===
export interface InvalidJobStateError {
  name: "InvalidJobState";
  args: { jobId: Hex; current: JobState; expected: JobState };
}

export interface JobNotFoundError {
  name: "JobNotFound";
  args: { jobId: Hex };
}

export interface DeadlinePassedError {
  name: "DeadlinePassed";
  args: { jobId: Hex; deadline: bigint };
}

export interface DeadlineNotPassedError {
  name: "DeadlineNotPassed";
  args: { jobId: Hex; deadline: bigint };
}

export interface InsufficientAmountError {
  name: "InsufficientAmount";
  args: { provided: bigint; required: bigint };
}

export interface SameAgentError {
  name: "SameAgent";
  args: { agentId: bigint };
}

export interface InvalidDeadlineError {
  name: "InvalidDeadline";
  args: { deadline: bigint };
}

export interface InvalidThresholdError {
  name: "InvalidThreshold";
  args: { threshold: number };
}

// === Validation Errors ===
export interface InvalidValidatorError {
  name: "InvalidValidator";
  args: { validator: Hex };
}

export interface ValidationNotCompleteError {
  name: "ValidationNotComplete";
  args: { jobId: Hex };
}

export interface ValidationAlreadyRequestedError {
  name: "ValidationAlreadyRequested";
  args: { jobId: Hex };
}

// === Dispute Errors ===
export interface DisputeWindowClosedError {
  name: "DisputeWindowClosed";
  args: { jobId: Hex };
}

export interface DisputeWindowOpenError {
  name: "DisputeWindowOpen";
  args: { jobId: Hex };
}

export interface NotJobPartyError {
  name: "NotJobParty";
  args: { jobId: Hex; caller: Hex };
}

export interface DisputeAlreadyExistsError {
  name: "DisputeAlreadyExists";
  args: { jobId: Hex };
}

export interface DisputeNotFoundError {
  name: "DisputeNotFound";
  args: { disputeId: Hex };
}

export interface DisputeAlreadyResolvedError {
  name: "DisputeAlreadyResolved";
  args: { disputeId: Hex };
}

export interface EvidenceWindowClosedError {
  name: "EvidenceWindowClosed";
  args: { disputeId: Hex };
}

export interface NotArbitratorError {
  name: "NotArbitrator";
  args: { disputeId: Hex; caller: Hex };
}

export interface InvalidRulingError {
  name: "InvalidRuling";
  args: { ruling: number };
}

export interface InsufficientBondError {
  name: "InsufficientBond";
  args: { provided: bigint; required: bigint };
}

export interface ResolutionDeadlineNotPassedError {
  name: "ResolutionDeadlineNotPassed";
  args: { disputeId: Hex };
}

// === Treasury Errors ===
export interface NotAuthorizedError {
  name: "NotAuthorized";
  args: { caller: Hex };
}

export interface InsufficientBalanceError {
  name: "InsufficientBalance";
  args: { requested: bigint; available: bigint };
}

// === Template Errors ===
export interface TemplateNotFoundError {
  name: "TemplateNotFound";
  args: { templateId: bigint };
}

export interface TemplateNotActiveError {
  name: "TemplateNotActive";
  args: { templateId: bigint };
}

// === General Errors ===
export interface ZeroAddressError {
  name: "ZeroAddress";
  args: Record<string, never>;
}

export interface TransferFailedError {
  name: "TransferFailed";
  args: Record<string, never>;
}

/**
 * Discriminated union of all 30 decoded AEGIS contract error types.
 * Use the `name` field to narrow to a specific variant.
 */
export type AegisContractErrorData =
  // Identity
  | AgentNotRegisteredError
  | NotAgentOwnerError
  | AgentWalletNotSetError
  // Job
  | InvalidJobStateError
  | JobNotFoundError
  | DeadlinePassedError
  | DeadlineNotPassedError
  | InsufficientAmountError
  | SameAgentError
  | InvalidDeadlineError
  | InvalidThresholdError
  // Validation
  | InvalidValidatorError
  | ValidationNotCompleteError
  | ValidationAlreadyRequestedError
  // Dispute
  | DisputeWindowClosedError
  | DisputeWindowOpenError
  | NotJobPartyError
  | DisputeAlreadyExistsError
  | DisputeNotFoundError
  | DisputeAlreadyResolvedError
  | EvidenceWindowClosedError
  | NotArbitratorError
  | InvalidRulingError
  | InsufficientBondError
  | ResolutionDeadlineNotPassedError
  // Treasury
  | NotAuthorizedError
  | InsufficientBalanceError
  // Template
  | TemplateNotFoundError
  | TemplateNotActiveError
  // General
  | ZeroAddressError
  | TransferFailedError;

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Thrown when a contract call reverts with a known AEGIS custom error.
 * Stores the decoded error data for programmatic handling.
 */
export class AegisContractError extends Error {
  readonly data: AegisContractErrorData;

  constructor(data: AegisContractErrorData, message?: string) {
    super(message ?? `Contract error: ${data.name}`);
    this.name = "AegisContractError";
    this.data = data;
  }
}

/**
 * Thrown when the underlying provider (viem / ethers) encounters a
 * transport-level or RPC error that is not a decoded contract revert.
 */
export class AegisProviderError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AegisProviderError";
    this.cause = cause;
  }
}

/**
 * Thrown when SDK-side input validation fails before a contract call is made.
 */
export class AegisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AegisValidationError";
  }
}
