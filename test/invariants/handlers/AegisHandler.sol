// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AegisEscrow} from "../../../src/AegisEscrow.sol";
import {AegisDispute} from "../../../src/AegisDispute.sol";
import {AegisTreasury} from "../../../src/AegisTreasury.sol";
import {AegisTypes} from "../../../src/libraries/AegisTypes.sol";
import {MockIdentityRegistry, MockReputationRegistry, MockValidationRegistry, MockUSDC} from "../../mocks/Mocks.sol";

/// @title AegisHandler
/// @notice Foundry invariant handler — wraps user-facing functions with bounded inputs
///         and tracks ghost variables for fund conservation and state machine assertions.
contract AegisHandler is Test {
    // =========================================================================
    // Protocol references
    // =========================================================================

    AegisEscrow public escrow;
    AegisDispute public disputeContract;
    AegisTreasury public treasury;
    MockIdentityRegistry public identity;
    MockValidationRegistry public validation;
    MockUSDC public usdc;

    // =========================================================================
    // Actors
    // =========================================================================

    address public owner;
    address public client;
    address public provider;
    address public validatorAddr;

    uint256 public clientAgentId;
    uint256 public providerAgentId;

    // =========================================================================
    // Ghost variables — track funds that should be conserved
    // =========================================================================

    /// @notice Total USDC minted during the test (initial supply)
    uint256 public ghost_totalMinted;

    /// @notice All jobIds created (for enumeration)
    bytes32[] public ghost_jobs;

    /// @notice Count of jobs in each terminal state
    uint256 public ghost_settled;
    uint256 public ghost_refunded;
    uint256 public ghost_resolved;

    /// @notice Track state transitions — no backward moves
    mapping(bytes32 => uint8) public ghost_highestState;

    // =========================================================================
    // Constants
    // =========================================================================

    uint256 constant MIN_AMOUNT = 1e6; // 1 USDC
    uint256 constant MAX_AMOUNT = 100_000e6; // 100k USDC

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        AegisEscrow _escrow,
        AegisDispute _disputeContract,
        AegisTreasury _treasury,
        MockIdentityRegistry _identity,
        MockValidationRegistry _validation,
        MockUSDC _usdc,
        address _owner,
        address _client,
        address _provider,
        address _validatorAddr,
        uint256 _clientAgentId,
        uint256 _providerAgentId,
        uint256 _totalMinted
    ) {
        escrow = _escrow;
        disputeContract = _disputeContract;
        treasury = _treasury;
        identity = _identity;
        validation = _validation;
        usdc = _usdc;
        owner = _owner;
        client = _client;
        provider = _provider;
        validatorAddr = _validatorAddr;
        clientAgentId = _clientAgentId;
        providerAgentId = _providerAgentId;
        ghost_totalMinted = _totalMinted;
    }

    // =========================================================================
    // Bounded actions
    // =========================================================================

    /// @notice Create a job with bounded parameters
    function createJob(uint256 amountSeed, uint256 deadlineSeed) external {
        uint256 amount = bound(amountSeed, MIN_AMOUNT, MAX_AMOUNT);
        uint256 deadlineOffset = bound(deadlineSeed, 1 hours, 30 days);
        uint256 deadline = block.timestamp + deadlineOffset;

        // Ensure client has enough USDC
        uint256 balance = usdc.balanceOf(client);
        if (balance < amount) {
            usdc.mint(client, amount - balance);
            ghost_totalMinted += (amount - balance);
        }

        vm.prank(client);
        usdc.approve(address(escrow), amount);

        vm.prank(client);
        try escrow.createJob(
            clientAgentId,
            providerAgentId,
            keccak256(abi.encodePacked("spec", ghost_jobs.length)),
            "ipfs://spec",
            validatorAddr,
            deadline,
            amount,
            0, // default threshold
            0 // default dispute split
        ) returns (bytes32 jobId) {
            ghost_jobs.push(jobId);
            ghost_highestState[jobId] = uint8(AegisTypes.JobState.FUNDED);
        } catch {}
    }

    /// @notice Submit deliverable for a random active job
    function submitDeliverable(uint256 jobSeed) external {
        if (ghost_jobs.length == 0) return;

        uint256 idx = bound(jobSeed, 0, ghost_jobs.length - 1);
        bytes32 jobId = ghost_jobs[idx];

        AegisTypes.Job memory job = escrow.getJob(jobId);
        if (job.state != AegisTypes.JobState.FUNDED) return;
        if (block.timestamp > job.deadline) return;

        vm.prank(provider);
        try escrow.submitDeliverable(jobId, "ipfs://deliverable", keccak256("deliverable")) {
            _updateHighest(jobId, uint8(AegisTypes.JobState.DELIVERED));
        } catch {}
    }

    /// @notice Process validation — mock sets score, then anyone can call processValidation
    function processValidation(uint256 jobSeed, uint8 scoreSeed) external {
        if (ghost_jobs.length == 0) return;

        uint256 idx = bound(jobSeed, 0, ghost_jobs.length - 1);
        bytes32 jobId = ghost_jobs[idx];

        AegisTypes.Job memory job = escrow.getJob(jobId);
        if (job.state != AegisTypes.JobState.VALIDATING) return;

        uint8 score = uint8(bound(scoreSeed, 0, 100));

        // Mock the validation response
        validation.submitResponse(job.validationRequestHash, score);

        try escrow.processValidation(jobId) {
            AegisTypes.Job memory updated = escrow.getJob(jobId);
            _updateHighest(jobId, uint8(updated.state));
            if (updated.state == AegisTypes.JobState.SETTLED) {
                ghost_settled++;
            }
        } catch {}
    }

    /// @notice Client confirms delivery early
    function confirmDelivery(uint256 jobSeed) external {
        if (ghost_jobs.length == 0) return;

        uint256 idx = bound(jobSeed, 0, ghost_jobs.length - 1);
        bytes32 jobId = ghost_jobs[idx];

        AegisTypes.Job memory job = escrow.getJob(jobId);
        // Can confirm during VALIDATING or DISPUTE_WINDOW
        if (job.state != AegisTypes.JobState.VALIDATING && job.state != AegisTypes.JobState.DISPUTE_WINDOW) return;

        vm.prank(client);
        try escrow.confirmDelivery(jobId) {
            _updateHighest(jobId, uint8(AegisTypes.JobState.SETTLED));
            ghost_settled++;
        } catch {}
    }

    /// @notice Settle after dispute window closes
    function settleAfterWindow(uint256 jobSeed) external {
        if (ghost_jobs.length == 0) return;

        uint256 idx = bound(jobSeed, 0, ghost_jobs.length - 1);
        bytes32 jobId = ghost_jobs[idx];

        AegisTypes.Job memory job = escrow.getJob(jobId);
        if (job.state != AegisTypes.JobState.DISPUTE_WINDOW) return;
        if (block.timestamp <= job.disputeWindowEnd) {
            vm.warp(job.disputeWindowEnd + 1);
        }

        try escrow.settleAfterDisputeWindow(jobId) {
            _updateHighest(jobId, uint8(AegisTypes.JobState.SETTLED));
            ghost_settled++;
        } catch {}
    }

    /// @notice Claim timeout refund for expired jobs
    function claimTimeout(uint256 jobSeed) external {
        if (ghost_jobs.length == 0) return;

        uint256 idx = bound(jobSeed, 0, ghost_jobs.length - 1);
        bytes32 jobId = ghost_jobs[idx];

        AegisTypes.Job memory job = escrow.getJob(jobId);
        if (job.state != AegisTypes.JobState.FUNDED) return;

        // Warp past deadline
        if (block.timestamp <= job.deadline) {
            vm.warp(job.deadline + 1);
        }

        vm.prank(client);
        try escrow.claimTimeout(jobId) {
            _updateHighest(jobId, uint8(AegisTypes.JobState.REFUNDED));
            ghost_refunded++;
        } catch {}
    }

    /// @notice Advance time to allow state transitions
    function warpTime(uint256 secondsSeed) external {
        uint256 delta = bound(secondsSeed, 1 minutes, 7 days);
        vm.warp(block.timestamp + delta);
    }

    // =========================================================================
    // View helpers
    // =========================================================================

    function ghost_jobCount() external view returns (uint256) {
        return ghost_jobs.length;
    }

    // =========================================================================
    // Internal
    // =========================================================================

    function _updateHighest(bytes32 jobId, uint8 newState) internal {
        if (newState > ghost_highestState[jobId]) {
            ghost_highestState[jobId] = newState;
        }
    }
}
