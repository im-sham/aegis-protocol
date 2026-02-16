import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { erc8004ReputationAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "../provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Reputation summary returned by the ERC-8004 Reputation Registry.
 */
export interface ReputationSummary {
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
}

// ---------------------------------------------------------------------------
// ReputationService
// ---------------------------------------------------------------------------

/**
 * Service module wrapping the ERC-8004 Reputation Registry contract.
 *
 * Provides methods for reading agent reputation summaries and client lists.
 */
export class ReputationService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.reputationRegistry;
  }

  // -----------------------------------------------------------------------
  // Read methods
  // -----------------------------------------------------------------------

  /**
   * Get an agent's reputation summary, filtered by the given client addresses.
   * The clientAddresses array is required to prevent Sybil attacks.
   *
   * @param agentId - The agent's on-chain ID.
   * @param clientAddresses - Array of client addresses to include in summary.
   * @param tag1 - Optional tag filter (defaults to empty string).
   * @param tag2 - Optional tag filter (defaults to empty string).
   */
  async getSummary(
    agentId: bigint,
    clientAddresses: readonly Hex[],
    tag1?: string,
    tag2?: string,
  ): Promise<ReputationSummary> {
    const result = await this.provider.readContract<
      [bigint, bigint, number]
    >({
      address: this.address,
      abi: erc8004ReputationAbi,
      functionName: "getSummary",
      args: [agentId, clientAddresses, tag1 ?? "", tag2 ?? ""],
    });

    return {
      count: result[0],
      summaryValue: result[1],
      summaryValueDecimals: result[2],
    };
  }

  /**
   * Get the list of client addresses that have provided feedback for an agent.
   */
  async getClients(agentId: bigint): Promise<readonly Hex[]> {
    return this.provider.readContract<readonly Hex[]>({
      address: this.address,
      abi: erc8004ReputationAbi,
      functionName: "getClients",
      args: [agentId],
    });
  }
}
