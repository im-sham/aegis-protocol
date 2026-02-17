import { AegisClient } from "@aegis-protocol/sdk";
import { CHAIN_CONFIGS, type SupportedChain, type ContractAddresses } from "@aegis-protocol/types";

export function createSdkClient(chain: SupportedChain, rpcUrl: string): AegisClient {
  return AegisClient.readOnly({ chain, rpcUrl });
}

export function getContractAddresses(chain: SupportedChain): ContractAddresses {
  return CHAIN_CONFIGS[chain].contracts;
}

export function getContractWhitelist(chain: SupportedChain): Set<string> {
  const addrs = getContractAddresses(chain);
  return new Set([
    addrs.escrow.toLowerCase(),
    addrs.dispute.toLowerCase(),
    addrs.treasury.toLowerCase(),
    addrs.factory.toLowerCase(),
  ]);
}
