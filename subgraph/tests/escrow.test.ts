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
  JobCreated,
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
  handleJobCreated,
  handleDeliverableSubmitted,
  handleValidationReceived,
  handleJobSettled,
  handleJobRefunded,
  handleJobCancelled,
  handleDisputeRaised,
  handleClientConfirmed,
  handleDisputeWindowStarted,
  handleFeedbackSubmitted,
  handleProtocolFeeUpdated,
  handleDisputeWindowUpdated,
  handleTreasuryUpdated,
  handleDisputeContractUpdated,
  handleAuthorizedCallerUpdated,
} from "../src/escrow";

// =============================================================================
// Test Constants
// =============================================================================

const JOB_ID = Bytes.fromHexString(
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
);
const JOB_ID_2 = Bytes.fromHexString(
  "0x1111111111111111111111111111111111111111111111111111111111111111"
);
const CLIENT_AGENT_ID = BigInt.fromI32(1);
const PROVIDER_AGENT_ID = BigInt.fromI32(2);
const AMOUNT = BigInt.fromI32(1000000); // 1 USDC
const VALIDATOR_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000001"
);
const DEADLINE = BigInt.fromI32(1700000000);
const PROVIDER_WALLET = Address.fromString(
  "0x0000000000000000000000000000000000000002"
);
const CLIENT_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000003"
);
const INITIATOR_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000004"
);
const BLOCK_TIMESTAMP = BigInt.fromI32(1699999000);

// =============================================================================
// Event Factory Helpers
// =============================================================================

function createJobCreatedEvent(
  jobId: Bytes,
  clientAgentId: BigInt,
  providerAgentId: BigInt,
  amount: BigInt,
  validatorAddress: Address,
  deadline: BigInt
): JobCreated {
  let event = changetype<JobCreated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "clientAgentId",
      ethereum.Value.fromUnsignedBigInt(clientAgentId)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "providerAgentId",
      ethereum.Value.fromUnsignedBigInt(providerAgentId)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "validatorAddress",
      ethereum.Value.fromAddress(validatorAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "deadline",
      ethereum.Value.fromUnsignedBigInt(deadline)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP;

  return event;
}

function createDeliverableSubmittedEvent(
  jobId: Bytes,
  deliverableURI: string,
  deliverableHash: Bytes,
  validationRequestHash: Bytes
): DeliverableSubmitted {
  let event = changetype<DeliverableSubmitted>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "deliverableURI",
      ethereum.Value.fromString(deliverableURI)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "deliverableHash",
      ethereum.Value.fromFixedBytes(deliverableHash)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "validationRequestHash",
      ethereum.Value.fromFixedBytes(validationRequestHash)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(3600));

  return event;
}

function createValidationReceivedEvent(
  jobId: Bytes,
  score: i32,
  passedThreshold: boolean
): ValidationReceived {
  let event = changetype<ValidationReceived>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "score",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(score))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "passedThreshold",
      ethereum.Value.fromBoolean(passedThreshold)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(7200));

  return event;
}

function createJobSettledEvent(
  jobId: Bytes,
  providerWallet: Address,
  providerAmount: BigInt,
  protocolFee: BigInt
): JobSettled {
  let event = changetype<JobSettled>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "providerWallet",
      ethereum.Value.fromAddress(providerWallet)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "providerAmount",
      ethereum.Value.fromUnsignedBigInt(providerAmount)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "protocolFee",
      ethereum.Value.fromUnsignedBigInt(protocolFee)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(10800));

  return event;
}

function createJobRefundedEvent(
  jobId: Bytes,
  clientAddress: Address,
  amount: BigInt
): JobRefunded {
  let event = changetype<JobRefunded>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "clientAddress",
      ethereum.Value.fromAddress(clientAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(10800));

  return event;
}

function createJobCancelledEvent(jobId: Bytes): JobCancelled {
  let event = changetype<JobCancelled>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(3600));

  return event;
}

function createDisputeRaisedEvent(
  jobId: Bytes,
  initiator: Address
): DisputeRaised {
  let event = changetype<DisputeRaised>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "initiator",
      ethereum.Value.fromAddress(initiator)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(14400));

  return event;
}

function createClientConfirmedEvent(jobId: Bytes): ClientConfirmed {
  let event = changetype<ClientConfirmed>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(7200));

  return event;
}

