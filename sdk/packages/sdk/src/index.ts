// ---------------------------------------------------------------------------
// AegisClient — unified entry point
// ---------------------------------------------------------------------------
export { AegisClient } from "./client";
export type {
  ViemClientOptions,
  EthersClientOptions,
  ReadOnlyClientOptions,
} from "./client";

// ---------------------------------------------------------------------------
// Core service modules
// ---------------------------------------------------------------------------
export { EscrowService } from "./escrow";
export type { CreateJobParams, SubmitDeliverableParams } from "./escrow";

export { DisputeService } from "./dispute";
export type { ResolveByArbitratorParams } from "./dispute";

export { TreasuryService } from "./treasury";

export { FactoryService } from "./factory";
export type {
  CreateTemplateParams,
  CreateJobFromTemplateParams,
} from "./factory";

export { USDCService } from "./usdc";

// ---------------------------------------------------------------------------
// ERC-8004 registry services
// ---------------------------------------------------------------------------
export {
  IdentityService,
  ReputationService,
  ValidationService,
} from "./erc8004";
export type { ReputationSummary, ValidationStatus } from "./erc8004";

// ---------------------------------------------------------------------------
// Provider abstraction + adapters
// ---------------------------------------------------------------------------
export type { AegisProvider } from "./provider";
export { ViemAdapter, EthersAdapter } from "./adapters";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
export { parseUSDC, formatUSDC } from "./utils";

// ---------------------------------------------------------------------------
// Re-exports from @aegis-protocol/types
// ---------------------------------------------------------------------------
export { JobState, DisputeResolution, CHAIN_CONFIGS } from "@aegis-protocol/types";
export type {
  Hex,
  Job,
  Dispute,
  JobTemplate,
  ArbitratorStats,
  ContractAddresses,
  ChainConfig,
  SupportedChain,
  ClientOptions,
  AegisContractErrorData,
} from "@aegis-protocol/types";
export {
  AegisContractError,
  AegisProviderError,
  AegisValidationError,
} from "@aegis-protocol/types";
