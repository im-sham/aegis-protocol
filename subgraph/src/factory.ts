import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  TemplateCreated,
  TemplateUpdated,
  TemplateDeactivated,
  JobCreatedFromTemplate
} from "../generated/AegisJobFactory/AegisJobFactory";
import {
  Job,
  JobTemplate,
  TemplateCreatedEvent,
  TemplateUpdatedEvent,
  TemplateDeactivatedEvent,
  JobCreatedFromTemplateEvent
} from "../generated/schema";
import { generateEventId, getOrCreateProtocolStats } from "./helpers";

// === handleTemplateCreated ===
// Creates a new JobTemplate entity with all fields from the event.
// Creates TemplateCreatedEvent. Increments ProtocolStats.totalTemplates.

export function handleTemplateCreated(event: TemplateCreated): void {
  let templateIdStr = event.params.templateId.toString();

  // Create the JobTemplate mutable entity
  let template = new JobTemplate(templateIdStr);
  template.templateId = event.params.templateId;
  template.name = event.params.name;
  template.creator = changetype<Bytes>(event.params.creator);
  template.defaultValidator = changetype<Bytes>(event.params.defaultValidator);
  template.defaultTimeout = event.params.defaultTimeout;
  template.minValidation = event.params.minValidation;
  template.active = true;
  template.jobCount = BigInt.zero();
  template.createdAt = event.block.timestamp;
  template.createdAtBlock = event.block.number;
  template.save();

  // Create the immutable event entity
  let id = generateEventId(event);
  let entity = new TemplateCreatedEvent(id);
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.templateId = event.params.templateId;
  entity.name = event.params.name;
  entity.creator = changetype<Bytes>(event.params.creator);
  entity.defaultValidator = changetype<Bytes>(event.params.defaultValidator);
  entity.defaultTimeout = event.params.defaultTimeout;
  entity.minValidation = event.params.minValidation;
  entity.template = templateIdStr;
  entity.save();

  // Update aggregate: ProtocolStats
  let stats = getOrCreateProtocolStats();
  stats.totalTemplates = stats.totalTemplates.plus(BigInt.fromI32(1));
  stats.save();
}

// === handleTemplateUpdated ===
// Loads JobTemplate (no fields to update from this event).
// Creates TemplateUpdatedEvent.

export function handleTemplateUpdated(event: TemplateUpdated): void {
  let templateIdStr = event.params.templateId.toString();

  // Create the immutable event entity
  let id = generateEventId(event);
  let entity = new TemplateUpdatedEvent(id);
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.templateId = event.params.templateId;
  entity.template = templateIdStr;
  entity.save();
}

// === handleTemplateDeactivated ===
// Loads JobTemplate, sets active=false, saves.
// Creates TemplateDeactivatedEvent.

export function handleTemplateDeactivated(event: TemplateDeactivated): void {
  let templateIdStr = event.params.templateId.toString();

  // Update the JobTemplate entity
  let template = JobTemplate.load(templateIdStr);
  if (template != null) {
    template.active = false;
    template.save();
  }

  // Create the immutable event entity
  let id = generateEventId(event);
  let entity = new TemplateDeactivatedEvent(id);
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.templateId = event.params.templateId;
  entity.template = templateIdStr;
  entity.save();
}

// === handleJobCreatedFromTemplate ===
// Loads JobTemplate, increments jobCount by 1, saves.
// Loads Job by jobId — if exists, sets template reference, saves.
// Creates JobCreatedFromTemplateEvent linked to both job and template.

export function handleJobCreatedFromTemplate(
  event: JobCreatedFromTemplate
): void {
  let templateIdStr = event.params.templateId.toString();
  let jobId = event.params.jobId;

  // Update the JobTemplate entity — increment jobCount
  let template = JobTemplate.load(templateIdStr);
  if (template != null) {
    template.jobCount = template.jobCount.plus(BigInt.fromI32(1));
    template.save();
  }

  // Link the Job to this template if the Job entity exists
  let job = Job.load(jobId);
  if (job != null) {
    job.template = templateIdStr;
    job.save();
  }

  // Create the immutable event entity
  let id = generateEventId(event);
  let entity = new JobCreatedFromTemplateEvent(id);
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.jobId = jobId;
  entity.templateId = event.params.templateId;
  entity.job = jobId;
  entity.template = templateIdStr;
  entity.save();
}
