import type { Hex, ContractAddresses, JobTemplate } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { aegisJobFactoryAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";

// ---------------------------------------------------------------------------
// Param interfaces
// ---------------------------------------------------------------------------

/**
 * Parameters for creating a new job template.
 */
export interface CreateTemplateParams {
  name: string;
  defaultValidator: Hex;
  defaultTimeout: bigint;
  feeBps: bigint;
  minValidation: number;
  defaultDisputeSplit: number;
}

/**
 * Parameters for creating a job from an existing template.
 */
export interface CreateJobFromTemplateParams {
  templateId: bigint;
  clientAgentId: bigint;
  providerAgentId: bigint;
  jobSpecHash: Hex;
  jobSpecURI: string;
  amount: bigint;
}

// ---------------------------------------------------------------------------
// FactoryService
// ---------------------------------------------------------------------------

/**
 * Service module wrapping the AegisJobFactory contract.
 *
 * Provides methods for template management and template-based job creation.
 */
export class FactoryService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.factory;
  }

  // -----------------------------------------------------------------------
  // Write methods
  // -----------------------------------------------------------------------

  /**
   * Create a new job template.
   */
  async createTemplate(params: CreateTemplateParams): Promise<Hex> {
    this.requireSigner("createTemplate");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "createTemplate",
      args: [
        params.name,
        params.defaultValidator,
        params.defaultTimeout,
        params.feeBps,
        params.minValidation,
        params.defaultDisputeSplit,
      ],
    });
  }

  /**
   * Create a job from an existing template.
   */
  async createJobFromTemplate(
    params: CreateJobFromTemplateParams,
  ): Promise<Hex> {
    this.requireSigner("createJobFromTemplate");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "createJobFromTemplate",
      args: [
        params.templateId,
        params.clientAgentId,
        params.providerAgentId,
        params.jobSpecHash,
        params.jobSpecURI,
        params.amount,
      ],
    });
  }

  /**
   * Deactivate a job template.
   */
  async deactivateTemplate(templateId: bigint): Promise<Hex> {
    this.requireSigner("deactivateTemplate");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "deactivateTemplate",
      args: [templateId],
    });
  }

  // -----------------------------------------------------------------------
  // Read methods
  // -----------------------------------------------------------------------

  /**
   * Get a job template by ID.
   */
  async getTemplate(templateId: bigint): Promise<JobTemplate> {
    return this.provider.readContract<JobTemplate>({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "getTemplate",
      args: [templateId],
    });
  }

  /**
   * Check whether a template is currently active.
   */
  async isTemplateActive(templateId: bigint): Promise<boolean> {
    return this.provider.readContract<boolean>({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "isTemplateActive",
      args: [templateId],
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
