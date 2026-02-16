import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { erc8004ValidationAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "../provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Validation status for a given request hash, as stored in the
 * ERC-8004 Validation Registry.
 */
export interface ValidationStatus {
  validatorAddress: Hex;
  agentId: bigint;
  response: number;
  responseHash: Hex;
  tag: string;
  lastUpdate: bigint;
}

// ---------------------------------------------------------------------------
// ValidationService
// ---------------------------------------------------------------------------

/**
 * Service module wrapping the ERC-8004 Validation Registry contract.
 *
 * Provides methods for reading validation statuses and agent validation history.
 */
export class ValidationService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.validationRegistry;
  }

  // -----------------------------------------------------------------------
  // Read methods
  // -----------------------------------------------------------------------

  /**
   * Get the validation status for a given request hash.
   */
  async getValidationStatus(requestHash: Hex): Promise<ValidationStatus> {
    const result = await this.provider.readContract<
      [Hex, bigint, number, Hex, string, bigint]
    >({
      address: this.address,
      abi: erc8004ValidationAbi,
      functionName: "getValidationStatus",
      args: [requestHash],
    });

    return {
      validatorAddress: result[0],
      agentId: result[1],
      response: result[2],
      responseHash: result[3],
      tag: result[4],
      lastUpdate: result[5],
    };
  }

  /**
   * Get all validation request hashes associated with an agent.
   */
  async getAgentValidations(agentId: bigint): Promise<readonly Hex[]> {
    return this.provider.readContract<readonly Hex[]>({
      address: this.address,
      abi: erc8004ValidationAbi,
      functionName: "getAgentValidations",
      args: [agentId],
    });
  }
}
