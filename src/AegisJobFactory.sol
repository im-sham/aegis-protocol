// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AegisTypes} from "./libraries/AegisTypes.sol";

interface IAegisEscrowForFactory {
    function createJob(
        uint256 clientAgentId,
        uint256 providerAgentId,
        bytes32 jobSpecHash,
        string calldata jobSpecURI,
        address validatorAddress,
        uint256 deadline,
        uint256 amount,
        uint8 validationThreshold
    ) external returns (bytes32 jobId);
}

/// @title AegisJobFactory
/// @author AEGIS Protocol
/// @notice Factory for creating standardized job types with pre-configured validation,
///         fee structures, and dispute parameters. Simplifies integration for common
///         AI agent task types (code-review, data-analysis, content-generation, etc.)
/// @dev Templates define defaults for validator, timeout, fees, and validation threshold.
///      Reduces gas and cognitive overhead for common job patterns.
contract AegisJobFactory is Ownable {
    // =========================================================================
    // State Variables
    // =========================================================================

    /// @notice Reference to AegisEscrow contract
    IAegisEscrowForFactory public immutable escrow;

    /// @notice All templates indexed by ID
    mapping(uint256 => AegisTypes.JobTemplate) public templates;

    /// @notice Total templates created
    uint256 public templateCount;

    /// @notice Whether anyone can create templates (false = only owner)
    bool public openTemplateCreation;

    // =========================================================================
    // Events
    // =========================================================================

    event TemplateCreated(
        uint256 indexed templateId,
        string name,
        address indexed creator,
        address defaultValidator,
        uint256 defaultTimeout,
        uint8 minValidation
    );

    event TemplateUpdated(uint256 indexed templateId);
    event TemplateDeactivated(uint256 indexed templateId);
    event JobCreatedFromTemplate(bytes32 indexed jobId, uint256 indexed templateId);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _escrow, address _owner) Ownable(_owner) {
        if (_escrow == address(0)) revert AegisTypes.ZeroAddress();
        escrow = IAegisEscrowForFactory(_escrow);
    }

    // =========================================================================
    // Template Management
    // =========================================================================

    /// @notice Create a new job template
    /// @param name Human-readable name (e.g., "code-review", "data-analysis")
    /// @param defaultValidator Default validator contract for this job type
    /// @param defaultTimeout Default deadline duration in seconds
    /// @param feeBps Fee override in basis points (0 = use protocol default)
    /// @param minValidation Minimum validation score (0-100)
    /// @param defaultDisputeSplit Default timeout dispute split (% to client)
    /// @return templateId The new template ID
    function createTemplate(
        string calldata name,
        address defaultValidator,
        uint256 defaultTimeout,
        uint256 feeBps,
        uint8 minValidation,
        uint8 defaultDisputeSplit
    ) external returns (uint256 templateId) {
        if (!openTemplateCreation && msg.sender != owner()) {
            revert AegisTypes.NotAuthorized(msg.sender);
        }
        require(defaultValidator != address(0), "Invalid validator");
        require(defaultTimeout >= 1 hours, "Timeout too short");
        require(minValidation <= 100, "Invalid threshold");
        require(defaultDisputeSplit <= 100, "Invalid split");
        require(feeBps <= 1000, "Fee too high"); // Max 10%

        templateId = templateCount++;

        templates[templateId] = AegisTypes.JobTemplate({
            name: name,
            defaultValidator: defaultValidator,
            defaultTimeout: defaultTimeout,
            feeBps: feeBps,
            minValidation: minValidation,
            defaultDisputeSplit: defaultDisputeSplit,
            active: true,
            creator: msg.sender
        });

        emit TemplateCreated(templateId, name, msg.sender, defaultValidator, defaultTimeout, minValidation);
    }

    /// @notice Create a job using a pre-configured template
    /// @dev Uses template defaults for validator, timeout, and validation threshold.
    ///      Amount and job spec must still be provided.
    /// @param templateId Template to use
    /// @param clientAgentId Client's ERC-8004 agent ID
    /// @param providerAgentId Provider's ERC-8004 agent ID
    /// @param jobSpecHash KECCAK-256 of job specification
    /// @param jobSpecURI URI to job specification
    /// @param amount USDC amount to escrow
    /// @return jobId The created job ID
    function createJobFromTemplate(
        uint256 templateId,
        uint256 clientAgentId,
        uint256 providerAgentId,
        bytes32 jobSpecHash,
        string calldata jobSpecURI,
        uint256 amount
    ) external returns (bytes32 jobId) {
        AegisTypes.JobTemplate memory tpl = templates[templateId];

        if (!tpl.active) revert AegisTypes.TemplateNotActive(templateId);
        if (bytes(tpl.name).length == 0) revert AegisTypes.TemplateNotFound(templateId);

        uint256 deadline = block.timestamp + tpl.defaultTimeout;

        // Create job via AegisEscrow using template defaults
        // Note: msg.sender must have approved USDC to AegisEscrow (not this factory)
        jobId = escrow.createJob(
            clientAgentId,
            providerAgentId,
            jobSpecHash,
            jobSpecURI,
            tpl.defaultValidator,
            deadline,
            amount,
            tpl.minValidation
        );

        emit JobCreatedFromTemplate(jobId, templateId);
    }

    /// @notice Deactivate a template
    function deactivateTemplate(uint256 templateId) external {
        AegisTypes.JobTemplate storage tpl = templates[templateId];
        if (bytes(tpl.name).length == 0) revert AegisTypes.TemplateNotFound(templateId);
        require(msg.sender == tpl.creator || msg.sender == owner(), "Not authorized");

        tpl.active = false;
        emit TemplateDeactivated(templateId);
    }

    /// @notice Update a template's validator
    function updateTemplateValidator(uint256 templateId, address newValidator) external {
        AegisTypes.JobTemplate storage tpl = templates[templateId];
        if (bytes(tpl.name).length == 0) revert AegisTypes.TemplateNotFound(templateId);
        require(msg.sender == tpl.creator || msg.sender == owner(), "Not authorized");
        require(newValidator != address(0), "Invalid validator");

        tpl.defaultValidator = newValidator;
        emit TemplateUpdated(templateId);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @notice Get a template by ID
    function getTemplate(uint256 templateId) external view returns (AegisTypes.JobTemplate memory) {
        if (bytes(templates[templateId].name).length == 0) revert AegisTypes.TemplateNotFound(templateId);
        return templates[templateId];
    }

    /// @notice Check if a template is active
    function isTemplateActive(uint256 templateId) external view returns (bool) {
        return templates[templateId].active;
    }

    // =========================================================================
    // Admin
    // =========================================================================

    function setOpenTemplateCreation(bool _open) external onlyOwner {
        openTemplateCreation = _open;
    }
}
