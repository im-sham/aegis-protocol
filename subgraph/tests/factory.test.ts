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
  TemplateCreated,
  TemplateDeactivated,
  JobCreatedFromTemplate,
} from "../generated/AegisJobFactory/AegisJobFactory";

import {
  handleTemplateCreated,
  handleTemplateDeactivated,
  handleJobCreatedFromTemplate,
} from "../src/factory";

import { handleJobCreated } from "../src/escrow";
import { JobCreated } from "../generated/AegisEscrow/AegisEscrow";

// =============================================================================
// Test constants
// =============================================================================

const CREATOR_ADDR = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const VALIDATOR_ADDR = Address.fromString(
  "0x3333333333333333333333333333333333333333"
);
const JOB_ID = Bytes.fromHexString(
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
);
const TEMPLATE_ID = BigInt.fromI32(1);

// =============================================================================
// Helper: create a Job entity via escrow handler
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
// Helper: create mock TemplateCreated event
// =============================================================================

function createTemplateCreatedEvent(
  templateId: BigInt,
  name: string,
  creator: Address,
  defaultValidator: Address,
  defaultTimeout: BigInt,
  minValidation: i32
): TemplateCreated {
  let event = changetype<TemplateCreated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "templateId",
      ethereum.Value.fromUnsignedBigInt(templateId)
    )
  );
  event.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString(name))
  );
  event.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "defaultValidator",
      ethereum.Value.fromAddress(defaultValidator)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "defaultTimeout",
      ethereum.Value.fromUnsignedBigInt(defaultTimeout)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "minValidation",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(minValidation))
    )
  );
  return event;
}

// =============================================================================
// Helper: create mock TemplateDeactivated event
// =============================================================================

function createTemplateDeactivatedEvent(
  templateId: BigInt
): TemplateDeactivated {
  let event = changetype<TemplateDeactivated>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "templateId",
      ethereum.Value.fromUnsignedBigInt(templateId)
    )
  );
  return event;
}

// =============================================================================
// Helper: create mock JobCreatedFromTemplate event
// =============================================================================

function createJobCreatedFromTemplateEvent(
  jobId: Bytes,
  templateId: BigInt
): JobCreatedFromTemplate {
  let event = changetype<JobCreatedFromTemplate>(newMockEvent());
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam("jobId", ethereum.Value.fromFixedBytes(jobId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "templateId",
      ethereum.Value.fromUnsignedBigInt(templateId)
    )
  );
  return event;
}

// =============================================================================
// Tests
// =============================================================================

describe("handleTemplateCreated", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates JobTemplate entity with all fields", () => {
    let event = createTemplateCreatedEvent(
      TEMPLATE_ID,
      "code-review",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(86400),
      70
    );
    handleTemplateCreated(event);

    let id = TEMPLATE_ID.toString();
    assert.entityCount("JobTemplate", 1);
    assert.fieldEquals("JobTemplate", id, "name", "code-review");
    assert.fieldEquals(
      "JobTemplate",
      id,
      "creator",
      changetype<Bytes>(CREATOR_ADDR).toHexString()
    );
    assert.fieldEquals(
      "JobTemplate",
      id,
      "defaultValidator",
      changetype<Bytes>(VALIDATOR_ADDR).toHexString()
    );
    assert.fieldEquals("JobTemplate", id, "defaultTimeout", "86400");
    assert.fieldEquals("JobTemplate", id, "minValidation", "70");
  });

  test("sets active=true and jobCount=0", () => {
    let event = createTemplateCreatedEvent(
      TEMPLATE_ID,
      "data-analysis",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(172800),
      80
    );
    handleTemplateCreated(event);

    let id = TEMPLATE_ID.toString();
    assert.fieldEquals("JobTemplate", id, "active", "true");
    assert.fieldEquals("JobTemplate", id, "jobCount", "0");
  });

  test("increments ProtocolStats.totalTemplates", () => {
    let event = createTemplateCreatedEvent(
      TEMPLATE_ID,
      "code-review",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(86400),
      70
    );
    handleTemplateCreated(event);

    assert.fieldEquals("ProtocolStats", "protocol", "totalTemplates", "1");
  });

  test("increments totalTemplates for each new template", () => {
    let event1 = createTemplateCreatedEvent(
      BigInt.fromI32(1),
      "code-review",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(86400),
      70
    );
    handleTemplateCreated(event1);

    let event2 = createTemplateCreatedEvent(
      BigInt.fromI32(2),
      "data-analysis",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(172800),
      80
    );
    handleTemplateCreated(event2);

    assert.fieldEquals("ProtocolStats", "protocol", "totalTemplates", "2");
    assert.entityCount("JobTemplate", 2);
  });
});

