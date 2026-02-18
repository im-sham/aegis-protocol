import type {
  Hex,
  ContractAddresses,
  Dispute,
  ArbitratorStats,
} from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { aegisDisputeAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";

// ---------------------------------------------------------------------------
// Param interfaces
// ---------------------------------------------------------------------------

/**
 * Parameters for resolving a dispute as an arbitrator.
 */
export interface ResolveByArbitratorParams {
  clientPercent: number;
  rationaleURI: string;
  rationaleHash: Hex;
}

// ---------------------------------------------------------------------------
// DisputeService
// ---------------------------------------------------------------------------

/**
 * Service module wrapping the AegisDispute contract.
 *
 * Provides methods for arbitrator staking, evidence submission, dispute
 * resolution, and read queries.
 */
export class DisputeService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.dispute;
  }

  // -----------------------------------------------------------------------
  // Write methods
  // -----------------------------------------------------------------------

  /**
   * Stake USDC to become an arbitrator.
   * Caller must have approved the dispute contract to spend `amount` USDC.
   */
  async stakeAsArbitrator(amount: bigint): Promise<Hex> {
    this.requireSigner("stakeAsArbitrator");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "stakeAsArbitrator",
      args: [amount],
    });
  }

  /**
   * Unstake USDC as an arbitrator.
   */
  async unstakeArbitrator(amount: bigint): Promise<Hex> {
    this.requireSigner("unstakeArbitrator");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "unstakeArbitrator",
      args: [amount],
    });
  }

  /**
   * Submit evidence for a dispute (respondent side).
   */
  async submitEvidence(
    disputeId: Hex,
    evidenceURI: string,
    evidenceHash: Hex,
  ): Promise<Hex> {
    this.requireSigner("submitEvidence");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "submitEvidence",
      args: [disputeId, evidenceURI, evidenceHash],
    });
  }

  /**
   * Assign a random arbitrator to a dispute.
   */
  async assignArbitrator(disputeId: Hex): Promise<Hex> {
    this.requireSigner("assignArbitrator");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "assignArbitrator",
      args: [disputeId],
    });
  }

  /**
   * Resolve a dispute as the assigned arbitrator.
   */
  async resolveByArbitrator(
    disputeId: Hex,
    params: ResolveByArbitratorParams,
  ): Promise<Hex> {
    this.requireSigner("resolveByArbitrator");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "resolveByArbitrator",
      args: [
        disputeId,
        params.clientPercent,
        params.rationaleURI,
        params.rationaleHash,
      ],
    });
  }

  /**
   * Resolve a dispute by timeout (resolution deadline passed without arbitrator ruling).
   */
  async resolveByTimeout(disputeId: Hex): Promise<Hex> {
    this.requireSigner("resolveByTimeout");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "resolveByTimeout",
      args: [disputeId],
    });
  }

  // -----------------------------------------------------------------------
  // Read methods
  // -----------------------------------------------------------------------

  /**
   * Get the full Dispute struct for a given dispute ID.
   */
  async getDispute(disputeId: Hex): Promise<Dispute> {
    return this.provider.readContract<Dispute>({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "getDispute",
      args: [disputeId],
    });
  }

  /**
   * Get the dispute ID associated with a job.
   */
  async getDisputeForJob(jobId: Hex): Promise<Hex> {
    return this.provider.readContract<Hex>({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "getDisputeForJob",
      args: [jobId],
    });
  }

  /**
   * Get the number of active arbitrators.
   */
  async getActiveArbitratorCount(): Promise<bigint> {
    return this.provider.readContract<bigint>({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "getActiveArbitratorCount",
    });
  }

  /**
   * Get stats for a given arbitrator address.
   */
  async getArbitratorStats(arbitratorAddress: Hex): Promise<ArbitratorStats> {
    return this.provider.readContract<ArbitratorStats>({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "getArbitratorStats",
      args: [arbitratorAddress],
    });
  }

  // -----------------------------------------------------------------------
  // Event listeners
  // -----------------------------------------------------------------------

  /**
   * Subscribe to DisputeResolved events. Returns an unsubscribe function.
   */
  onDisputeResolved(callback: (logs: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisDisputeAbi,
      eventName: "DisputeResolved",
      onLogs: callback,
    });
  }

  /**
   * Subscribe to ArbitratorAssigned events. Returns an unsubscribe function.
   */
  onArbitratorAssigned(callback: (logs: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisDisputeAbi,
      eventName: "ArbitratorAssigned",
      onLogs: callback,
    });
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private requireSigner(method: string): void {
    if (this.provider.isReadOnly) {
      throw new AegisValidationError(
        `Cannot call ${method}: provider is read-only.`,
      );
    }
  }
}
