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
 * AegisProvider implementation backed by ethers v6.
 *
 * Ethers is a peer dependency — it is imported dynamically so the SDK
 * does not fail if only viem is installed.
 *
 * Usage:
 *   import { ethers } from "ethers";
 *   const signer = await provider.getSigner();
 *   const aegis = new EthersAdapter(signer, provider);
 */
export class EthersAdapter implements AegisProvider {
  // Use `any` — ethers types are not available at compile time since
  // ethers is an optional peer dependency.
  private readonly signer: any;
  private readonly ethersProvider: any;
  readonly isReadOnly: boolean;

  constructor(signer: any, provider?: any) {
    this.signer = signer;
    this.ethersProvider = provider ?? signer;
    this.isReadOnly = false;
  }

  /**
   * Create a read-only adapter backed by an ethers Provider (no signer).
   */
  static readOnly(provider: any): EthersAdapter {
    const adapter = new EthersAdapter(null, provider);
    (adapter as any).isReadOnly = true;
    (adapter as any).signer = null;
    return adapter;
  }

  private async getEthers(): Promise<any> {
    try {
      return await import("ethers");
    } catch {
      throw new AegisProviderError(
        'ethers is not installed. Install it with: npm install ethers'
      );
    }
  }

  async readContract<T>(params: ReadContractParams): Promise<T> {
    const { Contract } = await this.getEthers();
    try {
      const contract = new Contract(
        params.address,
        params.abi as any,
        this.ethersProvider,
      );
      const result = await contract[params.functionName](
        ...(params.args ?? [])
      );
      return result as T;
    } catch (error) {
      throw new AegisProviderError(
        `readContract failed: ${params.functionName}`,
        error,
      );
    }
  }

  async writeContract(params: WriteContractParams): Promise<Hex> {
    if (!this.signer) {
      throw new AegisProviderError(
        "Cannot write: provider is read-only. Use an EthersAdapter with a Signer.",
      );
    }

    const { Contract } = await this.getEthers();
    try {
      const contract = new Contract(
        params.address,
        params.abi as any,
        this.signer,
      );
      const tx = await contract[params.functionName](
        ...(params.args ?? []),
        params.value != null ? { value: params.value } : {},
      );
      return tx.hash as Hex;
    } catch (error) {
      if (error instanceof AegisProviderError) throw error;
      throw new AegisProviderError(
        `writeContract failed: ${params.functionName}`,
        error,
      );
    }
  }

  async waitForTransaction(hash: Hex): Promise<TransactionReceipt> {
    try {
      const receipt = await this.ethersProvider.waitForTransaction(hash);

      if (!receipt) {
        throw new AegisProviderError(`Transaction not found: ${hash}`);
      }

      return {
        transactionHash: receipt.hash as Hex,
        blockNumber: BigInt(receipt.blockNumber),
        status: receipt.status === 1 ? "success" : "reverted",
        logs: receipt.logs.map((log: any) => ({
          address: log.address as Hex,
          topics: (log.topics ?? []) as Hex[],
          data: log.data as Hex,
        })),
      };
    } catch (error) {
      if (error instanceof AegisProviderError) throw error;
      throw new AegisProviderError(
        `waitForTransaction failed: ${hash}`,
        error,
      );
    }
  }

  watchContractEvent(params: WatchEventParams): () => void {
    let unsubscribed = false;

    void (async () => {
      const { Contract } = await this.getEthers();
      if (unsubscribed) return;

      const contract = new Contract(
        params.address,
        params.abi as any,
        this.ethersProvider,
      );

      contract.on(params.eventName, (...args: unknown[]) => {
        if (!unsubscribed) {
          params.onLogs(args);
        }
      });
    })();

    return () => {
      unsubscribed = true;
    };
  }

  async getAddress(): Promise<Hex> {
    if (!this.signer) {
      throw new AegisProviderError(
        "No signer available. Provide an EthersAdapter with a Signer.",
      );
    }
    const address = await this.signer.getAddress();
    return address as Hex;
  }

  async getChainId(): Promise<number> {
    const network = await this.ethersProvider.getNetwork();
    return Number(network.chainId);
  }
}
