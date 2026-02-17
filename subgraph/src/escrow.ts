import { BigInt, Bytes } from "@graphprotocol/graph-ts";

import {
  JobCreated,
  JobFunded,
  DeliverableSubmitted,
  ValidationReceived,
  JobSettled,
  JobRefunded,
  JobCancelled,
  DisputeRaised,
  ClientConfirmed,
  DisputeWindowStarted,
  FeedbackSubmitted,
  ProtocolFeeUpdated,
  DisputeWindowUpdated,
  TreasuryUpdated,
  DisputeContractUpdated,
  AuthorizedCallerUpdated,
} from "../generated/AegisEscrow/AegisEscrow";

import {
  Job,
  JobCreatedEvent,
  JobFundedEvent,
  DeliverableSubmittedEvent,
  ValidationReceivedEvent,
  JobSettledEvent,
  JobRefundedEvent,
  JobCancelledEvent,
  DisputeRaisedEvent,
  ClientConfirmedEvent,
  DisputeWindowStartedEvent,
  FeedbackSubmittedEvent,
  ProtocolFeeUpdatedEvent,
  DisputeWindowUpdatedEvent,
  TreasuryUpdatedEvent,
  DisputeContractUpdatedEvent,
  AuthorizedCallerUpdatedEvent,
} from "../generated/schema";

import {
  generateEventId,
  getOrCreateProtocolStats,
  getOrCreateDailyStats,
} from "./helpers";

// =============================================================================
// Job Lifecycle Handlers
// =============================================================================

export function handleJobCreated(event: JobCreated): void {
  // --- Create mutable Job entity ---
  let job = new Job(event.params.jobId);
  job.clientAgentId = event.params.clientAgentId;
  job.providerAgentId = event.params.providerAgentId;
  job.amount = event.params.amount;
  job.validatorAddress = changetype<Bytes>(event.params.validatorAddress);
  job.deadline = event.params.deadline;

  // Fields not available from event — use defaults
  job.clientAddress = changetype<Bytes>(event.transaction.from);
  job.providerWallet = Bytes.empty();
  job.jobSpecHash = Bytes.empty();
  job.jobSpecURI = "";
  job.protocolFeeBps = BigInt.zero();
  job.templateId = BigInt.zero();
  job.validationScore = 0;
  job.validationThreshold = 0;
  job.passedThreshold = false;

  // Nullable fields
  job.deliverableHash = null;
  job.deliverableURI = null;
  job.validationRequestHash = null;
  job.deliveredAt = null;
  job.settledAt = null;
  job.disputeWindowEnd = null;
  job.providerAmount = null;
  job.protocolFee = null;
  job.refundAmount = null;

  // Atomic funding — state is FUNDED at creation
  job.state = "FUNDED";
  job.resolution = "NONE";
  job.createdAt = event.block.timestamp;
  job.createdAtBlock = event.block.number;
  job.createdAtTx = event.transaction.hash;

  job.save();

  // --- Create immutable event entity ---
  let ev = new JobCreatedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.clientAgentId = event.params.clientAgentId;
  ev.providerAgentId = event.params.providerAgentId;
  ev.amount = event.params.amount;
  ev.validatorAddress = changetype<Bytes>(event.params.validatorAddress);
  ev.deadline = event.params.deadline;
  ev.job = event.params.jobId;
  ev.save();

  // --- Update aggregations ---
  let stats = getOrCreateProtocolStats();
  stats.totalJobs = stats.totalJobs.plus(BigInt.fromI32(1));
  stats.totalVolumeUSDC = stats.totalVolumeUSDC.plus(event.params.amount);
  stats.save();

  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.jobsCreated = daily.jobsCreated.plus(BigInt.fromI32(1));
  daily.volumeUSDC = daily.volumeUSDC.plus(event.params.amount);
  daily.save();
}

export function handleJobFunded(event: JobFunded): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.amount = event.params.amount;
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new JobFundedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.amount = event.params.amount;
  ev.job = event.params.jobId;
  ev.save();
}

export function handleDeliverableSubmitted(event: DeliverableSubmitted): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.state = "DELIVERED";
    job.deliverableURI = event.params.deliverableURI;
    job.deliverableHash = event.params.deliverableHash;
    job.validationRequestHash = event.params.validationRequestHash;
    job.deliveredAt = event.block.timestamp;
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new DeliverableSubmittedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.deliverableURI = event.params.deliverableURI;
  ev.deliverableHash = event.params.deliverableHash;
  ev.validationRequestHash = event.params.validationRequestHash;
  ev.job = event.params.jobId;
  ev.save();
}

export function handleValidationReceived(event: ValidationReceived): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.validationScore = event.params.score;
    job.passedThreshold = event.params.passedThreshold;
    if (event.params.passedThreshold) {
      job.state = "VALIDATING";
    }
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new ValidationReceivedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.score = event.params.score;
  ev.passedThreshold = event.params.passedThreshold;
  ev.job = event.params.jobId;
  ev.save();
}

