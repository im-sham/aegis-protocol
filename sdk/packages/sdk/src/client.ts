import type { PublicClient, WalletClient } from "viem";
import { createPublicClient, http } from "viem";
import { baseSepolia, base } from "viem/chains";
import type {
  SupportedChain,
  ChainConfig,
  ContractAddresses,
} from "@aegis-protocol/types";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
import { ViemAdapter } from "./adapters/viem";
import { EthersAdapter } from "./adapters/ethers";
import type { AegisProvider } from "./provider";
import { EscrowService } from "./escrow";
import { DisputeService } from "./dispute";
import { TreasuryService } from "./treasury";
import { FactoryService } from "./factory";
import { IdentityService } from "./erc8004/identity";
import { ReputationService } from "./erc8004/reputation";
import { ValidationService } from "./erc8004/validation";
import { USDCService } from "./usdc";

// ---------------------------------------------------------------------------
// Option interfaces
// ---------------------------------------------------------------------------

/**
 * Options for creating an AegisClient backed by viem.
 */
export interface ViemClientOptions {
  walletClient: WalletClient;
  publicClient: PublicClient;
  chain: SupportedChain | ChainConfig;
  contracts?: Partial<ContractAddresses>;
}

/**
 * Options for creating an AegisClient backed by ethers v6.
 */
export interface EthersClientOptions {
  signer: any;
  provider?: any;
  chain: SupportedChain | ChainConfig;
  contracts?: Partial<ContractAddresses>;
}

/**
 * Options for creating a read-only AegisClient (no write capabilities).
 */
export interface ReadOnlyClientOptions {
  rpcUrl?: string;
  chain: SupportedChain | ChainConfig;
  contracts?: Partial<ContractAddresses>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const CHAIN_MAP = { "base-sepolia": baseSepolia, base: base } as const;

function resolveChainConfig(chain: SupportedChain | ChainConfig): ChainConfig {
  if (typeof chain === "string") {
    const config = CHAIN_CONFIGS[chain];
    if (!config) throw new Error(`Unknown chain: "${chain}"`);
    return config;
  }
  return chain;
}

function resolveAddresses(
  chain: SupportedChain | ChainConfig,
  overrides?: Partial<ContractAddresses>,
): ContractAddresses {
  const config = resolveChainConfig(chain);
  return { ...config.contracts, ...overrides };
}

// ---------------------------------------------------------------------------
// AegisClient
// ---------------------------------------------------------------------------

/**
 * Unified entry point for the AEGIS Protocol SDK.
 *
 * Exposes all service modules (Escrow, Dispute, Treasury, Factory) and
 * ERC-8004 registry wrappers (Identity, Reputation, Validation) as
 * public readonly properties.
 *
 * Create an instance using one of the static factory methods:
 *   - `AegisClient.fromViem(options)` — backed by viem
 *   - `AegisClient.fromEthers(options)` — backed by ethers v6
 *   - `AegisClient.readOnly(options)` — read-only (no write capabilities)
 *
 * @example
 * ```ts
 * import { AegisClient } from "@aegis-protocol/sdk";
 * import { createPublicClient, createWalletClient, http } from "viem";
 * import { baseSepolia } from "viem/chains";
 *
 * const aegis = AegisClient.fromViem({
 *   walletClient,
 *   publicClient,
 *   chain: "base-sepolia",
 * });
 *
 * const job = await aegis.escrow.getJob(jobId);
 * ```
 */
export class AegisClient {
  public readonly escrow: EscrowService;
  public readonly dispute: DisputeService;
  public readonly treasury: TreasuryService;
  public readonly factory: FactoryService;
  public readonly identity: IdentityService;
  public readonly reputation: ReputationService;
  public readonly validation: ValidationService;
  public readonly usdc: USDCService;

  private readonly provider: AegisProvider;

  private constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.escrow = new EscrowService(provider, addresses);
    this.dispute = new DisputeService(provider, addresses);
    this.treasury = new TreasuryService(provider, addresses);
    this.factory = new FactoryService(provider, addresses);
    this.identity = new IdentityService(provider, addresses);
    this.reputation = new ReputationService(provider, addresses);
    this.validation = new ValidationService(provider, addresses);
    this.usdc = new USDCService(provider, addresses);
  }

  /**
   * Create an AegisClient backed by viem.
   */
  static fromViem(options: ViemClientOptions): AegisClient {
    const adapter = new ViemAdapter(options.walletClient, options.publicClient);
    const addresses = resolveAddresses(options.chain, options.contracts);
    return new AegisClient(adapter, addresses);
  }

  /**
   * Create an AegisClient backed by ethers v6.
   */
  static fromEthers(options: EthersClientOptions): AegisClient {
    const adapter = new EthersAdapter(options.signer, options.provider);
    const addresses = resolveAddresses(options.chain, options.contracts);
    return new AegisClient(adapter, addresses);
  }

  /**
   * Create a read-only AegisClient (no write capabilities).
   * Uses viem's createPublicClient under the hood.
   */
  static readOnly(options: ReadOnlyClientOptions): AegisClient {
    const chainConfig = resolveChainConfig(options.chain);
    const rpcUrl = options.rpcUrl ?? chainConfig.rpcUrl;
    const viemChain =
      typeof options.chain === "string"
        ? CHAIN_MAP[options.chain]
        : undefined;
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl),
    }) as PublicClient;
    const adapter = ViemAdapter.readOnly(publicClient);
    const addresses = resolveAddresses(options.chain, options.contracts);
    return new AegisClient(adapter, addresses);
  }

  /**
   * Get the connected wallet address.
   */
  async getAddress() {
    return this.provider.getAddress();
  }

  /**
   * Get the chain ID of the connected network.
   */
  async getChainId() {
    return this.provider.getChainId();
  }
}
