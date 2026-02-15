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
  private readonly signer: unknown; // ethers.Signer
  private readonly ethersProvider: unknown; // ethers.Provider
  readonly isReadOnly: boolean;

  constructor(signer: unknown, provider?: unknown) {
    this.signer = signer;
    this.ethersProvider = provider ?? signer;
    this.isReadOnly = false;
  }

  /**
   * Create a read-only adapter backed by an ethers Provider (no signer).
   */
  static readOnly(provider: unknown): EthersAdapter {
    const adapter = Object.create(EthersAdapter.prototype) as EthersAdapter;
    (adapter as { signer: unknown }).signer = null;
    (adapter as { ethersProvider: unknown }).ethersProvider = provider;
    (adapter as { isReadOnly: boolean }).isReadOnly = true;
    return adapter;
  }

  private async getEthers(): Promise<typeof import("ethers")> {
    try {
      return await import("ethers");
    } catch {
      throw new AegisProviderError(
        'ethers is not installed. Install it with: npm install ethers"'
      );
    }
  }

  async readContract<T>(params: ReadContractParams): Promise<T> {
    const ethers = await this.getEthers();
    try {
      const contract = new ethers.Contract(
        params.address,
        params.abi as ethers.InterfaceAbi,
        this.ethersProvider as ethers.Provider
      );
      const result = await contract[params.functionName](
        ...(params.args ?? [])
      );
      return result as T;
    } catch (error) {
      throw new AegisProviderError(
        `readContract failed: ${params.functionName}`,
        error
      );
    }
  }

  async writeContract(params: WriteContractParams): Promise<Hex> {
    if (!this.signer) {
      throw new AegisProviderError(
        "Cannot write: provider is read-only. Use an EthersAdapter with a Signer."
      );
    }

    const ethers = await this.getEthers();
    try {
      const contract = new ethers.Contract(
        params.address,
        params.abi as ethers.InterfaceAbi,
        this.signer as ethers.Signer
      );
      const tx = await contract[params.functionName](
        ...(params.args ?? []),
        params.value != null ? { value: params.value } : {}
      );
      return tx.hash as Hex;
    } catch (error) {
      if (error instanceof AegisProviderError) throw error;
      throw new AegisProviderError(
        `writeContract failed: ${params.functionName}`,
        error
      );
    }
  }

  async waitForTransaction(hash: Hex): Promise<TransactionReceipt> {
    const ethers = await this.getEthers();
    try {
      const provider = this.ethersProvider as ethers.Provider;
      const receipt = await provider.waitForTransaction(hash);

      if (!receipt) {
        throw new AegisProviderError(`Transaction not found: ${hash}`);
      }

      return {
        transactionHash: receipt.hash as Hex,
        blockNumber: BigInt(receipt.blockNumber),
        status: receipt.status === 1 ? "success" : "reverted",
        logs: receipt.logs.map((log) => ({
          address: log.address as Hex,
          topics: (log.topics ?? []) as Hex[],
          data: log.data as Hex,
        })),
      };
    } catch (error) {
      if (error instanceof AegisProviderError) throw error;
      throw new AegisProviderError(
        `waitForTransaction failed: ${hash}`,
        error
      );
    }
  }

  watchContractEvent(params: WatchEventParams): () => void {
    // ethers uses a synchronous setup with event listeners.
    // We create the contract immediately (ethers should already be loaded
    // if any prior call has been made). For simplicity, we require
    // the dynamic import to have resolved before calling watch.
    let unsubscribed = false;

    void (async () => {
      const ethers = await this.getEthers();
      if (unsubscribed) return;

      const contract = new ethers.Contract(
        params.address,
        params.abi as ethers.InterfaceAbi,
        this.ethersProvider as ethers.Provider
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
        "No signer available. Provide an EthersAdapter with a Signer."
      );
    }
    const ethers = await this.getEthers();
    const address = await (
      this.signer as ethers.Signer
    ).getAddress();
    return address as Hex;
  }

  async getChainId(): Promise<number> {
    const ethers = await this.getEthers();
    const provider = this.ethersProvider as ethers.Provider;
    const network = await provider.getNetwork();
    return Number(network.chainId);
  }
}