function createDisputeWindowStartedEvent(
  jobId: Bytes,
  windowEnd: BigInt
): DisputeWindowStarted {
  let event = changetype<DisputeWindowStarted>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "windowEnd",
      ethereum.Value.fromUnsignedBigInt(windowEnd)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(10800));

  return event;
}

function createFeedbackSubmittedEvent(
  jobId: Bytes,
  agentId: BigInt,
  value: BigInt
): FeedbackSubmitted {
  let event = changetype<FeedbackSubmitted>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "value",
      ethereum.Value.fromUnsignedBigInt(value)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(14400));

  return event;
}

function createProtocolFeeUpdatedEvent(
  oldFee: BigInt,
  newFee: BigInt
): ProtocolFeeUpdated {
  let event = changetype<ProtocolFeeUpdated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam(
      "oldFee",
      ethereum.Value.fromUnsignedBigInt(oldFee)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "newFee",
      ethereum.Value.fromUnsignedBigInt(newFee)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP;

  return event;
}

function createDisputeWindowUpdatedEvent(
  oldWindow: BigInt,
  newWindow: BigInt
): DisputeWindowUpdated {
  let event = changetype<DisputeWindowUpdated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam(
      "oldWindow",
      ethereum.Value.fromUnsignedBigInt(oldWindow)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "newWindow",
      ethereum.Value.fromUnsignedBigInt(newWindow)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP;

  return event;
}

function createTreasuryUpdatedEvent(
  oldTreasury: Address,
  newTreasury: Address
): TreasuryUpdated {
  let event = changetype<TreasuryUpdated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam(
      "oldTreasury",
      ethereum.Value.fromAddress(oldTreasury)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "newTreasury",
      ethereum.Value.fromAddress(newTreasury)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP;

  return event;
}

function createDisputeContractUpdatedEvent(
  oldDispute: Address,
  newDispute: Address
): DisputeContractUpdated {
  let event = changetype<DisputeContractUpdated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam(
      "oldDispute",
      ethereum.Value.fromAddress(oldDispute)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "newDispute",
      ethereum.Value.fromAddress(newDispute)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP;

  return event;
}

function createAuthorizedCallerUpdatedEvent(
  caller: Address,
  authorized: boolean
): AuthorizedCallerUpdated {
  let event = changetype<AuthorizedCallerUpdated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();

  event.parameters.push(
    new ethereum.EventParam(
      "caller",
      ethereum.Value.fromAddress(caller)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "authorized",
      ethereum.Value.fromBoolean(authorized)
    )
  );

  event.block.timestamp = BLOCK_TIMESTAMP;

  return event;
}

// =============================================================================
// Shared helper: fire a JobCreated to seed the store
// =============================================================================

function seedJob(jobId: Bytes = JOB_ID): void {
  let event = createJobCreatedEvent(
    jobId,
    CLIENT_AGENT_ID,
    PROVIDER_AGENT_ID,
    AMOUNT,
    VALIDATOR_ADDRESS,
    DEADLINE
  );
  handleJobCreated(event);
}

// =============================================================================
// Tests
// =============================================================================

describe("handleJobCreated", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Creates Job entity with correct fields", () => {
    let event = createJobCreatedEvent(
      JOB_ID,
      CLIENT_AGENT_ID,
      PROVIDER_AGENT_ID,
      AMOUNT,
      VALIDATOR_ADDRESS,
      DEADLINE
    );

    handleJobCreated(event);

    let jobIdHex = JOB_ID.toHexString();

    assert.fieldEquals("Job", jobIdHex, "state", "FUNDED");
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "amount",
      AMOUNT.toString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "clientAgentId",
      CLIENT_AGENT_ID.toString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "providerAgentId",
      PROVIDER_AGENT_ID.toString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "deadline",
      DEADLINE.toString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "validatorAddress",
      VALIDATOR_ADDRESS.toHexString()
    );
    assert.fieldEquals("Job", jobIdHex, "resolution", "NONE");
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "createdAt",
      BLOCK_TIMESTAMP.toString()
    );
    assert.fieldEquals("Job", jobIdHex, "validationScore", "0");
    assert.fieldEquals("Job", jobIdHex, "passedThreshold", "false");

    assert.entityCount("Job", 1);
  });

  test("Creates JobCreatedEvent entity with correct fields", () => {
    let event = createJobCreatedEvent(
      JOB_ID,
      CLIENT_AGENT_ID,
      PROVIDER_AGENT_ID,
      AMOUNT,
      VALIDATOR_ADDRESS,
      DEADLINE
    );

    handleJobCreated(event);

    assert.entityCount("JobCreatedEvent", 1);
  });

  test("Increments ProtocolStats totalJobs and totalVolumeUSDC", () => {
    let event = createJobCreatedEvent(
      JOB_ID,
      CLIENT_AGENT_ID,
      PROVIDER_AGENT_ID,
      AMOUNT,
      VALIDATOR_ADDRESS,
      DEADLINE
    );

    handleJobCreated(event);

    assert.fieldEquals("ProtocolStats", "protocol", "totalJobs", "1");
    assert.fieldEquals(
      "ProtocolStats",
      "protocol",
      "totalVolumeUSDC",
      AMOUNT.toString()
    );
  });

  test("Accumulates stats across multiple jobs", () => {
    let event1 = createJobCreatedEvent(
      JOB_ID,
      CLIENT_AGENT_ID,
      PROVIDER_AGENT_ID,
      AMOUNT,
      VALIDATOR_ADDRESS,
      DEADLINE
    );
    handleJobCreated(event1);

    let event2 = createJobCreatedEvent(
      JOB_ID_2,
      CLIENT_AGENT_ID,
      PROVIDER_AGENT_ID,
      BigInt.fromI32(2000000),
      VALIDATOR_ADDRESS,
      DEADLINE
    );
    handleJobCreated(event2);

    assert.fieldEquals("ProtocolStats", "protocol", "totalJobs", "2");
    assert.fieldEquals(
      "ProtocolStats",
      "protocol",
      "totalVolumeUSDC",
      "3000000" // 1_000_000 + 2_000_000
    );
    assert.entityCount("Job", 2);
  });

  test("Creates DailyStats for the job creation day", () => {
    let event = createJobCreatedEvent(
      JOB_ID,
      CLIENT_AGENT_ID,
      PROVIDER_AGENT_ID,
      AMOUNT,
      VALIDATOR_ADDRESS,
      DEADLINE
    );
    handleJobCreated(event);

    let dayId = (BLOCK_TIMESTAMP.toI32() / 86400).toString();
    assert.fieldEquals("DailyStats", dayId, "jobsCreated", "1");
    assert.fieldEquals(
      "DailyStats",
      dayId,
      "volumeUSDC",
      AMOUNT.toString()
    );
  });
});

