import {
  createPublicClient,
  webSocket,
  http,
  type PublicClient,
  type Log,
} from "viem";
import { baseSepolia, base } from "viem/chains";
import type { SupportedChain, ContractAddresses } from "@aegis-protocol/types";
import { AegisEscrowAbi } from "@aegis-protocol/abis";
import { AegisDisputeAbi } from "@aegis-protocol/abis";
import { AegisTreasuryAbi } from "@aegis-protocol/abis";
import { AegisJobFactoryAbi } from "@aegis-protocol/abis";

const CHAIN_MAP = { "base-sepolia": baseSepolia, base } as const;

export interface StreamFilters {
  jobId?: string;
  contract?: string;
  eventType?: string;
}

export function parseStreamFilters(query: Record<string, string | undefined>): StreamFilters {
  return {
    jobId: query.job,
    contract: query.contract,
    eventType: query.type,
  };
}

export interface EventSubscriber {
  send: (event: string, data: unknown) => void;
  close: () => void;
}

type UnwatchFn = () => void;

export function watchAllContracts(
  rpcUrl: string,
  chain: SupportedChain,
  addresses: ContractAddresses,
  onEvent: (contractName: string, eventName: string, log: Log) => void,
): UnwatchFn {
  const transport = rpcUrl.startsWith("ws") ? webSocket(rpcUrl) : http(rpcUrl);
  const client = createPublicClient({ chain: CHAIN_MAP[chain], transport });

  const unwatchers: UnwatchFn[] = [];

  // Watch each contract
  const contracts = [
    { name: "escrow", address: addresses.escrow, abi: AegisEscrowAbi },
    { name: "dispute", address: addresses.dispute, abi: AegisDisputeAbi },
    { name: "treasury", address: addresses.treasury, abi: AegisTreasuryAbi },
    { name: "factory", address: addresses.factory, abi: AegisJobFactoryAbi },
  ] as const;

  for (const { name, address, abi } of contracts) {
    const unwatch = client.watchContractEvent({
      address: address as `0x${string}`,
      abi,
      onLogs: (logs) => {
        for (const log of logs) {
          onEvent(name, (log as any).eventName ?? "unknown", log);
        }
      },
    });
    unwatchers.push(unwatch);
  }

  return () => {
    for (const unwatch of unwatchers) unwatch();
  };
}

export function matchesFilters(
  contractName: string,
  eventName: string,
  log: Log,
  filters: StreamFilters,
): boolean {
  if (filters.contract && filters.contract !== contractName) return false;
  if (filters.eventType && filters.eventType !== eventName) return false;
  if (filters.jobId) {
    // Check if any topic or arg contains the jobId
    const logStr = JSON.stringify(log).toLowerCase();
    if (!logStr.includes(filters.jobId.toLowerCase())) return false;
  }
  return true;
}
