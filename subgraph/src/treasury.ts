import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  FeeReceived,
  TreasuryWithdrawal,
  ArbitratorRewardsDistributed,
  SourceAuthorized,
  ArbitratorPoolBpsUpdated
} from "../generated/AegisTreasury/AegisTreasury";
import {
  FeeReceivedEvent,
  TreasuryWithdrawalEvent,
  ArbitratorRewardsDistributedEvent,
  SourceAuthorizedEvent,
  ArbitratorPoolBpsUpdatedEvent
} from "../generated/schema";
import {
  generateEventId,
  getOrCreateProtocolStats,
  getOrCreateDailyStats
} from "./helpers";

// === handleFeeReceived ===
// Creates FeeReceivedEvent entity. Updates ProtocolStats.totalFeesCollected
// and DailyStats.feesCollected with the fee amount.

export function handleFeeReceived(event: FeeReceived): void {
  let id = generateEventId(event);
  let entity = new FeeReceivedEvent(id);

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.source = changetype<Bytes>(event.params.source);
  entity.amount = event.params.amount;
  entity.treasuryShare = event.params.treasuryShare;
  entity.arbitratorShare = event.params.arbitratorShare;
  entity.save();

  // Update aggregate: ProtocolStats
  let stats = getOrCreateProtocolStats();
  stats.totalFeesCollected = stats.totalFeesCollected.plus(event.params.amount);
  stats.save();

  // Update aggregate: DailyStats
  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.feesCollected = daily.feesCollected.plus(event.params.amount);
  daily.save();
}

// === handleTreasuryWithdrawal ===
// Creates TreasuryWithdrawalEvent entity only. No aggregate updates.

export function handleTreasuryWithdrawal(event: TreasuryWithdrawal): void {
  let id = generateEventId(event);
  let entity = new TreasuryWithdrawalEvent(id);

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.to = changetype<Bytes>(event.params.to);
  entity.amount = event.params.amount;
  entity.save();
}

// === handleArbitratorRewardsDistributed ===
// Creates ArbitratorRewardsDistributedEvent entity only. No aggregate updates.

export function handleArbitratorRewardsDistributed(
  event: ArbitratorRewardsDistributed
): void {
  let id = generateEventId(event);
  let entity = new ArbitratorRewardsDistributedEvent(id);

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.amount = event.params.amount;
  entity.save();
}

// === handleSourceAuthorized ===
// Creates SourceAuthorizedEvent entity only. No aggregate updates.

export function handleSourceAuthorized(event: SourceAuthorized): void {
  let id = generateEventId(event);
  let entity = new SourceAuthorizedEvent(id);

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.source = changetype<Bytes>(event.params.source);
  entity.authorized = event.params.authorized;
  entity.save();
}

// === handleArbitratorPoolBpsUpdated ===
// Creates ArbitratorPoolBpsUpdatedEvent entity only. No aggregate updates.

export function handleArbitratorPoolBpsUpdated(
  event: ArbitratorPoolBpsUpdated
): void {
  let id = generateEventId(event);
  let entity = new ArbitratorPoolBpsUpdatedEvent(id);

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.oldBps = event.params.oldBps;
  entity.newBps = event.params.newBps;
  entity.save();
}
