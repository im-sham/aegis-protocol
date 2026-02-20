// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AegisEscrow} from "../src/AegisEscrow.sol";
import {AegisDispute} from "../src/AegisDispute.sol";
import {AegisTreasury} from "../src/AegisTreasury.sol";
import {AegisJobFactory} from "../src/AegisJobFactory.sol";
import {AegisTypes} from "../src/libraries/AegisTypes.sol";
import {MockIdentityRegistry, MockReputationRegistry, MockValidationRegistry, MockUSDC} from "./mocks/Mocks.sol";

contract AegisEdgeCasesTest is Test {
    // =========================================================================
    // State
    // =========================================================================

    AegisEscrow public escrow;
    AegisDispute public disputeContract;
    AegisTreasury public treasury;
    AegisJobFactory public factory;

    MockIdentityRegistry public identity;
    MockReputationRegistry public reputation;
    MockValidationRegistry public validation;
    MockUSDC public usdc;

    address public owner = makeAddr("owner");
    address public client = makeAddr("client");
    address public provider = makeAddr("provider");
    address public validatorAddr = makeAddr("validator");
    address public outsider = makeAddr("outsider");

    uint256 public clientAgentId;
    uint256 public providerAgentId;

    uint256 public constant JOB_AMOUNT = 100e6;
    bytes32 public constant JOB_SPEC_HASH = keccak256("edge test");
    string public constant JOB_SPEC_URI = "ipfs://QmEdgeTest";
    bytes32 public constant DELIVERABLE_HASH = keccak256("deliverable");
    string public constant DELIVERABLE_URI = "ipfs://QmDeliverable";

    // =========================================================================
    // Setup
    // =========================================================================

    function setUp() public {
        identity = new MockIdentityRegistry();
        reputation = new MockReputationRegistry();
        validation = new MockValidationRegistry();
        usdc = new MockUSDC();

        treasury = new AegisTreasury(address(usdc), owner);

        escrow = new AegisEscrow(
            address(identity), address(reputation), address(validation), address(usdc), address(treasury), owner
        );

        disputeContract = new AegisDispute(address(escrow), address(usdc), address(treasury), owner);

        factory = new AegisJobFactory(address(escrow), owner);

        vm.prank(owner);
        escrow.setDisputeContract(address(disputeContract));

        vm.prank(owner);
        escrow.setAuthorizedCaller(address(factory), true);

        vm.prank(client);
        clientAgentId = identity.register("ipfs://client");

        vm.prank(provider);
        providerAgentId = identity.register("ipfs://provider");

        usdc.mint(client, 10_000_000e6); // 10M USDC
        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(client);
        usdc.approve(address(disputeContract), type(uint256).max);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _createJob(uint256 amount, uint256 deadline, uint8 threshold) internal returns (bytes32) {
        vm.prank(client);
        return escrow.createJob(
            clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, validatorAddr, deadline, amount, threshold, 0
        );
    }

    function _createDefaultJob() internal returns (bytes32) {
        return _createJob(JOB_AMOUNT, block.timestamp + 7 days, 70);
    }

    // =========================================================================
    // Edge Case: Max Deadline Boundary
    // =========================================================================

    function test_MaxDeadline_ExactlyAtLimit() public {
        // 30 days is the max deadline duration
        bytes32 jobId = _createJob(JOB_AMOUNT, block.timestamp + 30 days, 70);
        assertTrue(escrow.jobExists(jobId));
    }

    function test_MaxDeadline_RevertIfExceeded() public {
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.InvalidDeadline.selector, block.timestamp + 31 days));
        escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validatorAddr,
            block.timestamp + 31 days,
            JOB_AMOUNT,
            70,
            0
        );
    }

    function test_MaxDeadline_JustBelowLimit() public {
        bytes32 jobId = _createJob(JOB_AMOUNT, block.timestamp + 30 days - 1, 70);
        assertTrue(escrow.jobExists(jobId));
    }

    function test_MinDeadline_ExactlyAtLimit() public {
        // Deadline must be > block.timestamp
        bytes32 jobId = _createJob(JOB_AMOUNT, block.timestamp + 1, 70);
        assertTrue(escrow.jobExists(jobId));
    }

    // =========================================================================
    // Edge Case: Zero Validation Score
    // =========================================================================

    function test_ZeroValidationScore_OpensDisputeWindow() public {
        bytes32 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 0); // zero score!

        escrow.processValidation(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(job.validationScore, 0);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.DISPUTE_WINDOW));
    }

    function test_ZeroValidationScore_CanStillSettle() public {
        bytes32 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 0);
        escrow.processValidation(jobId);

        // Wait for dispute window to expire
        vm.warp(block.timestamp + 25 hours);
        escrow.settleAfterDisputeWindow(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));
    }

    function test_ZeroValidationScore_ClientCanStillConfirm() public {
        bytes32 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 0);
        escrow.processValidation(jobId);

        vm.prank(client);
        escrow.confirmDelivery(jobId);

        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.SETTLED));
    }

    // =========================================================================
    // Edge Case: Multiple Concurrent Jobs Between Same Agents
    // =========================================================================

    function test_MultipleConcurrentJobs_SameAgents() public {
        bytes32 jobId1 = _createJob(50e6, block.timestamp + 7 days, 70);
        bytes32 jobId2 = _createJob(75e6, block.timestamp + 14 days, 80);
        bytes32 jobId3 = _createJob(100e6, block.timestamp + 3 days, 60);

        assertTrue(jobId1 != jobId2);
        assertTrue(jobId2 != jobId3);
        assertTrue(jobId1 != jobId3);

        // All jobs exist and funded
        assertEq(uint8(escrow.getJob(jobId1).state), uint8(AegisTypes.JobState.FUNDED));
        assertEq(uint8(escrow.getJob(jobId2).state), uint8(AegisTypes.JobState.FUNDED));
        assertEq(uint8(escrow.getJob(jobId3).state), uint8(AegisTypes.JobState.FUNDED));

        // Total in escrow
        assertEq(usdc.balanceOf(address(escrow)), 50e6 + 75e6 + 100e6);

        // Agent job tracking
        bytes32[] memory clientJobs = escrow.getAgentJobIds(clientAgentId);
        assertEq(clientJobs.length, 3);
    }

    function test_MultipleConcurrentJobs_IndependentLifecycles() public {
        bytes32 jobId1 = _createJob(50e6, block.timestamp + 7 days, 70);
        bytes32 jobId2 = _createJob(75e6, block.timestamp + 14 days, 80);

        // Deliver job 1 only
        vm.prank(provider);
        escrow.submitDeliverable(jobId1, DELIVERABLE_URI, DELIVERABLE_HASH);

        // Validate and settle job 1
        bytes32 reqHash1 = escrow.getJob(jobId1).validationRequestHash;
        validation.submitResponse(reqHash1, 90);
        escrow.processValidation(jobId1);

        // Job 1 settled, Job 2 still funded
        assertEq(uint8(escrow.getJob(jobId1).state), uint8(AegisTypes.JobState.SETTLED));
        assertEq(uint8(escrow.getJob(jobId2).state), uint8(AegisTypes.JobState.FUNDED));

        // Escrow still holds job 2's funds
        assertEq(usdc.balanceOf(address(escrow)), 75e6);
    }

    // =========================================================================
    // Edge Case: Minimum Escrow Amount
    // =========================================================================

    function test_MinEscrowAmount_ExactMinimum() public {
        bytes32 jobId = _createJob(1e6, block.timestamp + 7 days, 70); // exactly 1 USDC
        assertEq(escrow.getJob(jobId).amount, 1e6);
    }

    function test_MinEscrowAmount_RevertIfBelowMinimum() public {
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.InsufficientAmount.selector, 999_999, 1e6));
        escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validatorAddr,
            block.timestamp + 7 days,
            999_999, // below 1 USDC minimum
            70,
            0
        );
    }

    // =========================================================================
    // Edge Case: Validation Threshold Boundaries
    // =========================================================================

    function test_ValidationThreshold_100_RequiresPerfectScore() public {
        bytes32 jobId = _createJob(JOB_AMOUNT, block.timestamp + 7 days, 100);

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        // Score 99 should fail threshold 100
        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 99);
        escrow.processValidation(jobId);

        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.DISPUTE_WINDOW));
    }

    function test_ValidationThreshold_100_PerfectScoreSettles() public {
        bytes32 jobId = _createJob(JOB_AMOUNT, block.timestamp + 7 days, 100);

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 100);
        escrow.processValidation(jobId);

        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.SETTLED));
    }

    function test_ValidationThreshold_1_AlmostAnythingPasses() public {
        bytes32 jobId = _createJob(JOB_AMOUNT, block.timestamp + 7 days, 1);

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 1);
        escrow.processValidation(jobId);

        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.SETTLED));
    }

    // =========================================================================
    // Edge Case: Paused Protocol
    // =========================================================================

    function test_Paused_BlocksAllCoreFunctions() public {
        bytes32 jobId = _createDefaultJob();

        vm.prank(owner);
        escrow.pause();

        // Job creation blocked
        vm.prank(client);
        vm.expectRevert();
        escrow.createJob(
            clientAgentId,
            providerAgentId,
            keccak256("blocked"),
            "ipfs://blocked",
            validatorAddr,
            block.timestamp + 7 days,
            JOB_AMOUNT,
            70,
            0
        );

        // Deliverable submission blocked
        vm.prank(provider);
        vm.expectRevert();
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        // Confirm delivery blocked
        vm.prank(client);
        vm.expectRevert();
        escrow.confirmDelivery(jobId);
    }

    function test_Paused_CanUnpauseAndResume() public {
        bytes32 jobId = _createDefaultJob();

        vm.prank(owner);
        escrow.pause();

        vm.prank(owner);
        escrow.unpause();

        // Should work again
        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.VALIDATING));
    }

    function test_Paused_OnlyOwnerCanPause() public {
        vm.prank(outsider);
        vm.expectRevert();
        escrow.pause();
    }

    function test_Paused_OnlyOwnerCanUnpause() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(outsider);
        vm.expectRevert();
        escrow.unpause();
    }

    // =========================================================================
    // Edge Case: Large USDC Amounts
    // =========================================================================

    function test_LargeAmount_1MillionUSDC() public {
        uint256 largeAmount = 1_000_000e6;
        usdc.mint(client, largeAmount);
        vm.prank(client);
        usdc.approve(address(escrow), largeAmount);

        bytes32 jobId = _createJob(largeAmount, block.timestamp + 7 days, 70);

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 90);
        escrow.processValidation(jobId);

        uint256 fee = (largeAmount * 250) / 10_000; // 25,000 USDC
        uint256 providerAmount = largeAmount - fee;

        assertEq(usdc.balanceOf(provider), providerAmount);
        assertEq(usdc.balanceOf(address(treasury)), fee);
    }

    // =========================================================================
    // Edge Case: Protocol Fee Edge Cases
    // =========================================================================

    function test_ZeroProtocolFee() public {
        vm.prank(owner);
        escrow.setProtocolFee(0);

        bytes32 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 90);
        escrow.processValidation(jobId);

        // Provider gets full amount, treasury gets nothing
        assertEq(usdc.balanceOf(provider), JOB_AMOUNT);
        assertEq(usdc.balanceOf(address(treasury)), 0);
    }

    function test_ProtocolFeeSnapshot_ImmutablePerJob() public {
        // Create job with 2.5% fee
        bytes32 jobId = _createDefaultJob();

        // Change protocol fee to 5%
        vm.prank(owner);
        escrow.setProtocolFee(500);

        // Settle job — should use original 2.5% fee
        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 90);
        escrow.processValidation(jobId);

        // Fee should be 2.5% not 5%
        uint256 expectedFee = (JOB_AMOUNT * 250) / 10_000; // 2.5 USDC
        assertEq(usdc.balanceOf(address(treasury)), expectedFee);
    }

    // =========================================================================
    // Invariant: Escrow USDC balance == sum of active job amounts
    // =========================================================================

    function test_Invariant_EscrowBalanceEqualsActiveJobs() public {
        // Create 3 jobs
        bytes32 jobId1 = _createJob(50e6, block.timestamp + 7 days, 70);
        bytes32 jobId2 = _createJob(75e6, block.timestamp + 7 days, 70);
        bytes32 jobId3 = _createJob(100e6, block.timestamp + 7 days, 70);

        // Escrow should hold exactly the sum
        assertEq(usdc.balanceOf(address(escrow)), 50e6 + 75e6 + 100e6);

        // Settle job 1
        vm.prank(provider);
        escrow.submitDeliverable(jobId1, DELIVERABLE_URI, DELIVERABLE_HASH);
        bytes32 reqHash1 = escrow.getJob(jobId1).validationRequestHash;
        validation.submitResponse(reqHash1, 90);
        escrow.processValidation(jobId1);

        // Escrow should now hold only job2 + job3
        assertEq(usdc.balanceOf(address(escrow)), 75e6 + 100e6);

        // Timeout job 3
        vm.warp(block.timestamp + 8 days);
        escrow.claimTimeout(jobId3);

        // Escrow should now hold only job2 (but job2 is also expired due to warp)
        // Actually, job2's deadline was block.timestamp(original) + 7 days, and we warped 8 days
        // So both job2 and job3 should be expired
        assertEq(usdc.balanceOf(address(escrow)), 75e6); // job2 still held

        // Refund job 2
        escrow.claimTimeout(jobId2);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_Invariant_NoFundsTrapped_FullLifecycle() public {
        uint256 systemBalBefore = usdc.balanceOf(client) + usdc.balanceOf(provider) + usdc.balanceOf(address(escrow))
            + usdc.balanceOf(address(treasury)) + usdc.balanceOf(address(disputeContract));

        // Create and settle a job
        bytes32 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 90);
        escrow.processValidation(jobId);

        uint256 systemBalAfter = usdc.balanceOf(client) + usdc.balanceOf(provider) + usdc.balanceOf(address(escrow))
            + usdc.balanceOf(address(treasury)) + usdc.balanceOf(address(disputeContract));

        // No USDC created or destroyed — conservation of value
        assertEq(systemBalAfter, systemBalBefore);
    }

    function test_Invariant_NoFundsTrapped_DisputeResolution() public {
        uint256 systemBalBefore = usdc.balanceOf(client) + usdc.balanceOf(provider) + usdc.balanceOf(address(escrow))
            + usdc.balanceOf(address(treasury)) + usdc.balanceOf(address(disputeContract));

        // Create job, fail validation, raise dispute, resolve by timeout
        bytes32 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 40);
        escrow.processValidation(jobId);

        vm.prank(client);
        escrow.raiseDispute(jobId, "ipfs://evidence", keccak256("evidence"));

        bytes32 disputeId = disputeContract.jobToDispute(jobId);

        vm.warp(block.timestamp + 8 days);
        disputeContract.resolveByTimeout(disputeId);

        uint256 systemBalAfter = usdc.balanceOf(client) + usdc.balanceOf(provider) + usdc.balanceOf(address(escrow))
            + usdc.balanceOf(address(treasury)) + usdc.balanceOf(address(disputeContract));

        assertEq(systemBalAfter, systemBalBefore);
    }

    function test_Invariant_NoFundsTrapped_Refund() public {
        uint256 systemBalBefore = usdc.balanceOf(client) + usdc.balanceOf(provider) + usdc.balanceOf(address(escrow))
            + usdc.balanceOf(address(treasury));

        bytes32 jobId = _createDefaultJob();

        vm.warp(block.timestamp + 8 days);
        escrow.claimTimeout(jobId);

        uint256 systemBalAfter = usdc.balanceOf(client) + usdc.balanceOf(provider) + usdc.balanceOf(address(escrow))
            + usdc.balanceOf(address(treasury));

        assertEq(systemBalAfter, systemBalBefore);
    }

    // =========================================================================
    // Fuzz: Dispute Resolution Split Math
    // =========================================================================

    function testFuzz_DisputeResolution_SplitMath(uint8 clientPercent) public {
        clientPercent = uint8(bound(clientPercent, 0, 100));

        bytes32 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 40);
        escrow.processValidation(jobId);

        vm.prank(client);
        escrow.raiseDispute(jobId, "ipfs://evidence", keccak256("evidence"));

        bytes32 disputeId = disputeContract.jobToDispute(jobId);

        // Stake and assign an arbitrator
        address arb = makeAddr("arbFuzz");
        usdc.mint(arb, 2000e6);
        vm.prank(arb);
        usdc.approve(address(disputeContract), type(uint256).max);
        vm.prank(arb);
        disputeContract.stakeAsArbitrator(1000e6);

        vm.warp(block.timestamp + 1 hours);
        disputeContract.assignArbitrator(disputeId);

        // Get assigned arbitrator (may not be arb if selection is pseudo-random)
        AegisTypes.Dispute memory d = disputeContract.getDispute(disputeId);

        uint256 clientBefore = usdc.balanceOf(client);
        uint256 providerBefore = usdc.balanceOf(provider);
        uint256 treasuryBefore = usdc.balanceOf(address(treasury));

        vm.prank(d.arbitrator);
        disputeContract.resolveByArbitrator(disputeId, clientPercent, "ipfs://r", keccak256("r"));

        uint256 clientAfter = usdc.balanceOf(client);
        uint256 providerAfter = usdc.balanceOf(provider);
        uint256 treasuryAfter = usdc.balanceOf(address(treasury));

        // Verify total outflow from escrow equals job amount
        uint256 clientGain = clientAfter - clientBefore;
        uint256 providerGain = providerAfter - providerBefore;
        uint256 feeGain = treasuryAfter - treasuryBefore;

        // Bond return (10 USDC) is part of clientGain
        uint256 bond = 10e6;
        uint256 jobRelatedClientGain = clientGain - bond;

        // job amount = client share + provider share + fee
        assertEq(jobRelatedClientGain + providerGain + feeGain, JOB_AMOUNT);
    }
}
