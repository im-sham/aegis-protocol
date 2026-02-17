import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { ProtocolStats, DailyStats, Arbitrator } from "../generated/schema";

// === ID Generation ===

export function generateEventId(event: ethereum.Event): Bytes {
  return event.transaction.hash.concatI32(event.logIndex.toI32());
}

// === Singleton/Aggregation Loaders ===

export function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load("protocol");
  if (stats == null) {
    stats = new ProtocolStats("protocol");
    stats.totalJobs = BigInt.zero();
    stats.totalSettled = BigInt.zero();
    stats.totalDisputed = BigInt.zero();
    stats.totalRefunded = BigInt.zero();
    stats.totalVolumeUSDC = BigInt.zero();
    stats.totalFeesCollected = BigInt.zero();
    stats.totalDisputeBonds = BigInt.zero();
    stats.totalTemplates = BigInt.zero();
    stats.activeArbitrators = BigInt.zero();
    stats.save();
  }
  return stats;
}

export function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dayId = timestamp.toI32() / 86400;
  let id = dayId.toString();
  let stats = DailyStats.load(id);
  if (stats == null) {
    stats = new DailyStats(id);
    stats.date = dayId;
    stats.jobsCreated = BigInt.zero();
    stats.jobsSettled = BigInt.zero();
    stats.jobsDisputed = BigInt.zero();
    stats.jobsRefunded = BigInt.zero();
    stats.volumeUSDC = BigInt.zero();
    stats.feesCollected = BigInt.zero();
    stats.save();
  }
  return stats;
}

export function getOrCreateArbitrator(address: Bytes): Arbitrator {
  let arb = Arbitrator.load(address);
  if (arb == null) {
    arb = new Arbitrator(address);
    arb.totalStaked = BigInt.zero();
    arb.totalSlashed = BigInt.zero();
    arb.disputesAssigned = BigInt.zero();
    arb.disputesResolved = BigInt.zero();
    arb.firstStakedAt = BigInt.zero();
    arb.lastActivityAt = BigInt.zero();
    arb.save();
  }
  return arb;
}

// === Enum Converters ===

export function jobStateToString(state: i32): string {
  switch (state) {
    case 0: return "CREATED";
    case 1: return "FUNDED";
    case 2: return "DELIVERED";
    case 3: return "VALIDATING";
    case 4: return "DISPUTE_WINDOW";
    case 5: return "SETTLED";
    case 6: return "DISPUTED";
    case 7: return "RESOLVED";
    case 8: return "EXPIRED";
    case 9: return "REFUNDED";
    case 10: return "CANCELLED";
    default: return "UNKNOWN";
  }
}

export function resolutionToString(resolution: i32): string {
  switch (resolution) {
    case 0: return "NONE";
    case 1: return "RE_VALIDATION";
    case 2: return "ARBITRATOR";
    case 3: return "TIMEOUT_DEFAULT";
    case 4: return "CLIENT_CONFIRM";
    default: return "UNKNOWN";
  }
}