describe("handleDeliverableSubmitted", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Updates Job to DELIVERED with deliverable fields", () => {
    seedJob();

    let deliverableHash = Bytes.fromHexString(
      "0xdeadbeef00000000000000000000000000000000000000000000000000000000"
    );
    let validationRequestHash = Bytes.fromHexString(
      "0xfeedface00000000000000000000000000000000000000000000000000000000"
    );
    let deliverableURI = "ipfs://QmTestDeliverable";

    let event = createDeliverableSubmittedEvent(
      JOB_ID,
      deliverableURI,
      deliverableHash,
      validationRequestHash
    );
    handleDeliverableSubmitted(event);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "state", "DELIVERED");
    assert.fieldEquals("Job", jobIdHex, "deliverableURI", deliverableURI);
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "deliverableHash",
      deliverableHash.toHexString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "validationRequestHash",
      validationRequestHash.toHexString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "deliveredAt",
      BLOCK_TIMESTAMP.plus(BigInt.fromI32(3600)).toString()
    );
  });

  test("Creates DeliverableSubmittedEvent entity", () => {
    seedJob();

    let deliverableHash = Bytes.fromHexString(
      "0xdeadbeef00000000000000000000000000000000000000000000000000000000"
    );
    let validationRequestHash = Bytes.fromHexString(
      "0xfeedface00000000000000000000000000000000000000000000000000000000"
    );

    let event = createDeliverableSubmittedEvent(
      JOB_ID,
      "ipfs://QmTest",
      deliverableHash,
      validationRequestHash
    );
    handleDeliverableSubmitted(event);

    assert.entityCount("DeliverableSubmittedEvent", 1);
  });
});

