import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { erc8004IdentityAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "../provider";

// ---------------------------------------------------------------------------
// IdentityService
// ---------------------------------------------------------------------------

/**
 * Service module wrapping the ERC-8004 Identity Registry contract.
 *
 * Provides methods for agent registration and identity lookups.
 */
export class IdentityService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.identityRegistry;
  }

  // -----------------------------------------------------------------------
  // Write methods
  // -----------------------------------------------------------------------

  /**
   * Register a new agent with the given URI.
   * Returns the transaction hash.
   */
  async register(agentURI: string): Promise<Hex> {
    this.requireSigner("register");
    return this.provider.writeContract({
      address: this.address,
      abi: erc8004IdentityAbi,
      functionName: "register",
      args: [agentURI],
    });
  }

  // -----------------------------------------------------------------------
  // Read methods
  // -----------------------------------------------------------------------

  /**
   * Get the wallet address associated with an agent ID.
   */
  async getAgentWallet(agentId: bigint): Promise<Hex> {
    return this.provider.readContract<Hex>({
      address: this.address,
      abi: erc8004IdentityAbi,
      functionName: "getAgentWallet",
      args: [agentId],
    });
  }

  /**
   * Get the owner address of an agent token.
   */
  async ownerOf(agentId: bigint): Promise<Hex> {
    return this.provider.readContract<Hex>({
      address: this.address,
      abi: erc8004IdentityAbi,
      functionName: "ownerOf",
      args: [agentId],
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
