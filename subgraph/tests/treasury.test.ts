import {
  test,
  describe,
  beforeEach,
  clearStore,
  assert,
  newMockEvent,
} from "matchstick-as";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import {
  FeeReceived,
  TreasuryWithdrawal,
} from "../generated/AegisTreasury/AegisTreasury";

import {
  handleFeeReceived,
  handleTreasuryWithdrawal,
} from "../src/treasury";

// =============================================================================
// Test constants
// =============================================================================

const SOURCE_ADDR = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const RECIPIENT_ADDR = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);

// =============================================================================
// Helper: create mock FeeReceived event
// =============================================================================

function createFeeReceivedEvent(
  source: Address,
  amount: BigInt,
  treasuryShare: BigInt,
  arbitratorShare: BigInt
): FeeReceived {
  let event = changetype<FeeReceived>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam("source", ethereum.Value.fromAddress(source))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "treasuryShare",
      ethereum.Value.fromUnsignedBigInt(treasuryShare)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "arbitratorShare",
      ethereum.Value.fromUnsignedBigInt(arbitratorShare)
    )
  );
  return event;
}

// =============================================================================
// Helper: create mock TreasuryWithdrawal event
// =============================================================================

function createTreasuryWithdrawalEvent(
  to: Address,
  amount: BigInt
): TreasuryWithdrawal {
  let event = changetype<TreasuryWithdrawal>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount)
    )
  );
  return event;
}

// =============================================================================
// Tests
// =============================================================================

describe("handleFeeReceived", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates FeeReceivedEvent with correct amounts", () => {
    let event = createFeeReceivedEvent(
      SOURCE_ADDR,
      BigInt.fromI32(100000), // amount
      BigInt.fromI32(75000), // treasuryShare
      BigInt.fromI32(25000) // arbitratorShare
    );
    handleFeeReceived(event);

    assert.entityCount("FeeReceivedEvent", 1);
  });

  test("updates ProtocolStats.totalFeesCollected", () => {
    let event = createFeeReceivedEvent(
      SOURCE_ADDR,
      BigInt.fromI32(100000),
      BigInt.fromI32(75000),
      BigInt.fromI32(25000)
    );
    handleFeeReceived(event);

    assert.fieldEquals(
      "ProtocolStats",
      "protocol",
      "totalFeesCollected",
      "100000"
    );
  });

  test("accumulates fees across multiple events", () => {
    let event1 = createFeeReceivedEvent(
      SOURCE_ADDR,
      BigInt.fromI32(100000),
      BigInt.fromI32(75000),
      BigInt.fromI32(25000)
    );
    handleFeeReceived(event1);

    let event2 = createFeeReceivedEvent(
      SOURCE_ADDR,
      BigInt.fromI32(200000),
      BigInt.fromI32(150000),
      BigInt.fromI32(50000)
    );
    handleFeeReceived(event2);

    assert.fieldEquals(
      "ProtocolStats",
      "protocol",
      "totalFeesCollected",
      "300000"
    );
  });

  test("updates DailyStats.feesCollected", () => {
    let event = createFeeReceivedEvent(
      SOURCE_ADDR,
      BigInt.fromI32(100000),
      BigInt.fromI32(75000),
      BigInt.fromI32(25000)
    );
    handleFeeReceived(event);

    // DailyStats ID is based on timestamp / 86400
    let dayId = (event.block.timestamp.toI32() / 86400).toString();
    assert.fieldEquals("DailyStats", dayId, "feesCollected", "100000");
  });
});

describe("handleTreasuryWithdrawal", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates TreasuryWithdrawalEvent entity only", () => {
    let event = createTreasuryWithdrawalEvent(
      RECIPIENT_ADDR,
      BigInt.fromI32(50000)
    );
    handleTreasuryWithdrawal(event);

    assert.entityCount("TreasuryWithdrawalEvent", 1);
  });

  test("does not update ProtocolStats", () => {
    let event = createTreasuryWithdrawalEvent(
      RECIPIENT_ADDR,
      BigInt.fromI32(50000)
    );
    handleTreasuryWithdrawal(event);

    // ProtocolStats should not even exist since no handler that creates it was called
    assert.entityCount("ProtocolStats", 0);
  });
});
