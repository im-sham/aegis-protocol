import { encodeFunctionData } from "viem";
import {
  aegisEscrowAbi,
  aegisDisputeAbi,
} from "@aegis-protocol/abis";
import type { Hex, ContractAddresses } from "@aegis-protocol/types";

export interface UnsignedTx {
  to: Hex;
  data: Hex;
  value: string;
  chainId: number;
  description: string;
}

export function encodeCreateJobTx(
  addresses: ContractAddresses,
  chainId: number,
  args: {
    clientAgentId: bigint;
    providerAgentId: bigint;
    jobSpecHash: Hex;
    jobSpecURI: string;
    validatorAddress: Hex;
    deadline: bigint;
    amount: bigint;
    validationThreshold: number;
  },
): UnsignedTx {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "createJob",
      args: [
        args.clientAgentId,
        args.providerAgentId,
        args.jobSpecHash,
        args.jobSpecURI,
        args.validatorAddress,
        args.deadline,
        args.amount,
        args.validationThreshold,
      ],
    }),
    value: "0",
    chainId,
    description: `Create escrow job: ${args.clientAgentId} → ${args.providerAgentId}`,
  };
}

export function encodeDeliverWorkTx(
  addresses: ContractAddresses,
  chainId: number,
  args: { jobId: Hex; deliverableURI: string; deliverableHash: Hex },
): UnsignedTx {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "submitDeliverable",
      args: [args.jobId, args.deliverableURI, args.deliverableHash],
    }),
    value: "0",
    chainId,
    description: `Submit deliverable for job ${args.jobId}`,
  };
}

export function encodeConfirmDeliveryTx(
  addresses: ContractAddresses,
  chainId: number,
  jobId: Hex,
): UnsignedTx {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "confirmDelivery",
      args: [jobId],
    }),
    value: "0",
    chainId,
    description: `Confirm delivery for job ${jobId}`,
  };
}

export function encodeSettleAfterWindowTx(
  addresses: ContractAddresses,
  chainId: number,
  jobId: Hex,
): UnsignedTx {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "settleAfterDisputeWindow",
      args: [jobId],
    }),
    value: "0",
    chainId,
    description: `Settle job ${jobId} after dispute window`,
  };
}

export function encodeRaiseDisputeTx(
  addresses: ContractAddresses,
  chainId: number,
  args: { jobId: Hex; evidenceURI: string; evidenceHash: Hex },
): UnsignedTx {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "raiseDispute",
      args: [args.jobId, args.evidenceURI, args.evidenceHash],
    }),
    value: "0",
    chainId,
    description: `Raise dispute on job ${args.jobId}`,
  };
}

export function encodeClaimTimeoutTx(
  addresses: ContractAddresses,
  chainId: number,
  jobId: Hex,
): UnsignedTx {
  return {
    to: addresses.escrow,
    data: encodeFunctionData({
      abi: aegisEscrowAbi,
      functionName: "claimTimeout",
      args: [jobId],
    }),
    value: "0",
    chainId,
    description: `Claim timeout refund for job ${jobId}`,
  };
}