describe("handleValidationReceived", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Updates Job validation score and passedThreshold (passed)", () => {
    seedJob();

    let event = createValidationReceivedEvent(JOB_ID, 85, true);
    handleValidationReceived(event);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "validationScore", "85");
    assert.fieldEquals("Job", jobIdHex, "passedThreshold", "true");
    assert.fieldEquals("Job", jobIdHex, "state", "VALIDATING");
  });

  test("Updates Job validation score when threshold not met", () => {
    seedJob();

    let event = createValidationReceivedEvent(JOB_ID, 40, false);
    handleValidationReceived(event);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "validationScore", "40");
    assert.fieldEquals("Job", jobIdHex, "passedThreshold", "false");
    // State should remain FUNDED (not changed to VALIDATING when threshold fails)
    assert.fieldEquals("Job", jobIdHex, "state", "FUNDED");
  });

  test("Creates ValidationReceivedEvent entity", () => {
    seedJob();

    let event = createValidationReceivedEvent(JOB_ID, 85, true);
    handleValidationReceived(event);

    assert.entityCount("ValidationReceivedEvent", 1);
  });
});

describe("handleJobSettled", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Updates Job to SETTLED with payment fields", () => {
    seedJob();

    let providerAmount = BigInt.fromI32(975000); // 97.5% of 1 USDC
    let protocolFee = BigInt.fromI32(25000); // 2.5% fee

    let event = createJobSettledEvent(
      JOB_ID,
      PROVIDER_WALLET,
      providerAmount,
      protocolFee
    );
    handleJobSettled(event);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "state", "SETTLED");
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "providerWallet",
      PROVIDER_WALLET.toHexString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "providerAmount",
      providerAmount.toString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "protocolFee",
      protocolFee.toString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "settledAt",
      BLOCK_TIMESTAMP.plus(BigInt.fromI32(10800)).toString()
    );
  });

  test("Increments ProtocolStats totalSettled and totalFeesCollected", () => {
    seedJob();

    let providerAmount = BigInt.fromI32(975000);
    let protocolFee = BigInt.fromI32(25000);

    let event = createJobSettledEvent(
      JOB_ID,
      PROVIDER_WALLET,
      providerAmount,
      protocolFee
    );
    handleJobSettled(event);

    assert.fieldEquals("ProtocolStats", "protocol", "totalSettled", "1");
    assert.fieldEquals(
      "ProtocolStats",
      "protocol",
      "totalFeesCollected",
      protocolFee.toString()
    );
  });

  test("Creates JobSettledEvent entity", () => {
    seedJob();

    let event = createJobSettledEvent(
      JOB_ID,
      PROVIDER_WALLET,
      BigInt.fromI32(975000),
      BigInt.fromI32(25000)
    );
    handleJobSettled(event);

    assert.entityCount("JobSettledEvent", 1);
  });

  test("Updates DailyStats for settlement", () => {
    seedJob();

    let protocolFee = BigInt.fromI32(25000);
    let event = createJobSettledEvent(
      JOB_ID,
      PROVIDER_WALLET,
      BigInt.fromI32(975000),
      protocolFee
    );
    handleJobSettled(event);

    // Settlement timestamp is BLOCK_TIMESTAMP + 10800
    let settleTimestamp = BLOCK_TIMESTAMP.plus(BigInt.fromI32(10800));
    let dayId = (settleTimestamp.toI32() / 86400).toString();
    assert.fieldEquals("DailyStats", dayId, "jobsSettled", "1");
    assert.fieldEquals(
      "DailyStats",
      dayId,
      "feesCollected",
      protocolFee.toString()
    );
  });
});

describe("handleJobRefunded", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Updates Job to REFUNDED with refundAmount", () => {
    seedJob();

    let event = createJobRefundedEvent(JOB_ID, CLIENT_ADDRESS, AMOUNT);
    handleJobRefunded(event);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "state", "REFUNDED");
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "refundAmount",
      AMOUNT.toString()
    );
  });

  test("Creates JobRefundedEvent entity", () => {
    seedJob();

    let event = createJobRefundedEvent(JOB_ID, CLIENT_ADDRESS, AMOUNT);
    handleJobRefunded(event);

    assert.entityCount("JobRefundedEvent", 1);
  });

  test("Increments ProtocolStats totalRefunded", () => {
    seedJob();

    let event = createJobRefundedEvent(JOB_ID, CLIENT_ADDRESS, AMOUNT);
    handleJobRefunded(event);

    assert.fieldEquals("ProtocolStats", "protocol", "totalRefunded", "1");
  });
});

describe("handleJobCancelled", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Updates Job to CANCELLED", () => {
    seedJob();

    let event = createJobCancelledEvent(JOB_ID);
    handleJobCancelled(event);

    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "CANCELLED");
  });

  test("Creates JobCancelledEvent entity", () => {
    seedJob();

    let event = createJobCancelledEvent(JOB_ID);
    handleJobCancelled(event);

    assert.entityCount("JobCancelledEvent", 1);
  });
});

