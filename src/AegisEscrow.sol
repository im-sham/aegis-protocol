// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IERC8004Identity} from "./interfaces/IERC8004Identity.sol";
import {IERC8004Reputation} from "./interfaces/IERC8004Reputation.sol";
import {IERC8004Validation} from "./interfaces/IERC8004Validation.sol";
import {AegisTypes} from "./libraries/AegisTypes.sol";

interface IAegisDispute {
    function initiateDispute(
        bytes32 jobId,
        address initiator,
        string calldata evidenceURI,
        bytes32 evidenceHash
    )
        external;
}

/// @title AegisEscrow
/// @author AEGIS Protocol
/// @notice Trustless escrow for AI agent-to-agent transactions, composing ERC-8004 identity/
///         reputation/validation with USDC payments. The missing middleware between agent
///         discovery and agent commerce.
/// @dev Core flow: createJob → fund → submitDeliverable → validate (ERC-8004) → settle
///      Integrates with ERC-8004 Identity Registry for agent verification,
///      Validation Registry for work verification, and Reputation Registry for feedback.
contract AegisEscrow is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State Variables
    // =========================================================================

    /// @notice ERC-8004 Identity Registry (singleton per chain)
    IERC8004Identity public immutable identityRegistry;

    /// @notice ERC-8004 Reputation Registry
    IERC8004Reputation public immutable reputationRegistry;

    /// @notice ERC-8004 Validation Registry
    IERC8004Validation public immutable validationRegistry;

    /// @notice USDC token contract (ERC-20)
    IERC20 public immutable usdc;

    /// @notice Treasury contract for fee collection
    address public treasury;

    /// @notice Dispute resolution contract
    address public disputeContract;

    /// @notice Protocol fee in basis points (e.g., 250 = 2.5%)
    uint256 public protocolFeeBps;

    /// @notice Dispute window duration after validation (seconds)
    uint256 public disputeWindowSeconds;

    /// @notice Default validation threshold (0-100)
    uint8 public defaultValidationThreshold;

    /// @notice Minimum escrow amount (prevents dust attacks)
    uint256 public minEscrowAmount;

    /// @notice Maximum deadline duration (prevents indefinite locks)
    uint256 public maxDeadlineDuration;

    /// @notice Default dispute split (% to client on timeout, 0-100)
    uint8 public defaultDisputeSplit;

    /// @notice All jobs indexed by jobId
    mapping(bytes32 => AegisTypes.Job) public jobs;

    /// @notice Maps validation request hash → jobId (for callback routing)
    mapping(bytes32 => bytes32) public validationToJob;

    /// @notice Tracks jobs per agent (for enumeration)
    mapping(uint256 => bytes32[]) public agentJobs;

    /// @notice Total jobs created (for statistics)
    uint256 public totalJobsCreated;

    /// @notice Total USDC volume settled through the protocol
    uint256 public totalVolumeSettled;

    /// @notice Authorized callers that can create jobs on behalf of agents (e.g., AegisJobFactory)
    mapping(address => bool) public authorizedCallers;

    // =========================================================================
    // Events
    // =========================================================================

    event JobCreated(
        bytes32 indexed jobId,
        uint256 indexed clientAgentId,
        uint256 indexed providerAgentId,
        uint256 amount,
        address validatorAddress,
        uint256 deadline
    );

    event JobFunded(bytes32 indexed jobId, uint256 amount);

    event DeliverableSubmitted(
        bytes32 indexed jobId, string deliverableURI, bytes32 deliverableHash, bytes32 validationRequestHash
    );

    event ValidationReceived(bytes32 indexed jobId, uint8 score, bool passedThreshold);

    event JobSettled(
        bytes32 indexed jobId, address indexed providerWallet, uint256 providerAmount, uint256 protocolFee
    );

    event JobRefunded(bytes32 indexed jobId, address indexed clientAddress, uint256 amount);

    event JobCancelled(bytes32 indexed jobId);

    event DisputeRaised(bytes32 indexed jobId, address indexed initiator);

    event ClientConfirmed(bytes32 indexed jobId);

    event DisputeWindowStarted(bytes32 indexed jobId, uint256 windowEnd);

    event FeedbackSubmitted(bytes32 indexed jobId, uint256 indexed agentId, int128 value);

    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);

    event DisputeWindowUpdated(uint256 oldWindow, uint256 newWindow);

    event TreasuryUpdated(address oldTreasury, address newTreasury);

    event DisputeContractUpdated(address oldDispute, address newDispute);

    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    // =========================================================================
    // Modifiers
    // =========================================================================

    /// @dev Ensures job exists and is in expected state
    modifier inState(bytes32 jobId, AegisTypes.JobState expected) {
        AegisTypes.Job storage job = jobs[jobId];
        if (job.createdAt == 0) revert AegisTypes.JobNotFound(jobId);
        if (job.state != expected) {
            revert AegisTypes.InvalidJobState(jobId, job.state, expected);
        }
        _;
    }

    /// @dev Ensures caller is the client of the job
    modifier onlyClient(bytes32 jobId) {
        if (jobs[jobId].clientAddress != msg.sender) {
            revert AegisTypes.NotJobParty(jobId, msg.sender);
        }
        _;
    }

    /// @dev Ensures caller is the provider of the job
    modifier onlyProvider(bytes32 jobId) {
        if (jobs[jobId].providerWallet != msg.sender) {
            revert AegisTypes.NotJobParty(jobId, msg.sender);
        }
        _;
    }

    /// @dev Ensures caller is either client or provider
    modifier onlyJobParty(bytes32 jobId) {
        AegisTypes.Job storage job = jobs[jobId];
        if (msg.sender != job.clientAddress && msg.sender != job.providerWallet) {
            revert AegisTypes.NotJobParty(jobId, msg.sender);
        }
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @notice Deploy AegisEscrow with references to ERC-8004 registries and USDC
    /// @param _identityRegistry ERC-8004 Identity Registry address
    /// @param _reputationRegistry ERC-8004 Reputation Registry address
    /// @param _validationRegistry ERC-8004 Validation Registry address
    /// @param _usdc USDC token address
    /// @param _treasury Treasury contract for fee collection
    /// @param _owner Protocol admin
    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry,
        address _usdc,
        address _treasury,
        address _owner
    )
        Ownable(_owner)
    {
        if (_identityRegistry == address(0)) revert AegisTypes.ZeroAddress();
        if (_reputationRegistry == address(0)) revert AegisTypes.ZeroAddress();
        if (_validationRegistry == address(0)) revert AegisTypes.ZeroAddress();
        if (_usdc == address(0)) revert AegisTypes.ZeroAddress();
        if (_treasury == address(0)) revert AegisTypes.ZeroAddress();

        identityRegistry = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
        validationRegistry = IERC8004Validation(_validationRegistry);
        usdc = IERC20(_usdc);
        treasury = _treasury;

        // Sensible defaults
        protocolFeeBps = 250; // 2.5%
        disputeWindowSeconds = 24 hours;
        defaultValidationThreshold = 70; // 70/100 to auto-settle
        minEscrowAmount = 1e6; // 1 USDC (6 decimals)
        maxDeadlineDuration = 30 days;
        defaultDisputeSplit = 50; // 50% to client by default
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /// @notice Create a new escrowed job between two ERC-8004 registered agents
    /// @dev Verifies both agents exist in Identity Registry. Client must approve USDC
    ///      spend before calling this function. Funds are transferred atomically.
    /// @param clientAgentId Client's ERC-8004 agent ID
    /// @param providerAgentId Provider's ERC-8004 agent ID
    /// @param jobSpecHash KECCAK-256 of the job specification (IPFS CID recommended)
    /// @param jobSpecURI URI pointing to full job spec
    /// @param validatorAddress ERC-8004 validator contract for work verification
    /// @param deadline Absolute timestamp by which deliverable must be submitted
    /// @param amount USDC amount to lock in escrow (atomic units, 6 decimals)
    /// @param validationThreshold Minimum validation score for auto-settlement (0-100, 0 = use default)
    /// @param disputeSplit Timeout dispute split (% to client, 0-100, 0 = use default)
    /// @return jobId Unique identifier for this job
    function createJob(
        uint256 clientAgentId,
        uint256 providerAgentId,
        bytes32 jobSpecHash,
        string calldata jobSpecURI,
        address validatorAddress,
        uint256 deadline,
        uint256 amount,
        uint8 validationThreshold,
        uint8 disputeSplit
    )
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 jobId)
    {
        // --- Input Validation ---
        if (clientAgentId == providerAgentId) revert AegisTypes.SameAgent(clientAgentId);
        if (amount < minEscrowAmount) revert AegisTypes.InsufficientAmount(amount, minEscrowAmount);
        if (deadline <= block.timestamp) revert AegisTypes.InvalidDeadline(deadline);
        if (deadline > block.timestamp + maxDeadlineDuration) revert AegisTypes.InvalidDeadline(deadline);
        if (validatorAddress == address(0)) revert AegisTypes.InvalidValidator(validatorAddress);
        if (validationThreshold > 100) revert AegisTypes.InvalidThreshold(validationThreshold);
        if (disputeSplit > 100) revert AegisTypes.InvalidDisputeSplit(disputeSplit);

        // --- Verify both agents exist in ERC-8004 Identity Registry ---
        // ownerOf() will revert if token doesn't exist (ERC-721 behavior)
        address clientOwner = identityRegistry.ownerOf(clientAgentId);
        identityRegistry.ownerOf(providerAgentId); // just verify existence

        // Verify caller is the client agent's owner or an authorized caller (e.g., factory)
        bool isAuthorizedCaller = authorizedCallers[msg.sender];
        if (clientOwner != msg.sender && !isAuthorizedCaller) {
            revert AegisTypes.NotAgentOwner(clientAgentId, msg.sender);
        }

        // For authorized callers (factory), the actual client is the agent owner
        address actualClient = isAuthorizedCaller ? clientOwner : msg.sender;

        // --- Resolve provider's agentWallet from ERC-8004 ---
        address providerWallet = identityRegistry.getAgentWallet(providerAgentId);
        if (providerWallet == address(0)) {
            revert AegisTypes.AgentWalletNotSet(providerAgentId);
        }

        // --- Generate unique job ID ---
        jobId =
            keccak256(abi.encodePacked(clientAgentId, providerAgentId, jobSpecHash, block.timestamp, totalJobsCreated));

        // --- Use defaults if 0 provided ---
        uint8 threshold = validationThreshold == 0 ? defaultValidationThreshold : validationThreshold;
        uint8 split = disputeSplit == 0 ? defaultDisputeSplit : disputeSplit;

        // --- Store job ---
        AegisTypes.Job storage job = jobs[jobId];
        job.clientAgentId = clientAgentId;
        job.providerAgentId = providerAgentId;
        job.clientAddress = actualClient;
        job.providerWallet = providerWallet;
        job.jobSpecHash = jobSpecHash;
        job.jobSpecURI = jobSpecURI;
        job.validatorAddress = validatorAddress;
        job.validationThreshold = threshold;
        job.amount = amount;
        job.protocolFeeBps = protocolFeeBps;
        job.defaultDisputeSplit = split;
        job.createdAt = block.timestamp;
        job.deadline = deadline;
        job.state = AegisTypes.JobState.CREATED;

        // --- Track job for both agents ---
        agentJobs[clientAgentId].push(jobId);
        agentJobs[providerAgentId].push(jobId);
        totalJobsCreated++;

        // --- Transfer USDC from client to escrow (atomic funding) ---
        // When called via factory, transfers from the actual agent owner (not the factory)
        usdc.safeTransferFrom(actualClient, address(this), amount);
        job.state = AegisTypes.JobState.FUNDED;

        emit JobCreated(jobId, clientAgentId, providerAgentId, amount, validatorAddress, deadline);
        emit JobFunded(jobId, amount);
    }

    /// @notice Provider submits completed work for validation
    /// @dev Triggers a validation request on ERC-8004 Validation Registry.
    ///      Must be called before the job deadline.
    /// @param jobId The job to submit deliverable for
    /// @param deliverableURI URI pointing to the deliverable (IPFS recommended)
    /// @param deliverableHash KECCAK-256 of the deliverable content
    function submitDeliverable(
        bytes32 jobId,
        string calldata deliverableURI,
        bytes32 deliverableHash
    )
        external
        whenNotPaused
        nonReentrant
        inState(jobId, AegisTypes.JobState.FUNDED)
        onlyProvider(jobId)
    {
        AegisTypes.Job storage job = jobs[jobId];

        // Check deadline
        if (block.timestamp > job.deadline) {
            revert AegisTypes.DeadlinePassed(jobId, job.deadline);
        }

        // Store deliverable
        job.deliverableURI = deliverableURI;
        job.deliverableHash = deliverableHash;
        job.deliveredAt = block.timestamp;
        job.state = AegisTypes.JobState.DELIVERED;

        // --- Trigger validation via ERC-8004 Validation Registry ---
        // Build the validation request hash (commitment linking job spec + deliverable)
        bytes32 validationRequestHash =
            keccak256(abi.encodePacked(jobId, job.jobSpecHash, deliverableHash, block.timestamp));

        // Build request URI that validator will use to fetch job spec + deliverable
        // In production, this would point to an IPFS document containing both
        string memory requestURI = string(abi.encodePacked("aegis://validation/", _bytes32ToHex(jobId)));

        // Submit to ERC-8004 Validation Registry
        validationRegistry.validationRequest(
            job.validatorAddress, job.providerAgentId, requestURI, validationRequestHash
        );

        // Store mapping for callback routing
        job.validationRequestHash = validationRequestHash;
        validationToJob[validationRequestHash] = jobId;
        job.state = AegisTypes.JobState.VALIDATING;

        emit DeliverableSubmitted(jobId, deliverableURI, deliverableHash, validationRequestHash);
    }

    /// @notice Process validation result from ERC-8004 Validation Registry
    /// @dev Called after the validator has submitted its response on-chain.
    ///      Reads the validation score and either auto-settles or opens dispute window.
    ///      Can be called by anyone (permissionless — reads from on-chain state).
    /// @param jobId The job whose validation should be processed
    function processValidation(bytes32 jobId)
        external
        whenNotPaused
        nonReentrant
        inState(jobId, AegisTypes.JobState.VALIDATING)
    {
        AegisTypes.Job storage job = jobs[jobId];

        // Read validation result from ERC-8004 Validation Registry
        (
            , // validatorAddress (already known)
            , // agentId (already known)
            uint8 score,, // responseHash
            , // tag
            uint256 lastUpdate
        ) = validationRegistry.getValidationStatus(job.validationRequestHash);

        // Ensure validation has actually been submitted
        if (lastUpdate == 0) {
            revert AegisTypes.ValidationNotComplete(jobId);
        }

        job.validationScore = score;
        bool passed = score >= job.validationThreshold;

        emit ValidationReceived(jobId, score, passed);

        if (passed) {
            // Auto-settle: validation passed threshold
            _settleJob(jobId);
        } else {
            // Open dispute window: validation below threshold
            job.disputeWindowEnd = block.timestamp + disputeWindowSeconds;
            job.state = AegisTypes.JobState.DISPUTE_WINDOW;
            emit DisputeWindowStarted(jobId, job.disputeWindowEnd);
        }
    }

    /// @notice Client manually confirms delivery despite low/no validation
    /// @dev Allows client to override validation and release funds immediately.
    ///      Useful when validation is subjective or client is satisfied.
    /// @param jobId The job to confirm
    function confirmDelivery(bytes32 jobId) external whenNotPaused nonReentrant onlyClient(jobId) {
        AegisTypes.Job storage job = jobs[jobId];

        // Can confirm during VALIDATING or DISPUTE_WINDOW states
        if (job.state != AegisTypes.JobState.VALIDATING && job.state != AegisTypes.JobState.DISPUTE_WINDOW) {
            revert AegisTypes.InvalidJobState(
                jobId,
                job.state,
                AegisTypes.JobState.VALIDATING // representative expected state
            );
        }

        job.resolution = AegisTypes.DisputeResolution.CLIENT_CONFIRM;
        emit ClientConfirmed(jobId);
        _settleJob(jobId);
    }

    /// @notice Settle a job after dispute window closes without a dispute
    /// @dev Permissionless — anyone can call after dispute window expires.
    /// @param jobId The job to settle
    function settleAfterDisputeWindow(bytes32 jobId)
        external
        whenNotPaused
        nonReentrant
        inState(jobId, AegisTypes.JobState.DISPUTE_WINDOW)
    {
        AegisTypes.Job storage job = jobs[jobId];

        if (block.timestamp < job.disputeWindowEnd) {
            revert AegisTypes.DisputeWindowOpen(jobId);
        }

        _settleJob(jobId);
    }

    /// @notice Raise a dispute during the dispute window
    /// @dev Transitions job to DISPUTED state and delegates to AegisDispute contract.
    /// @param jobId The job to dispute
    /// @param evidenceURI URI to evidence supporting the dispute
    /// @param evidenceHash KECCAK-256 of the evidence content
    function raiseDispute(
        bytes32 jobId,
        string calldata evidenceURI,
        bytes32 evidenceHash
    )
        external
        whenNotPaused
        nonReentrant
        onlyJobParty(jobId)
    {
        AegisTypes.Job storage job = jobs[jobId];
        if (disputeContract == address(0)) revert AegisTypes.DisputeContractNotSet();

        // Can only dispute during DISPUTE_WINDOW or VALIDATING (before validation returns)
        if (job.state != AegisTypes.JobState.DISPUTE_WINDOW && job.state != AegisTypes.JobState.VALIDATING) {
            revert AegisTypes.InvalidJobState(jobId, job.state, AegisTypes.JobState.DISPUTE_WINDOW);
        }

        // If in dispute window, check it hasn't expired
        if (job.state == AegisTypes.JobState.DISPUTE_WINDOW) {
            if (block.timestamp > job.disputeWindowEnd) {
                revert AegisTypes.DisputeWindowClosed(jobId);
            }
        }

        job.state = AegisTypes.JobState.DISPUTED;
        emit DisputeRaised(jobId, msg.sender);

        // Delegate to dispute contract
        IAegisDispute(disputeContract).initiateDispute(jobId, msg.sender, evidenceURI, evidenceHash);
    }

    /// @notice Claim refund after deadline passes without delivery
    /// @dev Returns full escrow amount to client. Permissionless after deadline.
    /// @param jobId The job to refund
    function claimTimeout(bytes32 jobId)
        external
        whenNotPaused
        nonReentrant
        inState(jobId, AegisTypes.JobState.FUNDED)
    {
        AegisTypes.Job storage job = jobs[jobId];

        if (block.timestamp <= job.deadline) {
            revert AegisTypes.DeadlineNotPassed(jobId, job.deadline);
        }

        job.state = AegisTypes.JobState.EXPIRED;

        // Return full amount to client (no fee on refunds)
        usdc.safeTransfer(job.clientAddress, job.amount);

        job.state = AegisTypes.JobState.REFUNDED;
        emit JobRefunded(jobId, job.clientAddress, job.amount);

        // Submit negative reputation feedback for provider (missed deadline)
        _submitFeedback(
            job.providerAgentId,
            0, // 0/100 score for missing deadline
            "jobCompletion",
            "deadline-missed",
            ""
        );
    }

    /// @notice Resolve a dispute (called by AegisDispute contract)
    /// @dev Only callable by the authorized dispute contract.
    /// @param jobId The job being resolved
    /// @param clientPercent Percentage of funds going to client (0-100)
    /// @param method How the dispute was resolved
    function resolveDispute(
        bytes32 jobId,
        uint8 clientPercent,
        AegisTypes.DisputeResolution method
    )
        external
        inState(jobId, AegisTypes.JobState.DISPUTED)
    {
        if (msg.sender != disputeContract) {
            revert AegisTypes.NotAuthorized(msg.sender);
        }
        if (clientPercent > 100) revert AegisTypes.InvalidRuling(clientPercent);

        AegisTypes.Job storage job = jobs[jobId];

        // Calculate split
        uint256 fee = (job.amount * job.protocolFeeBps) / 10_000;
        uint256 afterFee = job.amount - fee;
        uint256 clientAmount = (afterFee * clientPercent) / 100;
        uint256 providerAmount = afterFee - clientAmount;

        // Distribute funds
        if (clientAmount > 0) {
            usdc.safeTransfer(job.clientAddress, clientAmount);
        }
        if (providerAmount > 0) {
            usdc.safeTransfer(job.providerWallet, providerAmount);
        }
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }

        job.state = AegisTypes.JobState.RESOLVED;
        job.resolution = method;
        job.settledAt = block.timestamp;
        totalVolumeSettled += job.amount;

        emit JobSettled(jobId, job.providerWallet, providerAmount, fee);

        // Submit reputation feedback based on resolution
        int128 providerScore = int128(int8(100 - clientPercent));
        _submitFeedback(job.providerAgentId, providerScore, "disputeResolution", _resolutionToTag(method), "");
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @notice Get full job details
    function getJob(bytes32 jobId) external view returns (AegisTypes.Job memory) {
        if (jobs[jobId].createdAt == 0) revert AegisTypes.JobNotFound(jobId);
        return jobs[jobId];
    }

    /// @notice Get all job IDs for an agent
    function getAgentJobIds(uint256 agentId) external view returns (bytes32[] memory) {
        return agentJobs[agentId];
    }

    /// @notice Get the number of jobs for an agent
    function getAgentJobCount(uint256 agentId) external view returns (uint256) {
        return agentJobs[agentId].length;
    }

    /// @notice Check if a job exists
    function jobExists(bytes32 jobId) external view returns (bool) {
        return jobs[jobId].createdAt != 0;
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /// @notice Update protocol fee (basis points)
    function setProtocolFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 1000) revert AegisTypes.FeeTooHigh(_feeBps);
        emit ProtocolFeeUpdated(protocolFeeBps, _feeBps);
        protocolFeeBps = _feeBps;
    }

    /// @notice Update dispute window duration
    function setDisputeWindow(uint256 _seconds) external onlyOwner {
        if (_seconds < 1 hours || _seconds > 7 days) revert AegisTypes.InvalidWindow(_seconds);
        emit DisputeWindowUpdated(disputeWindowSeconds, _seconds);
        disputeWindowSeconds = _seconds;
    }

    /// @notice Update default validation threshold
    function setDefaultValidationThreshold(uint8 _threshold) external onlyOwner {
        if (_threshold > 100) revert AegisTypes.InvalidThreshold(_threshold);
        defaultValidationThreshold = _threshold;
    }

    /// @notice Update default dispute split (% to client on timeout)
    function setDefaultDisputeSplit(uint8 _split) external onlyOwner {
        if (_split > 100) revert AegisTypes.InvalidDisputeSplit(_split);
        defaultDisputeSplit = _split;
    }

    /// @notice Update treasury address
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert AegisTypes.ZeroAddress();
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /// @notice Update dispute contract address
    function setDisputeContract(address _disputeContract) external onlyOwner {
        emit DisputeContractUpdated(disputeContract, _disputeContract);
        disputeContract = _disputeContract;
    }

    /// @notice Update minimum escrow amount
    function setMinEscrowAmount(uint256 _amount) external onlyOwner {
        minEscrowAmount = _amount;
    }

    /// @notice Update maximum deadline duration
    function setMaxDeadlineDuration(uint256 _duration) external onlyOwner {
        if (_duration < 1 hours) revert AegisTypes.DeadlineTooShort(_duration);
        maxDeadlineDuration = _duration;
    }

    /// @notice Set authorized caller status (e.g., AegisJobFactory)
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert AegisTypes.ZeroAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /// @notice Pause the protocol (emergency)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the protocol
    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /// @dev Settle a job: transfer funds to provider, collect fee, submit feedback
    function _settleJob(bytes32 jobId) internal {
        AegisTypes.Job storage job = jobs[jobId];

        // Calculate fee and provider amount
        uint256 fee = (job.amount * job.protocolFeeBps) / 10_000;
        uint256 providerAmount = job.amount - fee;

        // Transfer to provider's agentWallet (from ERC-8004)
        usdc.safeTransfer(job.providerWallet, providerAmount);

        // Transfer fee to treasury
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }

        // Update state
        job.state = AegisTypes.JobState.SETTLED;
        job.settledAt = block.timestamp;
        totalVolumeSettled += job.amount;

        emit JobSettled(jobId, job.providerWallet, providerAmount, fee);

        // Auto-submit reputation feedback to ERC-8004 Reputation Registry
        _submitFeedback(
            job.providerAgentId, int128(uint128(job.validationScore)), "jobCompletion", "settled", job.deliverableURI
        );
    }

    /// @dev Submit feedback to ERC-8004 Reputation Registry
    /// @param agentId The agent to submit feedback for
    /// @param value Feedback score
    /// @param tag1 Primary tag
    /// @param tag2 Secondary tag
    /// @param endpoint Relevant endpoint
    function _submitFeedback(
        uint256 agentId,
        int128 value,
        string memory tag1,
        string memory tag2,
        string memory endpoint
    )
        internal
    {
        // Try to submit feedback — don't revert if it fails (non-critical)
        try reputationRegistry.giveFeedback(
            agentId,
            value,
            0, // valueDecimals
            tag1,
            tag2,
            endpoint,
            "", // feedbackURI (can be set off-chain)
            bytes32(0) // feedbackHash
        ) {}
            catch {
            // Feedback submission is best-effort; don't block settlement
        }
    }

    /// @dev Convert DisputeResolution enum to a string tag for reputation
    function _resolutionToTag(AegisTypes.DisputeResolution method) internal pure returns (string memory) {
        if (method == AegisTypes.DisputeResolution.RE_VALIDATION) return "re-validation";
        if (method == AegisTypes.DisputeResolution.ARBITRATOR) return "arbitrator";
        if (method == AegisTypes.DisputeResolution.TIMEOUT_DEFAULT) return "timeout-default";
        if (method == AegisTypes.DisputeResolution.CLIENT_CONFIRM) return "client-confirm";
        return "unknown";
    }

    /// @dev Convert bytes32 to hex string (for URI construction)
    function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            result[i * 2] = hexChars[uint8(data[i] >> 4)];
            result[i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(result);
    }
}
