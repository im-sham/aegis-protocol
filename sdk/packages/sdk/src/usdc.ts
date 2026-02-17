import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { erc20Abi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";

/**
 * High-level service for USDC ERC-20 operations (approve, balance, allowance).
 *
 * This is the top-level service that interacts with the USDC contract on behalf
 * of the SDK consumer.  For raw parsing / formatting helpers see `utils/usdc.ts`.
 */
export class USDCService {
  private readonly provider: AegisProvider;
  private readonly usdcAddress: Hex;
  private readonly escrowAddress: Hex;
  private readonly disputeAddress: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.usdcAddress = addresses.usdc;
    this.escrowAddress = addresses.escrow;
    this.disputeAddress = addresses.dispute;
  }

  // ---------------------------------------------------------------------------
  // Write helpers — approve
  // ---------------------------------------------------------------------------

  /** Approve the AEGIS Escrow contract to spend `amount` USDC on your behalf. */
  async approveEscrow(amount: bigint): Promise<Hex> {
    return this.approve(this.escrowAddress, amount);
  }

  /** Approve the AEGIS Dispute contract to spend `amount` USDC on your behalf. */
  async approveDispute(amount: bigint): Promise<Hex> {
    return this.approve(this.disputeAddress, amount);
  }

  /** Generic ERC-20 `approve` against the USDC token. */
  async approve(spender: Hex, amount: bigint): Promise<Hex> {
    this.requireSigner("approve");
    return this.provider.writeContract({
      address: this.usdcAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount],
    });
  }

  // ---------------------------------------------------------------------------
  // Read helpers — balance & allowance
  // ---------------------------------------------------------------------------

  /** Read the USDC balance of an arbitrary address. */
  async balanceOf(address: Hex): Promise<bigint> {
    return this.provider.readContract<bigint>({
      address: this.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
  }

  /** Read the USDC allowance granted by `owner` to `spender`. */
  async allowance(owner: Hex, spender: Hex): Promise<bigint> {
    return this.provider.readContract<bigint>({
      address: this.usdcAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    });
  }

  /** Shortcut: read the connected wallet's USDC balance. */
  async myBalance(): Promise<bigint> {
    const address = await this.provider.getAddress();
    return this.balanceOf(address);
  }

  /** Shortcut: read how much USDC the Escrow contract is allowed to spend. */
  async escrowAllowance(): Promise<bigint> {
    const owner = await this.provider.getAddress();
    return this.allowance(owner, this.escrowAddress);
  }

  /** Shortcut: read how much USDC the Dispute contract is allowed to spend. */
  async disputeAllowance(): Promise<bigint> {
    const owner = await this.provider.getAddress();
    return this.allowance(owner, this.disputeAddress);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private requireSigner(method: string): void {
    if (this.provider.isReadOnly) {
      throw new AegisValidationError(
        `Cannot call ${method}: provider is read-only.`,
      );
    }
  }
}
