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
  DisputeInitiated,
  EvidenceSubmitted,
  ArbitratorAssigned,
  DisputeResolved,
  ArbitratorStaked,
  ArbitratorSlashed,
} from "../generated/AegisDispute/AegisDispute";

import {
  handleDisputeInitiated,
  handleArbitratorAssigned,
  handleDisputeResolved,
  handleArbitratorStaked,
  handleArbitratorSlashed,
} from "../src/dispute";

import { handleJobCreated } from "../src/escrow";
import { JobCreated } from "../generated/AegisEscrow/AegisEscrow";

// =============================================================================
// Test constants
// =============================================================================

const DISPUTE_ID = Bytes.fromHexString(
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
);
const JOB_ID = Bytes.fromHexString(
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
);
const INITIATOR = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const ARBITRATOR_ADDR = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);
const VALIDATOR_ADDR = Address.fromString(
  "0x3333333333333333333333333333333333333333"
);

// =============================================================================
// Helper: create a Job entity via the escrow handler so the store has it
// =============================================================================

function createJobViaHandler(jobId: Bytes): void {
  let event = changetype<JobCreated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "clientAgentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "providerAgentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "validatorAddress",
      ethereum.Value.fromAddress(VALIDATOR_ADDR)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "deadline",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1700000000))
    )
  );
  handleJobCreated(event);
}

// =============================================================================
// Helper: create mock DisputeInitiated event
// =============================================================================

function createDisputeInitiatedEvent(
  disputeId: Bytes,
  jobId: Bytes,
  initiator: Address
): DisputeInitiated {
  let event = changetype<DisputeInitiated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "disputeId",
      ethereum.Value.fromFixedBytes(disputeId)
    )
  );
  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "initiator",
      ethereum.Value.fromAddress(initiator)
    )
  );
  return event;
}

// =============================================================================
// Helper: create mock ArbitratorAssigned event
// =============================================================================

function createArbitratorAssignedEvent(
  disputeId: Bytes,
  arbitrator: Address
): ArbitratorAssigned {
  let event = changetype<ArbitratorAssigned>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "disputeId",
      ethereum.Value.fromFixedBytes(disputeId)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "arbitrator",
      ethereum.Value.fromAddress(arbitrator)
    )
  );
  return event;
}

// =============================================================================
// Helper: create mock DisputeResolved event
// =============================================================================

function createDisputeResolvedEvent(
  disputeId: Bytes,
  jobId: Bytes,
  clientPercent: i32,
  method: i32
): DisputeResolved {
  let event = changetype<DisputeResolved>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "disputeId",
      ethereum.Value.fromFixedBytes(disputeId)
    )
  );
  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "clientPercent",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(clientPercent))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "method",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(method))
    )
  );
  return event;
}

// =============================================================================
// Helper: create mock ArbitratorStaked event
// =============================================================================

function createArbitratorStakedEvent(
  arbitrator: Address,
  amount: BigInt
): ArbitratorStaked {
  let event = changetype<ArbitratorStaked>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "arbitrator",
      ethereum.Value.fromAddress(arbitrator)
    )
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
// Helper: create mock ArbitratorSlashed event
// =============================================================================

function createArbitratorSlashedEvent(
  arbitrator: Address,
  amount: BigInt
): ArbitratorSlashed {
  let event = changetype<ArbitratorSlashed>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "arbitrator",
      ethereum.Value.fromAddress(arbitrator)
    )
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

describe("handleDisputeInitiated", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates Dispute entity with correct fields", () => {
    // We need a Job entity in the store for the foreign key
    createJobViaHandler(JOB_ID);

    let event = createDisputeInitiatedEvent(DISPUTE_ID, JOB_ID, INITIATOR);
    handleDisputeInitiated(event);

    let id = DISPUTE_ID.toHexString();
    assert.entityCount("Dispute", 1);
    assert.fieldEquals("Dispute", id, "resolved", "false");
    assert.fieldEquals(
      "Dispute",
      id,
      "initiator",
      changetype<Bytes>(INITIATOR).toHexString()
    );
    assert.fieldEquals("Dispute", id, "jobId", JOB_ID.toHexString());
    assert.fieldEquals(
      "Dispute",
      id,
      "createdAt",
      event.block.timestamp.toString()
    );
    assert.fieldEquals(
      "Dispute",
      id,
      "createdAtBlock",
      event.block.number.toString()
    );
    assert.fieldEquals(
      "Dispute",
      id,
      "createdAtTx",
      event.transaction.hash.toHexString()
    );
  });

  test("creates DisputeInitiatedEvent entity", () => {
    createJobViaHandler(JOB_ID);

    let event = createDisputeInitiatedEvent(DISPUTE_ID, JOB_ID, INITIATOR);
    handleDisputeInitiated(event);

    assert.entityCount("DisputeInitiatedEvent", 1);
  });

  test("links dispute to job via jobId", () => {
    createJobViaHandler(JOB_ID);

    let event = createDisputeInitiatedEvent(DISPUTE_ID, JOB_ID, INITIATOR);
    handleDisputeInitiated(event);

    let id = DISPUTE_ID.toHexString();
    assert.fieldEquals("Dispute", id, "job", JOB_ID.toHexString());
  });
});