export function handleJobSettled(event: JobSettled): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.state = "SETTLED";
    job.providerWallet = changetype<Bytes>(event.params.providerWallet);
    job.providerAmount = event.params.providerAmount;
    job.protocolFee = event.params.protocolFee;
    job.settledAt = event.block.timestamp;
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new JobSettledEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.providerWallet = changetype<Bytes>(event.params.providerWallet);
  ev.providerAmount = event.params.providerAmount;
  ev.protocolFee = event.params.protocolFee;
  ev.job = event.params.jobId;
  ev.save();

  // --- Update aggregations ---
  let stats = getOrCreateProtocolStats();
  stats.totalSettled = stats.totalSettled.plus(BigInt.fromI32(1));
  stats.totalFeesCollected = stats.totalFeesCollected.plus(
    event.params.protocolFee
  );
  stats.save();

  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.jobsSettled = daily.jobsSettled.plus(BigInt.fromI32(1));
  daily.feesCollected = daily.feesCollected.plus(event.params.protocolFee);
  daily.save();
}

export function handleJobRefunded(event: JobRefunded): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.state = "REFUNDED";
    job.refundAmount = event.params.amount;
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new JobRefundedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.clientAddress = changetype<Bytes>(event.params.clientAddress);
  ev.amount = event.params.amount;
  ev.job = event.params.jobId;
  ev.save();

  // --- Update aggregations ---
  let stats = getOrCreateProtocolStats();
  stats.totalRefunded = stats.totalRefunded.plus(BigInt.fromI32(1));
  stats.save();

  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.jobsRefunded = daily.jobsRefunded.plus(BigInt.fromI32(1));
  daily.save();
}

export function handleJobCancelled(event: JobCancelled): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.state = "CANCELLED";
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new JobCancelledEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.job = event.params.jobId;
  ev.save();
}

export function handleDisputeRaised(event: DisputeRaised): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.state = "DISPUTED";
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new DisputeRaisedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.initiator = changetype<Bytes>(event.params.initiator);
  ev.job = event.params.jobId;
  ev.save();

  // --- Update aggregations ---
  let stats = getOrCreateProtocolStats();
  stats.totalDisputed = stats.totalDisputed.plus(BigInt.fromI32(1));
  stats.save();

  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.jobsDisputed = daily.jobsDisputed.plus(BigInt.fromI32(1));
  daily.save();
}

export function handleClientConfirmed(event: ClientConfirmed): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.resolution = "CLIENT_CONFIRM";
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new ClientConfirmedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.job = event.params.jobId;
  ev.save();
}

export function handleDisputeWindowStarted(
  event: DisputeWindowStarted
): void {
  // --- Update mutable Job entity ---
  let job = Job.load(event.params.jobId);
  if (job != null) {
    job.state = "DISPUTE_WINDOW";
    job.disputeWindowEnd = event.params.windowEnd;
    job.save();
  }

  // --- Create immutable event entity ---
  let ev = new DisputeWindowStartedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.windowEnd = event.params.windowEnd;
  ev.job = event.params.jobId;
  ev.save();
}

export function handleFeedbackSubmitted(event: FeedbackSubmitted): void {
  // --- Create immutable event entity (no Job state change) ---
  let ev = new FeedbackSubmittedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.jobId = event.params.jobId;
  ev.agentId = event.params.agentId;
  ev.value = event.params.value;
  ev.job = event.params.jobId;
  ev.save();
}

// =============================================================================
// Admin Configuration Handlers
// =============================================================================

export function handleProtocolFeeUpdated(event: ProtocolFeeUpdated): void {
  let ev = new ProtocolFeeUpdatedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.oldFee = event.params.oldFee;
  ev.newFee = event.params.newFee;
  ev.save();
}

export function handleDisputeWindowUpdated(
  event: DisputeWindowUpdated
): void {
  let ev = new DisputeWindowUpdatedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.oldWindow = event.params.oldWindow;
  ev.newWindow = event.params.newWindow;
  ev.save();
}

export function handleTreasuryUpdated(event: TreasuryUpdated): void {
  let ev = new TreasuryUpdatedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.oldTreasury = changetype<Bytes>(event.params.oldTreasury);
  ev.newTreasury = changetype<Bytes>(event.params.newTreasury);
  ev.save();
}

export function handleDisputeContractUpdated(
  event: DisputeContractUpdated
): void {
  let ev = new DisputeContractUpdatedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.oldDispute = changetype<Bytes>(event.params.oldDispute);
  ev.newDispute = changetype<Bytes>(event.params.newDispute);
  ev.save();
}

export function handleAuthorizedCallerUpdated(
  event: AuthorizedCallerUpdated
): void {
  let ev = new AuthorizedCallerUpdatedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.caller = changetype<Bytes>(event.params.caller);
  ev.authorized = event.params.authorized;
  ev.save();
}
