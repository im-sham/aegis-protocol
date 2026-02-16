import type { Hex, ContractAddresses, Job, JobCreatedEvent } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { aegisEscrowAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";
import { parseJobCreated } from "./parsers";

// ---------------------------------------------------------------------------
// Param interfaces
// ---------------------------------------------------------------------------

/**
 * Parameters for creating a new escrow job.
 */
export interface CreateJobParams {
  clientAgentId: bigint;
  providerAgentId: bigint;
  jobSpecHash: Hex;
  jobSpecURI: string;
  validatorAddress: Hex;
  deadline: bigint;
  amount: bigint;
  validationThreshold: number;
}

/**
 * Parameters for submitting a deliverable for a job.
 */
export interface SubmitDeliverableParams {
  deliverableURI: string;
  deliverableHash: Hex;
}

// ---------------------------------------------------------------------------
// EscrowService
// ---------------------------------------------------------------------------

/**
 * Service module wrapping the AegisEscrow contract.
 *
 * Provides methods for the full job lifecycle: creation, delivery, validation,
 * settlement, disputes, and read queries.
 */
export class EscrowService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.escrow;
  }

  // -----------------------------------------------------------------------
  // Write methods
  // -----------------------------------------------------------------------

  /**
   * Create a new escrow job with atomic USDC funding.
   * Caller must have approved the escrow contract to spend `params.amount` USDC.
   */
  async createJob(params: CreateJobParams): Promise<Hex> {
    this.requireSigner("createJob");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "createJob",
      args: [
        params.clientAgentId,
        params.providerAgentId,
        params.jobSpecHash,
        params.jobSpecURI,
        params.validatorAddress,
        params.deadline,
        params.amount,
        params.validationThreshold,
      ],
    });
  }

  /**
   * Create a job, wait for the transaction to be mined, and return the parsed
   * JobCreated event data. Combines `createJob` + `waitForTransaction` + parsing.
   */
  async createJobAndWait(params: CreateJobParams): Promise<JobCreatedEvent> {
    const txHash = await this.createJob(params);
    const receipt = await this.provider.waitForTransaction(txHash);
    const event = parseJobCreated(receipt);
    if (!event) {
      throw new AegisValidationError(
        "Transaction succeeded but JobCreated event was not found in receipt.",
      );
    }
    return event;
  }

  /**
   * Submit a deliverable for a funded job. Only the provider agent owner can call.
   */
  async submitDeliverable(
    jobId: Hex,
    params: SubmitDeliverableParams,
  ): Promise<Hex> {
    this.requireSigner("submitDeliverable");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "submitDeliverable",
      args: [jobId, params.deliverableURI, params.deliverableHash],
    });
  }

  /**
   * Process validation results for a job. Permissionless -- anyone can call.
   */
  async processValidation(jobId: Hex): Promise<Hex> {
    this.requireSigner("processValidation");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "processValidation",
      args: [jobId],
    });
  }

  /**
   * Client confirms delivery during the dispute window, settling the job immediately.
   */
  async confirmDelivery(jobId: Hex): Promise<Hex> {
    this.requireSigner("confirmDelivery");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "confirmDelivery",
      args: [jobId],
    });
  }

  /**
   * Settle a job after the dispute window has expired without a dispute being raised.
   */
  async settleAfterDisputeWindow(jobId: Hex): Promise<Hex> {
    this.requireSigner("settleAfterDisputeWindow");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "settleAfterDisputeWindow",
      args: [jobId],
    });
  }

  /**
   * Raise a dispute during the dispute window.
   */
  async raiseDispute(
    jobId: Hex,
    evidenceURI: string,
    evidenceHash: Hex,
  ): Promise<Hex> {
    this.requireSigner("raiseDispute");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "raiseDispute",
      args: [jobId, evidenceURI, evidenceHash],
    });
  }

  /**
   * Claim timeout on an expired job, refunding the client.
   */
  async claimTimeout(jobId: Hex): Promise<Hex> {
    this.requireSigner("claimTimeout");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "claimTimeout",
      args: [jobId],
    });
  }

  // -----------------------------------------------------------------------
  // Read methods
  // -----------------------------------------------------------------------

  /**
   * Get the full Job struct for a given job ID.
   */
  async getJob(jobId: Hex): Promise<Job> {
    return this.provider.readContract<Job>({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "getJob",
      args: [jobId],
    });
  }

  /**
   * Get all job IDs associated with a given agent.
   */
  async getAgentJobs(agentId: bigint): Promise<readonly Hex[]> {
    return this.provider.readContract<readonly Hex[]>({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "getAgentJobIds",
      args: [agentId],
    });
  }

  /**
   * Get the number of jobs for a given agent.
   */
  async getAgentJobCount(agentId: bigint): Promise<bigint> {
    return this.provider.readContract<bigint>({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "getAgentJobCount",
      args: [agentId],
    });
  }

  /**
   * Check whether a job exists on-chain.
   */
  async jobExists(jobId: Hex): Promise<boolean> {
    return this.provider.readContract<boolean>({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "jobExists",
      args: [jobId],
    });
  }

  /**
   * Get protocol-level stats: total jobs created and total volume settled.
   */
  async getProtocolStats(): Promise<{
    totalJobsCreated: bigint;
    totalVolumeSettled: bigint;
  }> {
    const [totalJobsCreated, totalVolumeSettled] = await Promise.all([
      this.provider.readContract<bigint>({
        address: this.address,
        abi: aegisEscrowAbi,
        functionName: "totalJobsCreated",
      }),
      this.provider.readContract<bigint>({
        address: this.address,
        abi: aegisEscrowAbi,
        functionName: "totalVolumeSettled",
      }),
    ]);
    return { totalJobsCreated, totalVolumeSettled };
  }

  // -----------------------------------------------------------------------
  // Event listeners
  // -----------------------------------------------------------------------

  /**
   * Subscribe to JobCreated events. Returns an unsubscribe function.
   */
  onJobCreated(callback: (logs: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisEscrowAbi,
      eventName: "JobCreated",
      onLogs: callback,
    });
  }

  /**
   * Subscribe to JobSettled events. Returns an unsubscribe function.
   */
  onJobSettled(callback: (logs: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisEscrowAbi,
      eventName: "JobSettled",
      onLogs: callback,
    });
  }

  /**
   * Subscribe to DeliverableSubmitted events. Returns an unsubscribe function.
   */
  onDeliverableSubmitted(callback: (logs: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisEscrowAbi,
      eventName: "DeliverableSubmitted",
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
