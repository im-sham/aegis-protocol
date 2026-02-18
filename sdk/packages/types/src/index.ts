// Enums
export { JobState, DisputeResolution } from "./enums";

// Contract types
export type { Hex, Job, Dispute, JobTemplate, ArbitratorStats } from "./contracts";
export type {
  JobCreatedEvent,
  JobSettledEvent,
  DisputeInitiatedEvent,
  DisputeResolvedEvent,
  TemplateCreatedEvent,
  AgentRegisteredResult,
} from "./contracts";

// Config types and values
export type {
  ContractAddresses,
  ChainConfig,
  SupportedChain,
  ClientOptions,
} from "./config";
export { CHAIN_CONFIGS } from "./config";

// Error types and classes
export type { AegisContractErrorData } from "./errors";
export {
  AegisContractError,
  AegisProviderError,
  AegisValidationError,
} from "./errors";