describe("handleDisputeRaised", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Updates Job to DISPUTED", () => {
    seedJob();

    let event = createDisputeRaisedEvent(JOB_ID, INITIATOR_ADDRESS);
    handleDisputeRaised(event);

    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "DISPUTED");
  });

  test("Creates DisputeRaisedEvent entity with initiator", () => {
    seedJob();

    let event = createDisputeRaisedEvent(JOB_ID, INITIATOR_ADDRESS);
    handleDisputeRaised(event);

    assert.entityCount("DisputeRaisedEvent", 1);
  });

  test("Increments ProtocolStats totalDisputed", () => {
    seedJob();

    let event = createDisputeRaisedEvent(JOB_ID, INITIATOR_ADDRESS);
    handleDisputeRaised(event);

    assert.fieldEquals("ProtocolStats", "protocol", "totalDisputed", "1");
  });
});

describe("handleClientConfirmed", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Updates Job resolution to CLIENT_CONFIRM", () => {
    seedJob();

    let event = createClientConfirmedEvent(JOB_ID);
    handleClientConfirmed(event);

    assert.fieldEquals(
      "Job",
      JOB_ID.toHexString(),
      "resolution",
      "CLIENT_CONFIRM"
    );
  });

  test("Creates ClientConfirmedEvent entity", () => {
    seedJob();

    let event = createClientConfirmedEvent(JOB_ID);
    handleClientConfirmed(event);

    assert.entityCount("ClientConfirmedEvent", 1);
  });
});

describe("handleDisputeWindowStarted", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Updates Job to DISPUTE_WINDOW with windowEnd", () => {
    seedJob();

    let windowEnd = BigInt.fromI32(1700086400); // +24h
    let event = createDisputeWindowStartedEvent(JOB_ID, windowEnd);
    handleDisputeWindowStarted(event);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "state", "DISPUTE_WINDOW");
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "disputeWindowEnd",
      windowEnd.toString()
    );
  });

  test("Creates DisputeWindowStartedEvent entity", () => {
    seedJob();

    let windowEnd = BigInt.fromI32(1700086400);
    let event = createDisputeWindowStartedEvent(JOB_ID, windowEnd);
    handleDisputeWindowStarted(event);

    assert.entityCount("DisputeWindowStartedEvent", 1);
  });
});

describe("handleFeedbackSubmitted", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Creates FeedbackSubmittedEvent without changing Job state", () => {
    seedJob();

    let agentId = BigInt.fromI32(1);
    let value = BigInt.fromI32(5);
    let event = createFeedbackSubmittedEvent(JOB_ID, agentId, value);
    handleFeedbackSubmitted(event);

    // State should remain unchanged (FUNDED from seedJob)
    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "FUNDED");
    assert.entityCount("FeedbackSubmittedEvent", 1);
  });
});

