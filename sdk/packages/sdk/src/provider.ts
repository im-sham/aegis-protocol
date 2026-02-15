import type { Hex } from "@aegis-protocol/types";

// ---------------------------------------------------------------------------
// Provider abstraction — decouples the SDK from any specific Web3 library.
// ---------------------------------------------------------------------------

/**
 * Parameters for reading contract state (view / pure calls).
 */
export interface ReadContractParams {
  address: Hex;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Parameters for sending a state-changing transaction.
 */
export interface WriteContractParams {
  address: Hex;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/**
 * Minimal receipt returned after a transaction is mined.
 */
export interface TransactionReceipt {
  transactionHash: Hex;
  blockNumber: bigint;
  status: "success" | "reverted";
  logs: readonly {
    address: Hex;
    topics: readonly Hex[];
    data: Hex;
  }[];
}

/**
 * Parameters for subscribing to contract events.
 */
export interface WatchEventParams {
  address: Hex;
  abi: readonly unknown[];
  eventName: string;
  onLogs: (logs: readonly unknown[]) => void;
}

/**
 * Library-agnostic provider interface.
 *
 * Implement this with viem (ViemAdapter) or ethers (EthersAdapter) to use
 * the AEGIS SDK with your preferred Web3 stack.
 */
export interface AegisProvider {
  /** Read contract state (view / pure function). */
  readContract<T>(params: ReadContractParams): Promise<T>;

  /**
   * Send a state-changing transaction.
   * @throws {AegisProviderError} when the provider is read-only.
   */
  writeContract(params: WriteContractParams): Promise<Hex>;

  /** Wait for a transaction to be mined and return the receipt. */
  waitForTransaction(hash: Hex): Promise<TransactionReceipt>;

  /** Subscribe to contract events. Returns an unsubscribe function. */
  watchContractEvent(params: WatchEventParams): () => void;

  /** Get the connected wallet address. */
  getAddress(): Promise<Hex>;

  /** Get the chain ID of the connected network. */
  getChainId(): Promise<number>;

  /** True when the provider can only read, not write. */
  readonly isReadOnly: boolean;
}
