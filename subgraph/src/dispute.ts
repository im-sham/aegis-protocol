import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  DisputeInitiated,
  EvidenceSubmitted,
  ArbitratorAssigned,
  DisputeResolved,
  ReValidationRequested,
  ArbitratorStaked,
  ArbitratorUnstaked,
  ArbitratorSlashed,
  BondReturned,
  BondForfeited,
} from "../generated/AegisDispute/AegisDispute";
import {
  Job,
  Dispute,
  DisputeInitiatedEvent,
  EvidenceSubmittedEvent,
  ArbitratorAssignedEvent,
  DisputeResolvedEvent,
  ReValidationRequestedEvent,
  ArbitratorStakedEvent,
  ArbitratorUnstakedEvent,
  ArbitratorSlashedEvent,
  BondReturnedEvent,
  BondForfeitedEvent,
} from "../generated/schema";
import {
  generateEventId,
  getOrCreateProtocolStats,
  getOrCreateArbitrator,
  resolutionToString,
} from "./helpers";

// =============================================================================
// DisputeInitiated — Create new Dispute entity, link to Job
// =============================================================================

export function handleDisputeInitiated(event: DisputeInitiated): void {
  let disputeId = event.params.disputeId;
  let jobId = event.params.jobId;

  // Create mutable Dispute entity
  let dispute = new Dispute(disputeId);
  dispute.job = jobId;
  dispute.jobId = jobId;
  dispute.initiator = changetype<Bytes>(event.params.initiator);
  dispute.resolved = false;
  dispute.createdAt = event.block.timestamp;
  dispute.createdAtBlock = event.block.number;
  dispute.createdAtTx = event.transaction.hash;
  dispute.save();

  // Create immutable event entity
  let ev = new DisputeInitiatedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.disputeId = disputeId;
  ev.jobId = jobId;
  ev.initiator = changetype<Bytes>(event.params.initiator);
  ev.dispute = disputeId;
  ev.job = jobId;
  ev.save();
}

// =============================================================================
// EvidenceSubmitted — Create event entity, no Dispute mutation
// =============================================================================

export function handleEvidenceSubmitted(event: EvidenceSubmitted): void {
  let ev = new EvidenceSubmittedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.disputeId = event.params.disputeId;
  ev.submitter = changetype<Bytes>(event.params.submitter);
  ev.evidenceURI = event.params.evidenceURI;
  ev.dispute = event.params.disputeId;
  ev.save();
}

// =============================================================================
// ArbitratorAssigned — Update Dispute.arbitrator, update Arbitrator stats
// =============================================================================

export function handleArbitratorAssigned(event: ArbitratorAssigned): void {
  let disputeId = event.params.disputeId;
  let arbitratorAddress = changetype<Bytes>(event.params.arbitrator);

  // Update Dispute entity
  let dispute = Dispute.load(disputeId);
  if (dispute != null) {
    dispute.arbitrator = arbitratorAddress;
    dispute.save();
  }

  // Update Arbitrator entity
  let arb = getOrCreateArbitrator(arbitratorAddress);
  arb.disputesAssigned = arb.disputesAssigned.plus(BigInt.fromI32(1));
  arb.lastActivityAt = event.block.timestamp;
  arb.save();

  // Create immutable event entity
  let ev = new ArbitratorAssignedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.disputeId = disputeId;
  ev.arbitrator = arbitratorAddress;
  ev.dispute = disputeId;
  ev.save();
}

// =============================================================================
// DisputeResolved — Resolve Dispute, update Job state, update Arbitrator
// =============================================================================

export function handleDisputeResolved(event: DisputeResolved): void {
  let disputeId = event.params.disputeId;
  let jobId = event.params.jobId;
  let clientPercent = event.params.clientPercent;
  let method = event.params.method;

  // Update Dispute entity
  let dispute = Dispute.load(disputeId);
  if (dispute !== null) {
    dispute.resolved = true;
    dispute.method = resolutionToString(method);
    dispute.clientPercent = clientPercent;
    dispute.resolvedAt = event.block.timestamp;
    dispute.save();
  }

  // If method == 2 (ARBITRATOR), try to update arbitrator stats
  if (method == 2 && dispute !== null) {
    let arbAddr = dispute.arbitrator;
    if (arbAddr !== null) {
      let arb = getOrCreateArbitrator(arbAddr as Bytes);
      arb.disputesResolved = arb.disputesResolved.plus(BigInt.fromI32(1));
      arb.lastActivityAt = event.block.timestamp;
      arb.save();
    }
  }

  // Update Job state to RESOLVED
  let job = Job.load(jobId);
  if (job !== null) {
    job.state = "RESOLVED";
    job.save();
  }

  // Create immutable event entity
  let ev = new DisputeResolvedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.disputeId = disputeId;
  ev.jobId = jobId;
  ev.clientPercent = clientPercent;
  ev.method = method;
  ev.dispute = disputeId;
  ev.job = jobId;
  ev.save();
}

