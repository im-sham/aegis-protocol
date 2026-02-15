import type {
  PublicClient,
  WalletClient,
  GetContractReturnType,
} from "viem";
import type { Hex } from "@aegis-protocol/types";
import { AegisProviderError } from "@aegis-protocol/types";
import type {
  AegisProvider,
  ReadContractParams,
  WriteContractParams,
  TransactionReceipt,
  WatchEventParams,
} from "../provider";

/**
 * AegisProvider implementation backed by viem.
 *
 * Usage:
 *   const provider = new ViemAdapter(walletClient, publicClient);
 *   // — or read-only —
 *   const provider = ViemAdapter.readOnly(publicClient);
 */
export class ViemAdapter implements AegisProvider {
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient | null;

  readonly isReadOnly: boolean;

  constructor(walletClient: WalletClient, publicClient: PublicClient) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.isReadOnly = false;
  }

  /**
   * Create a read-only adapter (no write capabilities).
   */
  static readOnly(publicClient: PublicClient): ViemAdapter {
    const adapter = Object.create(ViemAdapter.prototype) as ViemAdapter;
    (adapter as { publicClient: PublicClient }).publicClient = publicClient;
    (adapter as { walletClient: WalletClient | null }).walletClient = null;
    (adapter as { isReadOnly: boolean }).isReadOnly = true;
    return adapter;
  }

  async readContract<T>(params: ReadContractParams): Promise<T> {
    try {
      const result = await this.publicClient.readContract({
        address: params.address,
        abi: params.abi as GetContractReturnType["abi"],
        functionName: params.functionName,
        args: params.args as unknown[],
      });
      return result as T;
    } catch (error) {
      throw new AegisProviderError(
        `readContract failed: ${params.functionName}`,
        error
      );
    }
  }

  async writeContract(params: WriteContractParams): Promise<Hex> {
    if (!this.walletClient) {
      throw new AegisProviderError(
        "Cannot write: provider is read-only. Use a ViemAdapter with a WalletClient."
      );
    }

    try {
      // Simulate first to catch reverts before sending
      const { request } = await this.publicClient.simulateContract({
        address: params.address,
        abi: params.abi as GetContractReturnType["abi"],
        functionName: params.functionName,
        args: params.args as unknown[],
        value: params.value,
        account: this.walletClient.account!,
      });

      const hash = await this.walletClient.writeContract(request);
      return hash as Hex;
    } catch (error) {
      if (error instanceof AegisProviderError) throw error;
      throw new AegisProviderError(
        `writeContract failed: ${params.functionName}`,
        error
      );
    }
  }

  async waitForTransaction(hash: Hex): Promise<TransactionReceipt> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      return {
        transactionHash: receipt.transactionHash as Hex,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
        logs: receipt.logs.map((log) => ({
          address: log.address as Hex,
          topics: (log.topics ?? []) as Hex[],
          data: log.data as Hex,
        })),
      };
    } catch (error) {
      throw new AegisProviderError(
        `waitForTransaction failed: ${hash}`,
        error
      );
    }
  }

  watchContractEvent(params: WatchEventParams): () => void {
    const unwatch = this.publicClient.watchContractEvent({
      address: params.address,
      abi: params.abi as GetContractReturnType["abi"],
      eventName: params.eventName,
      onLogs: params.onLogs as (logs: unknown[]) => void,
    });

    return unwatch;
  }

  async getAddress(): Promise<Hex> {
    if (!this.walletClient?.account) {
      throw new AegisProviderError(
        "No account available. Provide a WalletClient with an account."
      );
    }
    return this.walletClient.account.address as Hex;
  }

  async getChainId(): Promise<number> {
    return this.publicClient.getChainId();
  }
}
