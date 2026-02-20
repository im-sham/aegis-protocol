// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IERC8004Validation} from "./interfaces/IERC8004Validation.sol";
import {IERC8004Reputation} from "./interfaces/IERC8004Reputation.sol";
import {AegisTypes} from "./libraries/AegisTypes.sol";

interface IAegisEscrow {
    function getJob(bytes32 jobId) external view returns (AegisTypes.Job memory);
    function resolveDispute(bytes32 jobId, uint8 clientPercent, AegisTypes.DisputeResolution method) external;
    function validationRegistry() external view returns (address);
    function reputationRegistry() external view returns (address);
}

/// @title AegisDispute
/// @author AEGIS Protocol
/// @notice Three-tier dispute resolution system for contested agent escrow jobs.
///         Tier 1: Automated re-validation via ERC-8004
///         Tier 2: Staked arbitrator ruling
///         Tier 3: Timeout default split
/// @dev Manages the full dispute lifecycle: evidence submission, arbitrator assignment,
///      resolution, and callback to AegisEscrow for fund distribution.
contract AegisDispute is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State Variables
    // =========================================================================

    /// @notice The AegisEscrow contract
    IAegisEscrow public immutable escrow;

    /// @notice USDC for dispute bonds
    IERC20 public immutable usdc;

    /// @notice All disputes
    mapping(bytes32 => AegisTypes.Dispute) public disputes;

    /// @notice Maps jobId → disputeId
    mapping(bytes32 => bytes32) public jobToDispute;

    /// @notice Arbitrator stakes (address → staked amount)
    mapping(address => uint256) public arbitratorStakes;

    /// @notice Arbitrator statistics (for reputation-weighted assignment)
    mapping(address => ArbitratorStats) public arbitratorStats;

    /// @notice List of active arbitrators
    address[] public activeArbitrators;

    /// @notice Arbitrator index in array (for O(1) removal)
    mapping(address => uint256) internal _arbitratorIndex;

    /// @notice Is address an active arbitrator
    mapping(address => bool) public isArbitrator;

    /// @notice Number of unresolved disputes currently assigned to each arbitrator
    mapping(address => uint256) public arbitratorActiveDisputes;

    /// @notice Tracks re-validation request hashes that belong to each dispute
    mapping(bytes32 => mapping(bytes32 => bool)) public validReValidationHashes;

    /// @notice Treasury address for receiving slashed stakes
    address public treasury;

    /// @notice Dispute bond amount (USDC)
    uint256 public disputeBondAmount;

    /// @notice Evidence submission window (seconds)
    uint256 public evidenceWindowSeconds;

    /// @notice Dispute resolution TTL (seconds) — Tier 3 timeout
    uint256 public disputeTTLSeconds;

    /// @notice Minimum arbitrator stake (USDC)
    uint256 public minArbitratorStake;

    /// @notice Validation tolerance for Tier 1 re-validation (if within this
    ///         range of first score, consider consensus reached)
    uint8 public validationTolerance;

    /// @notice Total disputes created
    uint256 public totalDisputes;

    // =========================================================================
    // Structs
    // =========================================================================

    struct ArbitratorStats {
        uint256 totalResolutions;
        uint256 successfulResolutions; // not overturned/complained about
        uint256 totalFeesEarned;
        uint256 lastActiveAt;
    }

    // =========================================================================
    // Events
    // =========================================================================

    event DisputeInitiated(bytes32 indexed disputeId, bytes32 indexed jobId, address indexed initiator);
    event EvidenceSubmitted(bytes32 indexed disputeId, address indexed submitter, string evidenceURI);
    event ArbitratorAssigned(bytes32 indexed disputeId, address indexed arbitrator);
    event DisputeResolved(
        bytes32 indexed disputeId, bytes32 indexed jobId, uint8 clientPercent, AegisTypes.DisputeResolution method
    );
    event ReValidationRequested(bytes32 indexed disputeId, bytes32 newValidationHash);
    event ArbitratorStaked(address indexed arbitrator, uint256 amount);
    event ArbitratorUnstaked(address indexed arbitrator, uint256 amount);
    event ArbitratorSlashed(address indexed arbitrator, uint256 amount);
    event BondReturned(bytes32 indexed disputeId, address indexed to, uint256 amount);
    event BondForfeited(bytes32 indexed disputeId, address indexed from, uint256 amount);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _escrow, address _usdc, address _treasury, address _owner) Ownable(_owner) {
        if (_escrow == address(0)) revert AegisTypes.ZeroAddress();
        if (_usdc == address(0)) revert AegisTypes.ZeroAddress();
        if (_treasury == address(0)) revert AegisTypes.ZeroAddress();

        escrow = IAegisEscrow(_escrow);
        usdc = IERC20(_usdc);
        treasury = _treasury;

        // Defaults
        disputeBondAmount = 10e6; // 10 USDC
        evidenceWindowSeconds = 48 hours;
        disputeTTLSeconds = 7 days;
        minArbitratorStake = 1000e6; // 1,000 USDC
        validationTolerance = 10; // ±10 points for consensus
    }

    // =========================================================================
    // Dispute Lifecycle
    // =========================================================================

    /// @notice Initiate a dispute for a job (called by AegisEscrow)
    /// @param jobId The job being disputed
    /// @param initiator Who raised the dispute
    /// @param evidenceURI URI to initiator's evidence
    /// @param evidenceHash Hash of evidence content
    function initiateDispute(
        bytes32 jobId,
        address initiator,
        string calldata evidenceURI,
        bytes32 evidenceHash
    )
        external
        nonReentrant
    {
        // Only AegisEscrow can initiate disputes
        if (msg.sender != address(escrow)) revert AegisTypes.NotAuthorized(msg.sender);

        // Check no existing dispute
        if (jobToDispute[jobId] != bytes32(0)) revert AegisTypes.DisputeAlreadyExists(jobId);

        // Get job details
        AegisTypes.Job memory job = escrow.getJob(jobId);

        // Generate dispute ID
        bytes32 disputeId = keccak256(abi.encodePacked(jobId, initiator, block.timestamp, totalDisputes));

        // Determine respondent
        address respondent = initiator == job.clientAddress ? job.providerWallet : job.clientAddress;

        // Create dispute record
        AegisTypes.Dispute storage dispute = disputes[disputeId];
        dispute.jobId = jobId;
        dispute.initiator = initiator;
        dispute.respondent = respondent;
        dispute.initiatorEvidenceURI = evidenceURI;
        dispute.initiatorEvidenceHash = evidenceHash;
        dispute.createdAt = block.timestamp;
        dispute.evidenceDeadline = block.timestamp + evidenceWindowSeconds;
        dispute.resolutionDeadline = block.timestamp + disputeTTLSeconds;

        // Collect dispute bond from initiator
        dispute.initiatorBond = disputeBondAmount;
        usdc.safeTransferFrom(initiator, address(this), disputeBondAmount);

        jobToDispute[jobId] = disputeId;
        totalDisputes++;

        emit DisputeInitiated(disputeId, jobId, initiator);
    }

    /// @notice Submit counter-evidence (respondent only, during evidence window)
    /// @param disputeId The dispute to submit evidence for
    /// @param evidenceURI URI to evidence
    /// @param evidenceHash Hash of evidence content
    function submitEvidence(
        bytes32 disputeId,
        string calldata evidenceURI,
        bytes32 evidenceHash
    )
        external
        nonReentrant
    {
        AegisTypes.Dispute storage dispute = disputes[disputeId];

        if (dispute.createdAt == 0) revert AegisTypes.DisputeNotFound(disputeId);
        if (dispute.resolved) revert AegisTypes.DisputeAlreadyResolved(disputeId);
        if (block.timestamp > dispute.evidenceDeadline) revert AegisTypes.EvidenceWindowClosed(disputeId);

        // Only the respondent can submit counter-evidence
        if (msg.sender != dispute.respondent) revert AegisTypes.NotJobParty(dispute.jobId, msg.sender);

        dispute.respondentEvidenceURI = evidenceURI;
        dispute.respondentEvidenceHash = evidenceHash;
        dispute.respondentSubmitted = true;

        emit EvidenceSubmitted(disputeId, msg.sender, evidenceURI);
    }

    // =========================================================================
    // Tier 1: Automated Re-Validation
    // =========================================================================

    /// @notice Request re-validation from a different validator (Tier 1)
    /// @dev Reads the original job's validator and requests a second opinion.
    ///      If both scores are within tolerance, consensus is used.
    /// @param disputeId The dispute to re-validate
    /// @param newValidatorAddress Alternative validator to use
    function requestReValidation(bytes32 disputeId, address newValidatorAddress) external nonReentrant {
        AegisTypes.Dispute storage dispute = disputes[disputeId];

        if (dispute.createdAt == 0) revert AegisTypes.DisputeNotFound(disputeId);
        if (dispute.resolved) revert AegisTypes.DisputeAlreadyResolved(disputeId);
        if (newValidatorAddress == address(0)) revert AegisTypes.InvalidValidator(newValidatorAddress);

        // Can be requested by either party
        AegisTypes.Job memory job = escrow.getJob(dispute.jobId);
        if (msg.sender != dispute.initiator && msg.sender != dispute.respondent) {
            revert AegisTypes.NotJobParty(dispute.jobId, msg.sender);
        }

        // Ensure different validator from original
        if (newValidatorAddress == job.validatorAddress) revert AegisTypes.SameValidator(newValidatorAddress);

        // Submit re-validation request to ERC-8004
        bytes32 newRequestHash = keccak256(abi.encodePacked(disputeId, newValidatorAddress, block.timestamp));

        IERC8004Validation validationReg = IERC8004Validation(escrow.validationRegistry());
        validationReg.validationRequest(
            newValidatorAddress,
            job.providerAgentId,
            string(abi.encodePacked("aegis://revalidation/", _bytes32ToHex(disputeId))),
            newRequestHash
        );
        validReValidationHashes[disputeId][newRequestHash] = true;

        emit ReValidationRequested(disputeId, newRequestHash);
    }

    /// @notice Process re-validation result and resolve if consensus reached
    /// @param disputeId The dispute to process
    /// @param reValidationHash The re-validation request hash to check
    function processReValidation(bytes32 disputeId, bytes32 reValidationHash) external nonReentrant {
        AegisTypes.Dispute storage dispute = disputes[disputeId];

        if (dispute.createdAt == 0) revert AegisTypes.DisputeNotFound(disputeId);
        if (dispute.resolved) revert AegisTypes.DisputeAlreadyResolved(disputeId);
        if (!validReValidationHashes[disputeId][reValidationHash]) {
            revert AegisTypes.UnknownReValidationHash(disputeId, reValidationHash);
        }

        AegisTypes.Job memory job = escrow.getJob(dispute.jobId);

        // Read re-validation score from ERC-8004
        IERC8004Validation validationReg = IERC8004Validation(escrow.validationRegistry());
        (,, uint8 newScore,,, uint256 lastUpdate) = validationReg.getValidationStatus(reValidationHash);

        if (lastUpdate == 0) revert AegisTypes.ValidationNotComplete(dispute.jobId);

        uint8 originalScore = job.validationScore;

        // Check if scores are within tolerance (consensus)
        bool consensus;
        if (newScore >= originalScore) {
            consensus = (newScore - originalScore) <= validationTolerance;
        } else {
            consensus = (originalScore - newScore) <= validationTolerance;
        }

        if (consensus) {
            // Use average of both scores
            uint8 avgScore = uint8((uint16(originalScore) + uint16(newScore)) / 2);

            // If average passes threshold → provider gets paid
            // If average fails → client gets refund
            uint8 clientPercent = avgScore >= job.validationThreshold ? 0 : 100;

            _resolveDispute(disputeId, clientPercent, AegisTypes.DisputeResolution.RE_VALIDATION);
        }
        // If no consensus, parties must escalate to Tier 2 (arbitrator) or wait for Tier 3 (timeout)
    }

    // =========================================================================
    // Tier 2: Staked Arbitrator Resolution
    // =========================================================================

    /// @notice Stake USDC to become an arbitrator
    function stakeAsArbitrator(uint256 amount) external nonReentrant {
        if (amount < minArbitratorStake) revert AegisTypes.InsufficientAmount(amount, minArbitratorStake);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        arbitratorStakes[msg.sender] += amount;

        if (!isArbitrator[msg.sender]) {
            isArbitrator[msg.sender] = true;
            _arbitratorIndex[msg.sender] = activeArbitrators.length;
            activeArbitrators.push(msg.sender);
        }

        arbitratorStats[msg.sender].lastActiveAt = block.timestamp;

        emit ArbitratorStaked(msg.sender, amount);
    }

    /// @notice Withdraw arbitrator stake (cannot have active disputes)
    function unstakeArbitrator(uint256 amount) external nonReentrant {
        if (arbitratorStakes[msg.sender] < amount) revert AegisTypes.InsufficientAmount(amount, arbitratorStakes[msg.sender]);
        if (arbitratorActiveDisputes[msg.sender] > 0) revert AegisTypes.ArbitratorHasActiveDisputes(msg.sender);

        arbitratorStakes[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);

        // Remove from active list if below minimum
        if (arbitratorStakes[msg.sender] < minArbitratorStake && isArbitrator[msg.sender]) {
            _removeArbitrator(msg.sender);
        }

        emit ArbitratorUnstaked(msg.sender, amount);
    }

    /// @notice Assign an arbitrator to a dispute
    /// @dev Uses deterministic selection based on block data and stake weight.
    ///      Can be called by either dispute party after evidence window.
    /// @param disputeId The dispute needing an arbitrator
    function assignArbitrator(bytes32 disputeId) external nonReentrant {
        AegisTypes.Dispute storage dispute = disputes[disputeId];

        if (dispute.createdAt == 0) revert AegisTypes.DisputeNotFound(disputeId);
        if (dispute.resolved) revert AegisTypes.DisputeAlreadyResolved(disputeId);
        if (dispute.arbitrator != address(0)) revert AegisTypes.ArbitratorAlreadyAssigned(disputeId);
        if (activeArbitrators.length == 0) revert AegisTypes.NoArbitratorsAvailable();

        // Timing guard: wait at least 1 hour after dispute creation for entropy to advance
        if (block.timestamp < dispute.createdAt + 1 hours) revert AegisTypes.AssignmentTooEarly(disputeId);

        // Select arbitrator (pseudo-random, weighted by stake)
        address selected = _selectArbitrator(disputeId);

        // Ensure arbitrator isn't a dispute party
        if (selected == dispute.initiator || selected == dispute.respondent) {
            revert AegisTypes.ConflictOfInterest(disputeId, selected);
        }

        dispute.arbitrator = selected;
        arbitratorActiveDisputes[selected] += 1;
        emit ArbitratorAssigned(disputeId, selected);
    }

    /// @notice Arbitrator issues a binding ruling
    /// @param disputeId The dispute to resolve
    /// @param clientPercent Percentage of funds to client (0-100)
    /// @param rationaleURI URI explaining the ruling
    /// @param rationaleHash Hash of rationale content
    function resolveByArbitrator(
        bytes32 disputeId,
        uint8 clientPercent,
        string calldata rationaleURI,
        bytes32 rationaleHash
    )
        external
        nonReentrant
    {
        AegisTypes.Dispute storage dispute = disputes[disputeId];

        if (dispute.createdAt == 0) revert AegisTypes.DisputeNotFound(disputeId);
        if (dispute.resolved) revert AegisTypes.DisputeAlreadyResolved(disputeId);
        if (msg.sender != dispute.arbitrator) revert AegisTypes.NotArbitrator(disputeId, msg.sender);
        if (clientPercent > 100) revert AegisTypes.InvalidRuling(clientPercent);

        dispute.ruling = clientPercent;
        dispute.rationaleURI = rationaleURI;
        dispute.rationaleHash = rationaleHash;

        // Update arbitrator stats
        arbitratorStats[msg.sender].totalResolutions++;
        arbitratorStats[msg.sender].lastActiveAt = block.timestamp;

        _resolveDispute(disputeId, clientPercent, AegisTypes.DisputeResolution.ARBITRATOR);
    }

    // =========================================================================
    // Tier 3: Timeout Default
    // =========================================================================

    /// @notice Resolve by timeout if resolution deadline has passed
    /// @dev Applies the default split configured in the job template.
    ///      Can be called by anyone after deadline.
    /// @param disputeId The dispute to resolve by timeout
    function resolveByTimeout(bytes32 disputeId) external nonReentrant {
        AegisTypes.Dispute storage dispute = disputes[disputeId];

        if (dispute.createdAt == 0) revert AegisTypes.DisputeNotFound(disputeId);
        if (dispute.resolved) revert AegisTypes.DisputeAlreadyResolved(disputeId);
        if (block.timestamp < dispute.resolutionDeadline) {
            revert AegisTypes.ResolutionDeadlineNotPassed(disputeId);
        }

        // Read dispute split from the job (snapshotted at creation time)
        AegisTypes.Job memory job = escrow.getJob(dispute.jobId);
        uint8 defaultClientPercent = job.defaultDisputeSplit;

        // Slash non-responsive arbitrator if one was assigned
        if (dispute.arbitrator != address(0)) {
            uint256 slashAmount = arbitratorStakes[dispute.arbitrator] / 10; // 10% slash
            if (slashAmount > 0) {
                arbitratorStakes[dispute.arbitrator] -= slashAmount;
                // Send slashed amount to treasury
                usdc.safeTransfer(treasury, slashAmount);
                emit ArbitratorSlashed(dispute.arbitrator, slashAmount);

                if (arbitratorStakes[dispute.arbitrator] < minArbitratorStake) {
                    _removeArbitrator(dispute.arbitrator);
                }
            }
        }

        _resolveDispute(disputeId, defaultClientPercent, AegisTypes.DisputeResolution.TIMEOUT_DEFAULT);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    function getDispute(bytes32 disputeId) external view returns (AegisTypes.Dispute memory) {
        if (disputes[disputeId].createdAt == 0) revert AegisTypes.DisputeNotFound(disputeId);
        return disputes[disputeId];
    }

    function getDisputeForJob(bytes32 jobId) external view returns (bytes32) {
        return jobToDispute[jobId];
    }

    function getActiveArbitratorCount() external view returns (uint256) {
        return activeArbitrators.length;
    }

    function getArbitratorStats(address arbitrator) external view returns (ArbitratorStats memory) {
        return arbitratorStats[arbitrator];
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    function setDisputeBondAmount(uint256 _amount) external onlyOwner {
        disputeBondAmount = _amount;
    }

    function setEvidenceWindowSeconds(uint256 _seconds) external onlyOwner {
        if (_seconds < 1 hours || _seconds > 7 days) revert AegisTypes.InvalidWindow(_seconds);
        evidenceWindowSeconds = _seconds;
    }

    function setDisputeTTLSeconds(uint256 _seconds) external onlyOwner {
        if (_seconds < 1 days || _seconds > 30 days) revert AegisTypes.InvalidTTL(_seconds);
        disputeTTLSeconds = _seconds;
    }

    function setMinArbitratorStake(uint256 _amount) external onlyOwner {
        minArbitratorStake = _amount;
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert AegisTypes.ZeroAddress();
        treasury = _treasury;
    }

    function setValidationTolerance(uint8 _tolerance) external onlyOwner {
        if (_tolerance > 50) revert AegisTypes.ToleranceTooHigh(_tolerance);
        validationTolerance = _tolerance;
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /// @dev Core resolution logic — distributes bonds and calls back to AegisEscrow
    function _resolveDispute(bytes32 disputeId, uint8 clientPercent, AegisTypes.DisputeResolution method) internal {
        AegisTypes.Dispute storage dispute = disputes[disputeId];

        dispute.resolved = true;
        dispute.method = method;

        // Return dispute bond to initiator (bonds are returned regardless of outcome)
        // In a more aggressive version, loser's bond could be forfeited
        if (dispute.initiatorBond > 0) {
            usdc.safeTransfer(dispute.initiator, dispute.initiatorBond);
            emit BondReturned(disputeId, dispute.initiator, dispute.initiatorBond);
        }

        // Pay arbitrator fee if Tier 2
        if (method == AegisTypes.DisputeResolution.ARBITRATOR && dispute.arbitrator != address(0)) {
            arbitratorStats[dispute.arbitrator].successfulResolutions++;
            // Arbitrator fee is handled by the protocol fee from settlement
        }

        if (dispute.arbitrator != address(0) && arbitratorActiveDisputes[dispute.arbitrator] > 0) {
            arbitratorActiveDisputes[dispute.arbitrator] -= 1;
        }

        // Callback to AegisEscrow to distribute escrowed funds
        escrow.resolveDispute(dispute.jobId, clientPercent, method);

        emit DisputeResolved(disputeId, dispute.jobId, clientPercent, method);
    }

    /// @dev Select arbitrator using deterministic pseudo-random weighted by stake
    function _selectArbitrator(bytes32 disputeId) internal view returns (address) {
        uint256 totalStake = 0;
        for (uint256 i = 0; i < activeArbitrators.length; i++) {
            totalStake += arbitratorStakes[activeArbitrators[i]];
        }

        // Pseudo-random seed from block data and dispute ID
        uint256 seed = uint256(keccak256(abi.encodePacked(disputeId, block.timestamp, block.prevrandao, totalStake)));

        uint256 target = seed % totalStake;
        uint256 cumulative = 0;

        for (uint256 i = 0; i < activeArbitrators.length; i++) {
            cumulative += arbitratorStakes[activeArbitrators[i]];
            if (cumulative > target) {
                return activeArbitrators[i];
            }
        }

        // Fallback (should never reach)
        return activeArbitrators[0];
    }

    /// @dev Remove an arbitrator from the active list
    function _removeArbitrator(address arbitrator) internal {
        if (!isArbitrator[arbitrator]) return;

        uint256 index = _arbitratorIndex[arbitrator];
        uint256 lastIndex = activeArbitrators.length - 1;

        if (index != lastIndex) {
            address lastArbitrator = activeArbitrators[lastIndex];
            activeArbitrators[index] = lastArbitrator;
            _arbitratorIndex[lastArbitrator] = index;
        }

        activeArbitrators.pop();
        delete _arbitratorIndex[arbitrator];
        isArbitrator[arbitrator] = false;
    }

    /// @dev Convert bytes32 to hex string
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