// =============================================================================
// ReValidationRequested — Create event entity only
// =============================================================================

export function handleReValidationRequested(
  event: ReValidationRequested
): void {
  let ev = new ReValidationRequestedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.disputeId = event.params.disputeId;
  ev.newValidationHash = event.params.newValidationHash;
  ev.dispute = event.params.disputeId;
  ev.save();
}

// =============================================================================
// ArbitratorStaked — Update Arbitrator, ProtocolStats
// =============================================================================

export function handleArbitratorStaked(event: ArbitratorStaked): void {
  let arbitratorAddress = changetype<Bytes>(event.params.arbitrator);
  let amount = event.params.amount;

  // Load or create Arbitrator
  let arb = getOrCreateArbitrator(arbitratorAddress);
  let isNewArbitrator = arb.firstStakedAt.equals(BigInt.zero());

  arb.totalStaked = arb.totalStaked.plus(amount);
  if (isNewArbitrator) {
    arb.firstStakedAt = event.block.timestamp;
  }
  arb.lastActivityAt = event.block.timestamp;
  arb.save();

  // Update ProtocolStats
  let stats = getOrCreateProtocolStats();
  if (isNewArbitrator) {
    stats.activeArbitrators = stats.activeArbitrators.plus(BigInt.fromI32(1));
  }
  stats.totalDisputeBonds = stats.totalDisputeBonds.plus(amount);
  stats.save();

  // Create immutable event entity
  let ev = new ArbitratorStakedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.arbitratorAddress = arbitratorAddress;
  ev.amount = amount;
  ev.save();
}

// =============================================================================
// ArbitratorUnstaked — Update Arbitrator, decrement active if stake reaches 0
// =============================================================================

export function handleArbitratorUnstaked(event: ArbitratorUnstaked): void {
  let arbitratorAddress = changetype<Bytes>(event.params.arbitrator);
  let amount = event.params.amount;

  let arb = getOrCreateArbitrator(arbitratorAddress);
  arb.totalStaked = arb.totalStaked.minus(amount);
  arb.lastActivityAt = event.block.timestamp;
  arb.save();

  // If stake reached zero, decrement active arbitrators
  if (arb.totalStaked.equals(BigInt.zero())) {
    let stats = getOrCreateProtocolStats();
    stats.activeArbitrators = stats.activeArbitrators.minus(BigInt.fromI32(1));
    stats.save();
  }

  // Create immutable event entity
  let ev = new ArbitratorUnstakedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.arbitratorAddress = arbitratorAddress;
  ev.amount = amount;
  ev.save();
}

// =============================================================================
// ArbitratorSlashed — Add to totalSlashed, subtract from totalStaked
// =============================================================================

export function handleArbitratorSlashed(event: ArbitratorSlashed): void {
  let arbitratorAddress = changetype<Bytes>(event.params.arbitrator);
  let amount = event.params.amount;

  let arb = getOrCreateArbitrator(arbitratorAddress);
  arb.totalSlashed = arb.totalSlashed.plus(amount);
  arb.totalStaked = arb.totalStaked.minus(amount);
  arb.lastActivityAt = event.block.timestamp;
  arb.save();

  // If stake reached zero, decrement active arbitrators
  if (arb.totalStaked.equals(BigInt.zero())) {
    let stats = getOrCreateProtocolStats();
    stats.activeArbitrators = stats.activeArbitrators.minus(BigInt.fromI32(1));
    stats.save();
  }

  // Create immutable event entity
  let ev = new ArbitratorSlashedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.arbitratorAddress = arbitratorAddress;
  ev.amount = amount;
  ev.save();
}

// =============================================================================
// BondReturned — Create event entity linked to dispute
// =============================================================================

export function handleBondReturned(event: BondReturned): void {
  let ev = new BondReturnedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.disputeId = event.params.disputeId;
  ev.to = changetype<Bytes>(event.params.to);
  ev.amount = event.params.amount;
  ev.dispute = event.params.disputeId;
  ev.save();
}

// =============================================================================
// BondForfeited — Create event entity linked to dispute
// =============================================================================

export function handleBondForfeited(event: BondForfeited): void {
  let ev = new BondForfeitedEvent(generateEventId(event));
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.logIndex = event.logIndex;
  ev.disputeId = event.params.disputeId;
  ev.from = changetype<Bytes>(event.params.from);
  ev.amount = event.params.amount;
  ev.dispute = event.params.disputeId;
  ev.save();
}