describe("handleArbitratorAssigned", () => {
  beforeEach(() => {
    clearStore();
  });

  test("updates Dispute.arbitrator field", () => {
    // Create a job and a dispute first
    createJobViaHandler(JOB_ID);
    let initEvent = createDisputeInitiatedEvent(
      DISPUTE_ID,
      JOB_ID,
      INITIATOR
    );
    handleDisputeInitiated(initEvent);

    let event = createArbitratorAssignedEvent(DISPUTE_ID, ARBITRATOR_ADDR);
    handleArbitratorAssigned(event);

    let id = DISPUTE_ID.toHexString();
    assert.fieldEquals(
      "Dispute",
      id,
      "arbitrator",
      changetype<Bytes>(ARBITRATOR_ADDR).toHexString()
    );
  });

  test("increments Arbitrator.disputesAssigned", () => {
    createJobViaHandler(JOB_ID);
    let initEvent = createDisputeInitiatedEvent(
      DISPUTE_ID,
      JOB_ID,
      INITIATOR
    );
    handleDisputeInitiated(initEvent);

    let event = createArbitratorAssignedEvent(DISPUTE_ID, ARBITRATOR_ADDR);
    handleArbitratorAssigned(event);

    let arbId = changetype<Bytes>(ARBITRATOR_ADDR).toHexString();
    assert.fieldEquals("Arbitrator", arbId, "disputesAssigned", "1");
  });
});

describe("handleDisputeResolved", () => {
  beforeEach(() => {
    clearStore();
  });

  test("sets resolved=true, method, clientPercent, resolvedAt", () => {
    createJobViaHandler(JOB_ID);
    let initEvent = createDisputeInitiatedEvent(
      DISPUTE_ID,
      JOB_ID,
      INITIATOR
    );
    handleDisputeInitiated(initEvent);

    // method=2 => ARBITRATOR, clientPercent=60
    let event = createDisputeResolvedEvent(DISPUTE_ID, JOB_ID, 60, 2);
    handleDisputeResolved(event);

    let id = DISPUTE_ID.toHexString();
    assert.fieldEquals("Dispute", id, "resolved", "true");
    assert.fieldEquals("Dispute", id, "method", "ARBITRATOR");
    assert.fieldEquals("Dispute", id, "clientPercent", "60");
    assert.fieldEquals(
      "Dispute",
      id,
      "resolvedAt",
      event.block.timestamp.toString()
    );
  });

  test("updates Job state to RESOLVED", () => {
    createJobViaHandler(JOB_ID);
    let initEvent = createDisputeInitiatedEvent(
      DISPUTE_ID,
      JOB_ID,
      INITIATOR
    );
    handleDisputeInitiated(initEvent);

    // method=1 => RE_VALIDATION
    let event = createDisputeResolvedEvent(DISPUTE_ID, JOB_ID, 50, 1);
    handleDisputeResolved(event);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "state", "RESOLVED");
  });
});

