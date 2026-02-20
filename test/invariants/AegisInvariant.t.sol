// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AegisEscrow} from "../../src/AegisEscrow.sol";
import {AegisDispute} from "../../src/AegisDispute.sol";
import {AegisTreasury} from "../../src/AegisTreasury.sol";
import {AegisJobFactory} from "../../src/AegisJobFactory.sol";
import {AegisTypes} from "../../src/libraries/AegisTypes.sol";
import {MockIdentityRegistry, MockReputationRegistry, MockValidationRegistry, MockUSDC} from "../mocks/Mocks.sol";
import {AegisHandler} from "./handlers/AegisHandler.sol";

/// @title AegisInvariant
/// @notice Foundry invariant tests for AEGIS Protocol.
///         Tests critical economic and state machine invariants via random handler calls.
contract AegisInvariant is Test {
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

    AegisHandler public handler;

    address public owner = makeAddr("owner");
    address public client = makeAddr("client");
    address public provider = makeAddr("provider");
    address public validatorAddr = makeAddr("validator");

    uint256 public clientAgentId;
    uint256 public providerAgentId;
    uint256 public initialMint;

    // =========================================================================
    // Setup
    // =========================================================================

    function setUp() public {
        // Deploy mocks
        identity = new MockIdentityRegistry();
        reputation = new MockReputationRegistry();
        validation = new MockValidationRegistry();
        usdc = new MockUSDC();

        // Deploy protocol
        treasury = new AegisTreasury(address(usdc), owner);
        escrow = new AegisEscrow(
            address(identity), address(reputation), address(validation), address(usdc), address(treasury), owner
        );
        disputeContract = new AegisDispute(address(escrow), address(usdc), address(treasury), owner);
        factory = new AegisJobFactory(address(escrow), owner);

        // Wire contracts
        vm.startPrank(owner);
        escrow.setDisputeContract(address(disputeContract));
        escrow.setAuthorizedCaller(address(factory), true);
        vm.stopPrank();

        // Register agents
        vm.prank(client);
        clientAgentId = identity.register("ipfs://client");
        vm.prank(provider);
        providerAgentId = identity.register("ipfs://provider");

        // Fund client
        initialMint = 10_000_000e6; // 10M USDC
        usdc.mint(client, initialMint);

        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(client);
        usdc.approve(address(disputeContract), type(uint256).max);

        // Deploy handler
        handler = new AegisHandler(
            escrow,
            disputeContract,
            treasury,
            identity,
            validation,
            usdc,
            owner,
            client,
            provider,
            validatorAddr,
            clientAgentId,
            providerAgentId,
            initialMint
        );

        // Target only the handler
        targetContract(address(handler));
    }

    // =========================================================================
    // Invariant 1: Fund Conservation
    // =========================================================================
    //
    // USDC is never created or destroyed by the protocol.
    // total minted == sum of balances across all tracked addresses.

    function invariant_fundConservation() public view {
        uint256 totalMinted = handler.ghost_totalMinted();

        uint256 clientBal = usdc.balanceOf(client);
        uint256 providerBal = usdc.balanceOf(provider);
        uint256 escrowBal = usdc.balanceOf(address(escrow));
        uint256 treasuryBal = usdc.balanceOf(address(treasury));
        uint256 disputeBal = usdc.balanceOf(address(disputeContract));
        uint256 handlerBal = usdc.balanceOf(address(handler));

        uint256 totalHeld = clientBal + providerBal + escrowBal + treasuryBal + disputeBal + handlerBal;

        assertEq(totalMinted, totalHeld, "Fund conservation violated: minted != held");
    }

    // =========================================================================
    // Invariant 2: Escrow Solvency
    // =========================================================================
    //
    // Escrow USDC balance >= sum of all active (non-terminal) job amounts.

    function invariant_escrowSolvency() public view {
        uint256 jobCount = handler.ghost_jobCount();
        uint256 activeSum;

        for (uint256 i = 0; i < jobCount; i++) {
            bytes32 jobId = handler.ghost_jobs(i);
            AegisTypes.Job memory job = escrow.getJob(jobId);

            // Active jobs: FUNDED, DELIVERED, VALIDATING, DISPUTE_WINDOW, DISPUTED
            if (
                job.state == AegisTypes.JobState.FUNDED || job.state == AegisTypes.JobState.DELIVERED
                    || job.state == AegisTypes.JobState.VALIDATING
                    || job.state == AegisTypes.JobState.DISPUTE_WINDOW || job.state == AegisTypes.JobState.DISPUTED
            ) {
                activeSum += job.amount;
            }
        }

        assertGe(usdc.balanceOf(address(escrow)), activeSum, "Escrow insolvent: balance < active job amounts");
    }

    // =========================================================================
    // Invariant 3: State Machine Monotonicity
    // =========================================================================
    //
    // Jobs never transition backward. The numeric enum value only increases.

    function invariant_stateMonotonicity() public view {
        uint256 jobCount = handler.ghost_jobCount();

        for (uint256 i = 0; i < jobCount; i++) {
            bytes32 jobId = handler.ghost_jobs(i);
            AegisTypes.Job memory job = escrow.getJob(jobId);
            uint8 currentState = uint8(job.state);
            uint8 highestSeen = handler.ghost_highestState(jobId);

            assertGe(currentState, highestSeen, "State machine violation: job moved backward");
        }
    }

    // =========================================================================
    // Invariant 4: Terminal State Permanence
    // =========================================================================
    //
    // Once a job reaches SETTLED, RESOLVED, REFUNDED, or CANCELLED, it stays there.

    function invariant_terminalStatePermanence() public view {
        uint256 jobCount = handler.ghost_jobCount();

        for (uint256 i = 0; i < jobCount; i++) {
            bytes32 jobId = handler.ghost_jobs(i);
            AegisTypes.Job memory job = escrow.getJob(jobId);
            uint8 currentState = uint8(job.state);

            // If we saw a terminal state, current must still be terminal
            uint8 highest = handler.ghost_highestState(jobId);
            if (_isTerminal(highest)) {
                assertTrue(_isTerminal(currentState), "Terminal state violated: job left terminal state");
            }
        }
    }

    // =========================================================================
    // Invariant 5: Job Count Consistency
    // =========================================================================
    //
    // Ghost job count matches escrow's totalJobsCreated.

    function invariant_jobCountConsistency() public view {
        assertEq(handler.ghost_jobCount(), escrow.totalJobsCreated(), "Job count mismatch");
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _isTerminal(uint8 state) internal pure returns (bool) {
        return state == uint8(AegisTypes.JobState.SETTLED) || state == uint8(AegisTypes.JobState.RESOLVED)
            || state == uint8(AegisTypes.JobState.REFUNDED) || state == uint8(AegisTypes.JobState.CANCELLED);
    }
}