describe("handleTemplateDeactivated", () => {
  beforeEach(() => {
    clearStore();
  });

  test("sets JobTemplate.active=false", () => {
    // First create the template
    let createEvent = createTemplateCreatedEvent(
      TEMPLATE_ID,
      "code-review",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(86400),
      70
    );
    handleTemplateCreated(createEvent);

    let id = TEMPLATE_ID.toString();
    assert.fieldEquals("JobTemplate", id, "active", "true");

    // Then deactivate
    let deactivateEvent = createTemplateDeactivatedEvent(TEMPLATE_ID);
    handleTemplateDeactivated(deactivateEvent);

    assert.fieldEquals("JobTemplate", id, "active", "false");
  });
});

describe("handleJobCreatedFromTemplate", () => {
  beforeEach(() => {
    clearStore();
  });

  test("increments JobTemplate.jobCount", () => {
    // Create template first
    let createEvent = createTemplateCreatedEvent(
      TEMPLATE_ID,
      "code-review",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(86400),
      70
    );
    handleTemplateCreated(createEvent);

    // Create a job
    createJobViaHandler(JOB_ID);

    // Link job to template
    let event = createJobCreatedFromTemplateEvent(JOB_ID, TEMPLATE_ID);
    handleJobCreatedFromTemplate(event);

    let id = TEMPLATE_ID.toString();
    assert.fieldEquals("JobTemplate", id, "jobCount", "1");
  });

  test("increments jobCount multiple times", () => {
    let createEvent = createTemplateCreatedEvent(
      TEMPLATE_ID,
      "code-review",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(86400),
      70
    );
    handleTemplateCreated(createEvent);

    let jobId1 = Bytes.fromHexString(
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    );
    let jobId2 = Bytes.fromHexString(
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
    );
    createJobViaHandler(jobId1);
    createJobViaHandler(jobId2);

    let event1 = createJobCreatedFromTemplateEvent(jobId1, TEMPLATE_ID);
    handleJobCreatedFromTemplate(event1);

    let event2 = createJobCreatedFromTemplateEvent(jobId2, TEMPLATE_ID);
    handleJobCreatedFromTemplate(event2);

    let id = TEMPLATE_ID.toString();
    assert.fieldEquals("JobTemplate", id, "jobCount", "2");
  });

  test("links Job to template", () => {
    let createEvent = createTemplateCreatedEvent(
      TEMPLATE_ID,
      "code-review",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(86400),
      70
    );
    handleTemplateCreated(createEvent);

    createJobViaHandler(JOB_ID);

    let event = createJobCreatedFromTemplateEvent(JOB_ID, TEMPLATE_ID);
    handleJobCreatedFromTemplate(event);

    let jobIdHex = JOB_ID.toHexString();
    assert.fieldEquals("Job", jobIdHex, "template", TEMPLATE_ID.toString());
  });

  test("creates JobCreatedFromTemplateEvent entity", () => {
    let createEvent = createTemplateCreatedEvent(
      TEMPLATE_ID,
      "code-review",
      CREATOR_ADDR,
      VALIDATOR_ADDR,
      BigInt.fromI32(86400),
      70
    );
    handleTemplateCreated(createEvent);

    createJobViaHandler(JOB_ID);

    let event = createJobCreatedFromTemplateEvent(JOB_ID, TEMPLATE_ID);
    handleJobCreatedFromTemplate(event);

    assert.entityCount("JobCreatedFromTemplateEvent", 1);
  });
});