describe("handleArbitratorStaked", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates/updates Arbitrator with totalStaked", () => {
    let event = createArbitratorStakedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(1000000)
    );
    handleArbitratorStaked(event);

    let arbId = changetype<Bytes>(ARBITRATOR_ADDR).toHexString();
    assert.fieldEquals("Arbitrator", arbId, "totalStaked", "1000000");
  });

  test("sets firstStakedAt on first stake", () => {
    let event = createArbitratorStakedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(500000)
    );
    handleArbitratorStaked(event);

    let arbId = changetype<Bytes>(ARBITRATOR_ADDR).toHexString();
    assert.fieldEquals(
      "Arbitrator",
      arbId,
      "firstStakedAt",
      event.block.timestamp.toString()
    );
  });

  test("increments ProtocolStats.activeArbitrators for new arbitrator", () => {
    let event = createArbitratorStakedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(1000000)
    );
    handleArbitratorStaked(event);

    assert.fieldEquals("ProtocolStats", "protocol", "activeArbitrators", "1");
  });

  test("does not increment activeArbitrators on second stake", () => {
    let event1 = createArbitratorStakedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(500000)
    );
    handleArbitratorStaked(event1);

    let event2 = createArbitratorStakedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(500000)
    );
    handleArbitratorStaked(event2);

    assert.fieldEquals("ProtocolStats", "protocol", "activeArbitrators", "1");
    let arbId = changetype<Bytes>(ARBITRATOR_ADDR).toHexString();
    assert.fieldEquals("Arbitrator", arbId, "totalStaked", "1000000");
  });
});

describe("handleArbitratorSlashed", () => {
  beforeEach(() => {
    clearStore();
  });

  test("adds to totalSlashed and subtracts from totalStaked", () => {
    // First stake
    let stakeEvent = createArbitratorStakedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(1000000)
    );
    handleArbitratorStaked(stakeEvent);

    // Then slash
    let slashEvent = createArbitratorSlashedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(200000)
    );
    handleArbitratorSlashed(slashEvent);

    let arbId = changetype<Bytes>(ARBITRATOR_ADDR).toHexString();
    assert.fieldEquals("Arbitrator", arbId, "totalSlashed", "200000");
    assert.fieldEquals("Arbitrator", arbId, "totalStaked", "800000");
  });

  test("decrements activeArbitrators when stake reaches zero", () => {
    let stakeEvent = createArbitratorStakedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(500000)
    );
    handleArbitratorStaked(stakeEvent);

    assert.fieldEquals("ProtocolStats", "protocol", "activeArbitrators", "1");

    let slashEvent = createArbitratorSlashedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(500000)
    );
    handleArbitratorSlashed(slashEvent);

    assert.fieldEquals("ProtocolStats", "protocol", "activeArbitrators", "0");
  });
});

describe("Full dispute lifecycle", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Initiated -> ArbitratorAssigned -> Resolved chain", () => {
    // Step 1: Create the job
    createJobViaHandler(JOB_ID);

    // Step 2: Initiate dispute
    let initEvent = createDisputeInitiatedEvent(
      DISPUTE_ID,
      JOB_ID,
      INITIATOR
    );
    handleDisputeInitiated(initEvent);

    let id = DISPUTE_ID.toHexString();
    assert.fieldEquals("Dispute", id, "resolved", "false");

    // Step 3: Stake as arbitrator (so Arbitrator entity exists with stake)
    let stakeEvent = createArbitratorStakedEvent(
      ARBITRATOR_ADDR,
      BigInt.fromI32(1000000)
    );
    handleArbitratorStaked(stakeEvent);

    // Step 4: Assign arbitrator
    let assignEvent = createArbitratorAssignedEvent(
      DISPUTE_ID,
      ARBITRATOR_ADDR
    );
    handleArbitratorAssigned(assignEvent);

    assert.fieldEquals(
      "Dispute",
      id,
      "arbitrator",
      changetype<Bytes>(ARBITRATOR_ADDR).toHexString()
    );

    // Step 5: Resolve dispute (method=2 => ARBITRATOR)
    let resolveEvent = createDisputeResolvedEvent(DISPUTE_ID, JOB_ID, 75, 2);
    handleDisputeResolved(resolveEvent);

    assert.fieldEquals("Dispute", id, "resolved", "true");
    assert.fieldEquals("Dispute", id, "method", "ARBITRATOR");
    assert.fieldEquals("Dispute", id, "clientPercent", "75");

    // Job should be RESOLVED
    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "RESOLVED");

    // Arbitrator disputesResolved should be 1
    let arbId = changetype<Bytes>(ARBITRATOR_ADDR).toHexString();
    assert.fieldEquals("Arbitrator", arbId, "disputesResolved", "1");
    assert.fieldEquals("Arbitrator", arbId, "disputesAssigned", "1");
  });
});
