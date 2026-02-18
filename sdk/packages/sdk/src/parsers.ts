import type {
  Hex,
  JobCreatedEvent,
  JobSettledEvent,
  DisputeInitiatedEvent,
  DisputeResolvedEvent,
  TemplateCreatedEvent,
} from "@aegis-protocol/types";
import {
  aegisEscrowAbi,
  aegisDisputeAbi,
  aegisJobFactoryAbi,
} from "@aegis-protocol/abis";
import type { TransactionReceipt } from "./provider";

// ---------------------------------------------------------------------------
// Generic log decoder
// ---------------------------------------------------------------------------

function findEventLog(
  receipt: TransactionReceipt,
  abi: readonly unknown[],
  eventName: string,
): { indexed: Record<string, unknown>; data: Record<string, unknown> } | null {
  const eventAbi = (abi as any[]).find(
    (entry) => entry.type === "event" && entry.name === eventName,
  );
  if (!eventAbi) return null;

  const inputs: Array<{ name: string; type: string; indexed: boolean }> = eventAbi.inputs;
  const indexedInputs = inputs.filter((i) => i.indexed);
  const nonIndexedInputs = inputs.filter((i) => !i.indexed);

  for (const log of receipt.logs) {
    if (log.topics.length !== 1 + indexedInputs.length) continue;

    try {
      const indexed: Record<string, unknown> = {};
      for (let i = 0; i < indexedInputs.length; i++) {
        const input = indexedInputs[i];
        const topic = log.topics[i + 1];
        indexed[input.name] = decodeParam(input.type, topic);
      }

      const data: Record<string, unknown> = {};
      if (nonIndexedInputs.length > 0 && log.data && log.data !== "0x") {
        const dataHex = log.data.slice(2);
        // Check if any non-indexed inputs are dynamic types (string, bytes)
        const hasDynamic = nonIndexedInputs.some(
          (i) => i.type === "string" || i.type === "bytes",
        );

        if (hasDynamic) {
          decodeDynamicData(dataHex, nonIndexedInputs, data);
        } else {
          for (let i = 0; i < nonIndexedInputs.length; i++) {
            const input = nonIndexedInputs[i];
            const chunk = dataHex.slice(i * 64, (i + 1) * 64);
            data[input.name] = decodeParam(input.type, `0x${chunk}` as Hex);
          }
        }
      }

      return { indexed, data };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Decode ABI-encoded data that contains dynamic types (string, bytes).
 *
 * In the ABI encoding, each slot in the head region contains either:
 * - A direct value for static types (uint256, address, bool, etc.)
 * - An offset (in bytes) pointing to the dynamic data in the tail region
 */
function decodeDynamicData(
  dataHex: string,
  inputs: Array<{ name: string; type: string }>,
  out: Record<string, unknown>,
): void {
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const headWord = dataHex.slice(i * 64, (i + 1) * 64);

    if (input.type === "string" || input.type === "bytes") {
      // Head word is the byte-offset into the data region
      const offset = Number(BigInt(`0x${headWord}`));
      const charOffset = offset * 2; // convert byte offset to hex-char offset
      const lengthWord = dataHex.slice(charOffset, charOffset + 64);
      const strLen = Number(BigInt(`0x${lengthWord}`));
      const strHex = dataHex.slice(charOffset + 64, charOffset + 64 + strLen * 2);

      if (input.type === "string") {
        // Decode UTF-8 from hex
        out[input.name] = hexToString(strHex);
      } else {
        out[input.name] = `0x${strHex}` as Hex;
      }
    } else {
      out[input.name] = decodeParam(input.type, `0x${headWord}` as Hex);
    }
  }
}

function hexToString(hex: string): string {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

function decodeParam(type: string, hex: Hex): unknown {
  const clean = hex.slice(2).padStart(64, "0");

  if (type === "bytes32") return `0x${clean}` as Hex;
  if (type === "address") return `0x${clean.slice(24)}` as Hex;
  if (type === "uint256" || type === "uint128" || type === "uint64") return BigInt(`0x${clean}`);
  if (type === "uint8") return Number(BigInt(`0x${clean}`));
  if (type === "int128") {
    const val = BigInt(`0x${clean}`);
    return val >= (1n << 127n) ? val - (1n << 128n) : val;
  }
  if (type === "bool") return BigInt(`0x${clean}`) !== 0n;
  if (type === "string") return `0x${clean}` as Hex;
  return `0x${clean}` as Hex;
}

// ---------------------------------------------------------------------------
// Public parsers
// ---------------------------------------------------------------------------

export function parseJobCreated(receipt: TransactionReceipt): JobCreatedEvent | null {
  const result = findEventLog(receipt, aegisEscrowAbi, "JobCreated");
  if (!result) return null;
  return {
    jobId: result.indexed.jobId as Hex,
    clientAgentId: result.indexed.clientAgentId as bigint,
    providerAgentId: result.indexed.providerAgentId as bigint,
    amount: result.data.amount as bigint,
    validatorAddress: result.data.validatorAddress as Hex,
    deadline: result.data.deadline as bigint,
  };
}

export function parseJobSettled(receipt: TransactionReceipt): JobSettledEvent | null {
  const result = findEventLog(receipt, aegisEscrowAbi, "JobSettled");
  if (!result) return null;
  return {
    jobId: result.indexed.jobId as Hex,
    providerWallet: result.indexed.providerWallet as Hex,
    providerAmount: result.data.providerAmount as bigint,
    protocolFee: result.data.protocolFee as bigint,
  };
}

export function parseDisputeInitiated(receipt: TransactionReceipt): DisputeInitiatedEvent | null {
  const result = findEventLog(receipt, aegisDisputeAbi, "DisputeInitiated");
  if (!result) return null;
  return {
    disputeId: result.indexed.disputeId as Hex,
    jobId: result.indexed.jobId as Hex,
    initiator: result.indexed.initiator as Hex,
  };
}

export function parseDisputeResolved(receipt: TransactionReceipt): DisputeResolvedEvent | null {
  const result = findEventLog(receipt, aegisDisputeAbi, "DisputeResolved");
  if (!result) return null;
  return {
    disputeId: result.indexed.disputeId as Hex,
    jobId: result.indexed.jobId as Hex,
    clientPercent: result.data.clientPercent as number,
    method: result.data.method as number,
  };
}

export function parseTemplateCreated(receipt: TransactionReceipt): TemplateCreatedEvent | null {
  const result = findEventLog(receipt, aegisJobFactoryAbi, "TemplateCreated");
  if (!result) return null;
  return {
    templateId: result.indexed.templateId as bigint,
    name: result.data.name as string,
    creator: result.indexed.creator as Hex,
    defaultValidator: result.data.defaultValidator as Hex,
    defaultTimeout: result.data.defaultTimeout as bigint,
  };
}
