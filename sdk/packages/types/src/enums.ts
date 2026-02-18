/**
 * Job lifecycle states matching the Solidity JobState enum in AegisTypes.sol.
 *
 * State machine:
 *   CREATED -> FUNDED -> DELIVERED -> VALIDATING -> SETTLED
 *                                         \-> DISPUTE_WINDOW -> DISPUTED -> RESOLVED
 *              \-> EXPIRED -> REFUNDED
 *   CREATED -> CANCELLED (before funding)
 */
export enum JobState {
  CREATED = 0,
  FUNDED = 1,
  DELIVERED = 2,
  VALIDATING = 3,
  DISPUTE_WINDOW = 4,
  SETTLED = 5,
  DISPUTED = 6,
  RESOLVED = 7,
  EXPIRED = 8,
  REFUNDED = 9,
  CANCELLED = 10,
}

/**
 * Dispute resolution methods matching the Solidity DisputeResolution enum in AegisTypes.sol.
 *
 * Three-tier dispute resolution:
 *   1. RE_VALIDATION — automated re-validation of the deliverable
 *   2. ARBITRATOR — staked arbitrator makes a ruling
 *   3. TIMEOUT_DEFAULT — resolution deadline passes without arbitrator ruling
 *   4. CLIENT_CONFIRM — client confirms acceptance during dispute window
 */
export enum DisputeResolution {
  NONE = 0,
  RE_VALIDATION = 1,
  ARBITRATOR = 2,
  TIMEOUT_DEFAULT = 3,
  CLIENT_CONFIRM = 4,
}
