// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AegisTypes
/// @notice Shared type definitions for the AEGIS Protocol
/// @dev All structs, enums, and custom errors used across AEGIS contracts
library AegisTypes {
    // =========================================================================
    // Enums
    // =========================================================================

    /// @notice Job lifecycle states
    /// @dev State transitions:
    ///   CREATED → FUNDED → DELIVERED → VALIDATING → SETTLED
    ///                                      ↘ DISPUTE_WINDOW → DISPUTED → RESOLVED
    ///              ↘ EXPIRED → REFUNDED
    ///   CREATED → CANCELLED (before funding)
    enum JobState {
        CREATED, // 0: Job registered, awaiting funding
        FUNDED, // 1: USDC locked in escrow, provider can begin work
        DELIVERED, // 2: Provider submitted deliverable, validation pending
        VALIDATING, // 3: Validation request sent to ERC-8004 Validation Registry
        DISPUTE_WINDOW, // 4: Validation below threshold, dispute window open
        SETTLED, // 5: Funds released to provider, job complete
        DISPUTED, // 6: Active dispute in progress
        RESOLVED, // 7: Dispute resolved, funds distributed
        EXPIRED, // 8: Deadline passed without delivery
        REFUNDED, // 9: Funds returned to client
        CANCELLED // 10: Cancelled before funding
    }

    /// @notice Dispute resolution methods
    enum DisputeResolution {
        NONE, // 0: No dispute
        RE_VALIDATION, // 1: Tier 1 — automated re-validation
        ARBITRATOR, // 2: Tier 2 — staked arbitrator ruling
        TIMEOUT_DEFAULT, // 3: Tier 3 — timeout default split
        CLIENT_CONFIRM // 4: Client manually confirmed despite low validation
    }

    // =========================================================================
    // Structs
    // =========================================================================

    /// @notice Core job data stored on-chain
    struct Job {
        // === Identity (from ERC-8004) ===
        uint256 clientAgentId; // Client's ERC-8004 agent ID
        uint256 providerAgentId; // Provider's ERC-8004 agent ID
        address clientAddress; // Client's wallet (msg.sender at creation)
        address providerWallet; // Provider's agentWallet (from ERC-8004)
        // === Job Specification ===
        bytes32 jobSpecHash; // KECCAK-256 of job spec (IPFS CID recommended)
        string jobSpecURI; // URI to full job specification
        uint256 templateId; // Job template ID (0 = custom)
        // === Validation ===
        address validatorAddress; // ERC-8004 validator contract address
        bytes32 validationRequestHash; // Hash linking to ERC-8004 validation request
        uint8 validationScore; // Score received from validator (0-100)
        uint8 validationThreshold; // Minimum score for auto-settlement (0-100)
        // === Financial ===
        uint256 amount; // USDC amount locked in escrow (atomic units)
        uint256 protocolFeeBps; // Protocol fee in basis points at time of creation
        // === Timing ===
        uint256 createdAt; // Block timestamp of job creation
        uint256 deadline; // Deadline for deliverable submission
        uint256 deliveredAt; // Timestamp of deliverable submission
        uint256 settledAt; // Timestamp of settlement
        uint256 disputeWindowEnd; // End of dispute window after validation
        // === Deliverable ===
        bytes32 deliverableHash; // KECCAK-256 of deliverable content
        string deliverableURI; // URI to deliverable
        // === State ===
        JobState state; // Current job state
        DisputeResolution resolution; // How the job was resolved (if applicable)
    }

    /// @notice Dispute data
    struct Dispute {
        bytes32 jobId; // Job being disputed
        address initiator; // Who raised the dispute
        address respondent; // Other party
        // === Evidence ===
        string initiatorEvidenceURI; // Initiator's evidence
        bytes32 initiatorEvidenceHash;
        string respondentEvidenceURI; // Respondent's evidence
        bytes32 respondentEvidenceHash;
        bool respondentSubmitted; // Whether respondent has submitted evidence
        // === Resolution ===
        address arbitrator; // Assigned arbitrator (if Tier 2)
        uint8 ruling; // Ruling: 0-100 (% of funds to client)
        string rationaleURI; // Arbitrator's reasoning
        bytes32 rationaleHash;
        // === Timing ===
        uint256 createdAt; // When dispute was raised
        uint256 evidenceDeadline; // Evidence submission window end
        uint256 resolutionDeadline; // Must be resolved by this time
        // === Financial ===
        uint256 initiatorBond; // Bond staked by initiator
        // === State ===
        bool resolved; // Whether dispute is resolved
        DisputeResolution method; // How it was resolved
    }

    /// @notice Job template for standardized job types
    struct JobTemplate {
        string name; // Human-readable name (e.g., "code-review")
        address defaultValidator; // Default validator contract
        uint256 defaultTimeout; // Default deadline duration (seconds)
        uint256 feeBps; // Fee override (0 = use protocol default)
        uint8 minValidation; // Minimum validation score (0-100)
        uint8 defaultDisputeSplit; // Default timeout split (% to client)
        bool active; // Whether template is usable
        address creator; // Who created the template
    }

    // =========================================================================
    // Custom Errors
    // =========================================================================

    // === Identity Errors ===
    error AgentNotRegistered(uint256 agentId);
    error NotAgentOwner(uint256 agentId, address caller);
    error AgentWalletNotSet(uint256 agentId);

    // === Job Errors ===
    error InvalidJobState(bytes32 jobId, JobState current, JobState expected);
    error JobNotFound(bytes32 jobId);
    error DeadlinePassed(bytes32 jobId, uint256 deadline);
    error DeadlineNotPassed(bytes32 jobId, uint256 deadline);
    error InsufficientAmount(uint256 provided, uint256 required);
    error SameAgent(uint256 agentId);
    error InvalidDeadline(uint256 deadline);
    error InvalidThreshold(uint8 threshold);

    // === Validation Errors ===
    error InvalidValidator(address validator);
    error ValidationNotComplete(bytes32 jobId);
    error ValidationAlreadyRequested(bytes32 jobId);

    // === Dispute Errors ===
    error DisputeWindowClosed(bytes32 jobId);
    error DisputeWindowOpen(bytes32 jobId);
    error NotJobParty(bytes32 jobId, address caller);
    error DisputeAlreadyExists(bytes32 jobId);
    error DisputeNotFound(bytes32 disputeId);
    error DisputeAlreadyResolved(bytes32 disputeId);
    error EvidenceWindowClosed(bytes32 disputeId);
    error NotArbitrator(bytes32 disputeId, address caller);
    error InvalidRuling(uint8 ruling);
    error InsufficientBond(uint256 provided, uint256 required);
    error ResolutionDeadlineNotPassed(bytes32 disputeId);

    // === Treasury Errors ===
    error NotAuthorized(address caller);
    error InsufficientBalance(uint256 requested, uint256 available);

    // === Template Errors ===
    error TemplateNotFound(uint256 templateId);
    error TemplateNotActive(uint256 templateId);

    // === General ===
    error ZeroAddress();
    error TransferFailed();
}
