// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AegisEscrow} from "../src/AegisEscrow.sol";
import {AegisDispute} from "../src/AegisDispute.sol";
import {AegisTreasury} from "../src/AegisTreasury.sol";
import {AegisJobFactory} from "../src/AegisJobFactory.sol";
import {AegisTypes} from "../src/libraries/AegisTypes.sol";
import {MockIdentityRegistry, MockReputationRegistry, MockValidationRegistry, MockUSDC} from "./mocks/Mocks.sol";

contract AegisEscrowTest is Test {
    // =========================================================================
    // State
    // =========================================================================

    AegisEscrow public escrow;
    AegisDispute public dispute;
    AegisTreasury public treasury;
    AegisJobFactory public factory;

    MockIdentityRegistry public identity;
    MockReputationRegistry public reputation;
    MockValidationRegistry public validation;
    MockUSDC public usdc;

    // Actors
    address public owner = makeAddr("owner");
    address public client = makeAddr("client");
    address public provider = makeAddr("provider");
    address public validator = makeAddr("validator");
    address public arbitrator = makeAddr("arbitrator");
    address public outsider = makeAddr("outsider");

    // Agent IDs (set in setUp)
    uint256 public clientAgentId;
    uint256 public providerAgentId;

    // Test constants
    uint256 public constant JOB_AMOUNT = 100e6; // 100 USDC
    bytes32 public constant JOB_SPEC_HASH = keccak256("test job spec");
    string public constant JOB_SPEC_URI = "ipfs://QmTestJobSpec";
    bytes32 public constant DELIVERABLE_HASH = keccak256("test deliverable");
    string public constant DELIVERABLE_URI = "ipfs://QmTestDeliverable";

    // =========================================================================
    // Setup
    // =========================================================================

    function setUp() public {
        // Deploy mocks
        identity = new MockIdentityRegistry();
        reputation = new MockReputationRegistry();
        validation = new MockValidationRegistry();
        usdc = new MockUSDC();

        // Deploy treasury
        treasury = new AegisTreasury(address(usdc), owner);

        // Deploy escrow
        escrow = new AegisEscrow(
            address(identity), address(reputation), address(validation), address(usdc), address(treasury), owner
        );

        // Deploy dispute
        dispute = new AegisDispute(address(escrow), address(usdc), address(treasury), owner);

        // Deploy factory
        factory = new AegisJobFactory(address(escrow), owner);

        // Wire up dispute contract
        vm.prank(owner);
        escrow.setDisputeContract(address(dispute));

        // Register agents in ERC-8004 mock
        vm.prank(client);
        clientAgentId = identity.register("ipfs://client-agent");

        vm.prank(provider);
        providerAgentId = identity.register("ipfs://provider-agent");

        // Fund client with USDC
        usdc.mint(client, 10_000e6); // 10,000 USDC

        // Approve escrow to spend client's USDC
        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);

        // Fund arbitrator for staking
        usdc.mint(arbitrator, 10_000e6);
        vm.prank(arbitrator);
        usdc.approve(address(dispute), type(uint256).max);
    }

    // =========================================================================
    // Helper Functions
    // =========================================================================

    function _createDefaultJob() internal returns (bytes32 jobId) {
        vm.prank(client);
        jobId = escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp + 7 days,
            JOB_AMOUNT,
            70 // 70% validation threshold
        );
    }

    function _submitDeliverable(bytes32 jobId) internal {
        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);
    }

    function _getValidationRequestHash(bytes32 jobId) internal view returns (bytes32) {
        AegisTypes.Job memory job = escrow.getJob(jobId);
        return job.validationRequestHash;
    }

    function _submitValidationScore(bytes32 jobId, uint8 score) internal {
        bytes32 requestHash = _getValidationRequestHash(jobId);
        validation.submitResponse(requestHash, score);
    }

    // =========================================================================
    // Job Creation Tests
    // =========================================================================

    function test_CreateJob_Success() public {
        bytes32 jobId = _createDefaultJob();

        AegisTypes.Job memory job = escrow.getJob(jobId);

        assertEq(job.clientAgentId, clientAgentId);
        assertEq(job.providerAgentId, providerAgentId);
        assertEq(job.clientAddress, client);
        assertEq(job.providerWallet, provider);
        assertEq(job.jobSpecHash, JOB_SPEC_HASH);
        assertEq(job.amount, JOB_AMOUNT);
        assertEq(job.validationThreshold, 70);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.FUNDED));

        // USDC transferred to escrow
        assertEq(usdc.balanceOf(address(escrow)), JOB_AMOUNT);
        assertEq(usdc.balanceOf(client), 10_000e6 - JOB_AMOUNT);
    }

    function test_CreateJob_IncrementsTotalJobs() public {
        assertEq(escrow.totalJobsCreated(), 0);
        _createDefaultJob();
        assertEq(escrow.totalJobsCreated(), 1);
        _createDefaultJob();
        assertEq(escrow.totalJobsCreated(), 2);
    }

    function test_CreateJob_TracksAgentJobs() public {
        bytes32 jobId = _createDefaultJob();

        bytes32[] memory clientJobs = escrow.getAgentJobIds(clientAgentId);
        bytes32[] memory providerJobs = escrow.getAgentJobIds(providerAgentId);

        assertEq(clientJobs.length, 1);
        assertEq(providerJobs.length, 1);
        assertEq(clientJobs[0], jobId);
        assertEq(providerJobs[0], jobId);
    }

    function test_CreateJob_RevertIfSameAgent() public {
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.SameAgent.selector, clientAgentId));
        escrow.createJob(
            clientAgentId,
            clientAgentId, // same agent!
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp + 7 days,
            JOB_AMOUNT,
            70
        );
    }

    function test_CreateJob_RevertIfAmountTooLow() public {
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.InsufficientAmount.selector, 0.5e6, 1e6));
        escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp + 7 days,
            0.5e6, // below minimum
            70
        );
    }

    function test_CreateJob_RevertIfDeadlinePassed() public {
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.InvalidDeadline.selector, block.timestamp - 1));
        escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp - 1, // in the past
            JOB_AMOUNT,
            70
        );
    }

    function test_CreateJob_RevertIfNotAgentOwner() public {
        vm.prank(outsider); // not the client agent owner
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.NotAgentOwner.selector, clientAgentId, outsider));
        escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp + 7 days,
            JOB_AMOUNT,
            70
        );
    }

    function test_CreateJob_RevertIfProviderWalletNotSet() public {
        // Register a new agent with no wallet
        vm.prank(outsider);
        uint256 noWalletAgent = identity.register("ipfs://no-wallet");
        identity.setAgentWalletUnchecked(noWalletAgent, address(0));

        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.AgentWalletNotSet.selector, noWalletAgent));
        escrow.createJob(
            clientAgentId,
            noWalletAgent,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp + 7 days,
            JOB_AMOUNT,
            70
        );
    }

    function test_CreateJob_UsesDefaultThresholdWhenZero() public {
        vm.prank(client);
        bytes32 jobId = escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp + 7 days,
            JOB_AMOUNT,
            0 // should use default (70)
        );

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(job.validationThreshold, 70); // default
    }

    // =========================================================================
    // Deliverable Submission Tests
    // =========================================================================

    function test_SubmitDeliverable_Success() public {
        bytes32 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(job.deliverableHash, DELIVERABLE_HASH);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.VALIDATING));
        assertTrue(job.validationRequestHash != bytes32(0));
    }

    function test_SubmitDeliverable_RevertIfNotProvider() public {
        bytes32 jobId = _createDefaultJob();

        vm.prank(client); // wrong party
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.NotJobParty.selector, jobId, client));
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);
    }

    function test_SubmitDeliverable_RevertIfDeadlinePassed() public {
        bytes32 jobId = _createDefaultJob();

        // Warp past deadline
        vm.warp(block.timestamp + 8 days);

        AegisTypes.Job memory job = escrow.getJob(jobId);

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.DeadlinePassed.selector, jobId, job.deadline));
        escrow.submitDeliverable(jobId, DELIVERABLE_URI, DELIVERABLE_HASH);
    }

    // =========================================================================
    // Validation & Settlement Tests
    // =========================================================================

    function test_ProcessValidation_AutoSettleOnPass() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);

        // Validator submits a passing score (85 >= 70 threshold)
        _submitValidationScore(jobId, 85);

        // Process validation
        escrow.processValidation(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));
        assertEq(job.validationScore, 85);

        // Check funds distributed: 100 USDC - 2.5% fee = 97.5 USDC to provider
        uint256 fee = (JOB_AMOUNT * 250) / 10_000; // 2.5 USDC
        uint256 providerAmount = JOB_AMOUNT - fee;

        assertEq(usdc.balanceOf(provider), providerAmount);
        assertEq(usdc.balanceOf(address(treasury)), fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_ProcessValidation_DisputeWindowOnFail() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);

        // Validator submits a failing score (50 < 70 threshold)
        _submitValidationScore(jobId, 50);

        escrow.processValidation(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.DISPUTE_WINDOW));
        assertEq(job.validationScore, 50);
        assertTrue(job.disputeWindowEnd > block.timestamp);
    }

    function test_ProcessValidation_RevertIfNotYetResponded() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);

        // Don't submit any validation score

        vm.expectRevert(abi.encodeWithSelector(AegisTypes.ValidationNotComplete.selector, jobId));
        escrow.processValidation(jobId);
    }

    function test_ProcessValidation_PerfectScore() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 100);
        escrow.processValidation(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));
        assertEq(job.validationScore, 100);
    }

    function test_ProcessValidation_ExactThreshold() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 70); // exactly at threshold
        escrow.processValidation(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));
    }

    function test_ProcessValidation_JustBelowThreshold() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 69); // just below 70
        escrow.processValidation(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.DISPUTE_WINDOW));
    }

    // =========================================================================
    // Client Confirmation Tests
    // =========================================================================

    function test_ConfirmDelivery_DuringValidating() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);

        // Client confirms before validation even returns
        vm.prank(client);
        escrow.confirmDelivery(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));
        assertEq(uint8(job.resolution), uint8(AegisTypes.DisputeResolution.CLIENT_CONFIRM));
    }

    function test_ConfirmDelivery_DuringDisputeWindow() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 50);
        escrow.processValidation(jobId);

        // Client confirms despite low validation
        vm.prank(client);
        escrow.confirmDelivery(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));
    }

    function test_ConfirmDelivery_RevertIfNotClient() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.NotJobParty.selector, jobId, provider));
        escrow.confirmDelivery(jobId);
    }

    // =========================================================================
    // Dispute Window Settlement Tests
    // =========================================================================

    function test_SettleAfterDisputeWindow() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 50);
        escrow.processValidation(jobId);

        // Warp past dispute window
        vm.warp(block.timestamp + 25 hours);

        escrow.settleAfterDisputeWindow(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));
    }

    function test_SettleAfterDisputeWindow_RevertIfWindowOpen() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 50);
        escrow.processValidation(jobId);

        // Don't warp — window still open
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.DisputeWindowOpen.selector, jobId));
        escrow.settleAfterDisputeWindow(jobId);
    }

    // =========================================================================
    // Timeout / Refund Tests
    // =========================================================================

    function test_ClaimTimeout_Success() public {
        bytes32 jobId = _createDefaultJob();

        // Warp past deadline
        vm.warp(block.timestamp + 8 days);

        uint256 clientBalanceBefore = usdc.balanceOf(client);
        escrow.claimTimeout(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.REFUNDED));

        // Full refund (no fee)
        assertEq(usdc.balanceOf(client), clientBalanceBefore + JOB_AMOUNT);
    }

    function test_ClaimTimeout_RevertIfDeadlineNotPassed() public {
        bytes32 jobId = _createDefaultJob();

        AegisTypes.Job memory job = escrow.getJob(jobId);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.DeadlineNotPassed.selector, jobId, job.deadline));
        escrow.claimTimeout(jobId);
    }

    function test_ClaimTimeout_SubmitsNegativeReputation() public {
        bytes32 jobId = _createDefaultJob();
        vm.warp(block.timestamp + 8 days);

        uint256 feedbackBefore = reputation.feedbackCount();
        escrow.claimTimeout(jobId);

        // Reputation feedback should have been submitted
        assertEq(reputation.feedbackCount(), feedbackBefore + 1);
    }

    // =========================================================================
    // Dispute Flow Tests
    // =========================================================================

    function test_RaiseDispute_Success() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 50);
        escrow.processValidation(jobId);

        // Fund client for dispute bond
        usdc.mint(client, 100e6);
        vm.prank(client);
        usdc.approve(address(dispute), type(uint256).max);

        // Client raises dispute
        vm.prank(client);
        escrow.raiseDispute(jobId, "ipfs://evidence", keccak256("evidence"));

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.DISPUTED));
    }

    function test_RaiseDispute_RevertIfNotJobParty() public {
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 50);
        escrow.processValidation(jobId);

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.NotJobParty.selector, jobId, outsider));
        escrow.raiseDispute(jobId, "ipfs://evidence", keccak256("evidence"));
    }

    // =========================================================================
    // Admin Tests
    // =========================================================================

    function test_SetProtocolFee() public {
        vm.prank(owner);
        escrow.setProtocolFee(300); // 3%

        assertEq(escrow.protocolFeeBps(), 300);
    }

    function test_SetProtocolFee_RevertIfTooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Fee too high");
        escrow.setProtocolFee(1001); // > 10%
    }

    function test_SetProtocolFee_RevertIfNotOwner() public {
        vm.prank(outsider);
        vm.expectRevert();
        escrow.setProtocolFee(300);
    }

    function test_Pause_BlocksJobCreation() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(client);
        vm.expectRevert();
        escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp + 7 days,
            JOB_AMOUNT,
            70
        );
    }

    function test_Unpause_AllowsJobCreation() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(owner);
        escrow.unpause();

        // Should work now
        bytes32 jobId = _createDefaultJob();
        assertTrue(escrow.jobExists(jobId));
    }

    // =========================================================================
    // Volume Tracking Tests
    // =========================================================================

    function test_VolumeTracking() public {
        assertEq(escrow.totalVolumeSettled(), 0);

        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);
        _submitValidationScore(jobId, 85);
        escrow.processValidation(jobId);

        assertEq(escrow.totalVolumeSettled(), JOB_AMOUNT);
    }

    // =========================================================================
    // Full Lifecycle Integration Test
    // =========================================================================

    function test_FullLifecycle_HappyPath() public {
        // 1. Client creates job
        bytes32 jobId = _createDefaultJob();
        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.FUNDED));

        // 2. Provider submits deliverable
        _submitDeliverable(jobId);
        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.VALIDATING));

        // 3. Validator submits passing score
        _submitValidationScore(jobId, 90);

        // 4. Anyone processes validation → auto-settle
        escrow.processValidation(jobId);
        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.SETTLED));

        // 5. Verify financial outcomes
        uint256 fee = (JOB_AMOUNT * 250) / 10_000;
        assertEq(usdc.balanceOf(provider), JOB_AMOUNT - fee);
        assertEq(usdc.balanceOf(address(treasury)), fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);

        // 6. Verify stats
        assertEq(escrow.totalJobsCreated(), 1);
        assertEq(escrow.totalVolumeSettled(), JOB_AMOUNT);

        // 7. Verify reputation feedback was submitted
        assertTrue(reputation.feedbackCount() > 0);
    }

    function test_FullLifecycle_DisputePath() public {
        // 1. Create & deliver
        bytes32 jobId = _createDefaultJob();
        _submitDeliverable(jobId);

        // 2. Validation fails
        _submitValidationScore(jobId, 40);
        escrow.processValidation(jobId);
        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.DISPUTE_WINDOW));

        // 3. No dispute raised, window expires
        vm.warp(block.timestamp + 25 hours);
        escrow.settleAfterDisputeWindow(jobId);

        // 4. Provider still gets paid (dispute window passed without dispute)
        assertEq(uint8(escrow.getJob(jobId).state), uint8(AegisTypes.JobState.SETTLED));
        assertTrue(usdc.balanceOf(provider) > 0);
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_CreateJob_VariableAmounts(uint256 amount) public {
        // Bound to valid range
        amount = bound(amount, 1e6, 1_000_000e6); // 1 to 1M USDC

        // Fund client
        usdc.mint(client, amount);
        vm.prank(client);
        usdc.approve(address(escrow), amount);

        vm.prank(client);
        bytes32 jobId = escrow.createJob(
            clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, validator, block.timestamp + 7 days, amount, 70
        );

        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(job.amount, amount);
        assertEq(usdc.balanceOf(address(escrow)), amount);
    }

    function testFuzz_ValidationThreshold(uint8 threshold, uint8 score) public {
        threshold = uint8(bound(threshold, 1, 100));
        score = uint8(bound(score, 0, 100));

        vm.prank(client);
        bytes32 jobId = escrow.createJob(
            clientAgentId,
            providerAgentId,
            JOB_SPEC_HASH,
            JOB_SPEC_URI,
            validator,
            block.timestamp + 7 days,
            JOB_AMOUNT,
            threshold
        );

        _submitDeliverable(jobId);
        _submitValidationScore(jobId, score);
        escrow.processValidation(jobId);

        AegisTypes.Job memory job = escrow.getJob(jobId);

        if (score >= threshold) {
            assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));
        } else {
            assertEq(uint8(job.state), uint8(AegisTypes.JobState.DISPUTE_WINDOW));
        }
    }
}