describe("Full lifecycle", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Created -> Delivered -> Settled", () => {
    // Step 1: Create job
    let createEvent = createJobCreatedEvent(
      JOB_ID,
      CLIENT_AGENT_ID,
      PROVIDER_AGENT_ID,
      AMOUNT,
      VALIDATOR_ADDRESS,
      DEADLINE
    );
    handleJobCreated(createEvent);
    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "FUNDED");

    // Step 2: Submit deliverable
    let deliverableHash = Bytes.fromHexString(
      "0xdeadbeef00000000000000000000000000000000000000000000000000000000"
    );
    let validationRequestHash = Bytes.fromHexString(
      "0xfeedface00000000000000000000000000000000000000000000000000000000"
    );
    let deliverEvent = createDeliverableSubmittedEvent(
      JOB_ID,
      "ipfs://QmDeliverable",
      deliverableHash,
      validationRequestHash
    );
    handleDeliverableSubmitted(deliverEvent);
    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "DELIVERED");

    // Step 3: Settle job
    let providerAmount = BigInt.fromI32(975000);
    let protocolFee = BigInt.fromI32(25000);
    let settleEvent = createJobSettledEvent(
      JOB_ID,
      PROVIDER_WALLET,
      providerAmount,
      protocolFee
    );
    handleJobSettled(settleEvent);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "state", "SETTLED");
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "providerAmount",
      providerAmount.toString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "protocolFee",
      protocolFee.toString()
    );
    assert.fieldEquals(
      "Job",
      jobIdHex,
      "deliverableURI",
      "ipfs://QmDeliverable"
    );

    // Stats verification
    assert.fieldEquals("ProtocolStats", "protocol", "totalJobs", "1");
    assert.fieldEquals("ProtocolStats", "protocol", "totalSettled", "1");
    assert.fieldEquals(
      "ProtocolStats",
      "protocol",
      "totalFeesCollected",
      protocolFee.toString()
    );
  });

  test("Created -> Disputed lifecycle", () => {
    seedJob();
    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "FUNDED");

    // Submit deliverable
    let deliverableHash = Bytes.fromHexString(
      "0xdeadbeef00000000000000000000000000000000000000000000000000000000"
    );
    let validationRequestHash = Bytes.fromHexString(
      "0xfeedface00000000000000000000000000000000000000000000000000000000"
    );
    let deliverEvent = createDeliverableSubmittedEvent(
      JOB_ID,
      "ipfs://QmDeliverable",
      deliverableHash,
      validationRequestHash
    );
    handleDeliverableSubmitted(deliverEvent);
    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "DELIVERED");

    // Start dispute window
    let windowEnd = BigInt.fromI32(1700086400);
    let windowEvent = createDisputeWindowStartedEvent(JOB_ID, windowEnd);
    handleDisputeWindowStarted(windowEvent);
    assert.fieldEquals(
      "Job",
      JOB_ID.toHexString(),
      "state",
      "DISPUTE_WINDOW"
    );

    // Raise dispute
    let disputeEvent = createDisputeRaisedEvent(JOB_ID, INITIATOR_ADDRESS);
    handleDisputeRaised(disputeEvent);
    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "DISPUTED");

    assert.fieldEquals("ProtocolStats", "protocol", "totalDisputed", "1");
  });

  test("Created -> Refunded lifecycle", () => {
    seedJob();

    let refundEvent = createJobRefundedEvent(JOB_ID, CLIENT_ADDRESS, AMOUNT);
    handleJobRefunded(refundEvent);

    assert.fieldEquals("Job", JOB_ID.toHexString(), "state", "REFUNDED");
    assert.fieldEquals(
      "Job",
      JOB_ID.toHexString(),
      "refundAmount",
      AMOUNT.toString()
    );
    assert.fieldEquals("ProtocolStats", "protocol", "totalRefunded", "1");
  });
});

describe("Admin events", () => {
  beforeEach(() => {
    clearStore();
  });

  test("Creates ProtocolFeeUpdatedEvent with oldFee and newFee", () => {
    let oldFee = BigInt.fromI32(250);
    let newFee = BigInt.fromI32(300);

    let event = createProtocolFeeUpdatedEvent(oldFee, newFee);
    handleProtocolFeeUpdated(event);

    assert.entityCount("ProtocolFeeUpdatedEvent", 1);
  });

  test("Creates DisputeWindowUpdatedEvent with oldWindow and newWindow", () => {
    let oldWindow = BigInt.fromI32(86400);
    let newWindow = BigInt.fromI32(172800);

    let event = createDisputeWindowUpdatedEvent(oldWindow, newWindow);
    handleDisputeWindowUpdated(event);

    assert.entityCount("DisputeWindowUpdatedEvent", 1);
  });

  test("Creates TreasuryUpdatedEvent with old and new addresses", () => {
    let oldTreasury = Address.fromString(
      "0x0000000000000000000000000000000000000010"
    );
    let newTreasury = Address.fromString(
      "0x0000000000000000000000000000000000000020"
    );

    let event = createTreasuryUpdatedEvent(oldTreasury, newTreasury);
    handleTreasuryUpdated(event);

    assert.entityCount("TreasuryUpdatedEvent", 1);
  });

  test("Creates DisputeContractUpdatedEvent", () => {
    let oldDispute = Address.fromString(
      "0x0000000000000000000000000000000000000030"
    );
    let newDispute = Address.fromString(
      "0x0000000000000000000000000000000000000040"
    );

    let event = createDisputeContractUpdatedEvent(oldDispute, newDispute);
    handleDisputeContractUpdated(event);

    assert.entityCount("DisputeContractUpdatedEvent", 1);
  });

  test("Creates AuthorizedCallerUpdatedEvent", () => {
    let caller = Address.fromString(
      "0x0000000000000000000000000000000000000050"
    );

    let event = createAuthorizedCallerUpdatedEvent(caller, true);
    handleAuthorizedCallerUpdated(event);

    assert.entityCount("AuthorizedCallerUpdatedEvent", 1);
  });
});
