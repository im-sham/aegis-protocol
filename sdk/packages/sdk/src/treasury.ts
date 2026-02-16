import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { aegisTreasuryAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";

// ---------------------------------------------------------------------------
// TreasuryService
// ---------------------------------------------------------------------------

/**
 * Service module wrapping the AegisTreasury contract.
 *
 * Provides methods for reading treasury balances and admin-only operations
 * like withdrawals and arbitrator reward distribution.
 */
export class TreasuryService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.treasury;
  }

  // -----------------------------------------------------------------------
  // Read methods
  // -----------------------------------------------------------------------

  /**
   * Get the total USDC balance held by the treasury contract.
   */
  async totalBalance(): Promise<bigint> {
    return this.provider.readContract<bigint>({
      address: this.address,
      abi: aegisTreasuryAbi,
      functionName: "totalBalance",
    });
  }

  /**
   * Get a breakdown of all treasury balances.
   */
  async getBalances(): Promise<{
    totalFeesCollected: bigint;
    treasuryBalance: bigint;
    arbitratorPoolBalance: bigint;
  }> {
    const [totalFeesCollected, treasuryBalance, arbitratorPoolBalance] =
      await Promise.all([
        this.provider.readContract<bigint>({
          address: this.address,
          abi: aegisTreasuryAbi,
          functionName: "totalFeesCollected",
        }),
        this.provider.readContract<bigint>({
          address: this.address,
          abi: aegisTreasuryAbi,
          functionName: "treasuryBalance",
        }),
        this.provider.readContract<bigint>({
          address: this.address,
          abi: aegisTreasuryAbi,
          functionName: "arbitratorPoolBalance",
        }),
      ]);
    return { totalFeesCollected, treasuryBalance, arbitratorPoolBalance };
  }

  // -----------------------------------------------------------------------
  // Write methods (admin only)
  // -----------------------------------------------------------------------

  /**
   * Withdraw USDC from the treasury (owner only).
   */
  async withdrawTreasury(to: Hex, amount: bigint): Promise<Hex> {
    this.requireSigner("withdrawTreasury");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisTreasuryAbi,
      functionName: "withdrawTreasury",
      args: [to, amount],
    });
  }

  /**
   * Distribute arbitrator rewards to the dispute contract (owner only).
   */
  async distributeArbitratorRewards(
    disputeContract: Hex,
    amount: bigint,
  ): Promise<Hex> {
    this.requireSigner("distributeArbitratorRewards");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisTreasuryAbi,
      functionName: "distributeArbitratorRewards",
      args: [disputeContract, amount],
    });
  }

  /**
   * Sweep excess USDC to the owner (owner only).
   */
  async sweep(): Promise<Hex> {
    this.requireSigner("sweep");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisTreasuryAbi,
      functionName: "sweep",
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
