// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AegisTreasury} from "../src/AegisTreasury.sol";
import {AegisTypes} from "../src/libraries/AegisTypes.sol";
import {MockUSDC} from "./mocks/Mocks.sol";

contract AegisTreasuryTest is Test {
    // =========================================================================
    // State
    // =========================================================================

    AegisTreasury public treasury;
    MockUSDC public usdc;

    address public owner = makeAddr("owner");
    address public escrow = makeAddr("escrow");
    address public disputeAddr = makeAddr("dispute");
    address public outsider = makeAddr("outsider");
    address public recipient = makeAddr("recipient");

    uint256 public constant FEE_AMOUNT = 100e6; // 100 USDC

    // =========================================================================
    // Setup
    // =========================================================================

    function setUp() public {
        usdc = new MockUSDC();
        treasury = new AegisTreasury(address(usdc), owner);

        // Fund escrow for fee payments
        usdc.mint(escrow, 100_000e6);
        vm.prank(escrow);
        usdc.approve(address(treasury), type(uint256).max);

        // Authorize escrow as a source
        vm.prank(owner);
        treasury.setAuthorizedSource(escrow, true);
    }

    // =========================================================================
    // Helper
    // =========================================================================

    /// @dev Send a fee to the treasury from escrow
    function _receiveFee(uint256 amount) internal {
        vm.prank(escrow);
        treasury.receiveFee(amount);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsParameters() public view {
        assertEq(address(treasury.usdc()), address(usdc));
        assertEq(treasury.owner(), owner);
        assertEq(treasury.arbitratorPoolBps(), 2000); // 20%
        assertEq(treasury.totalFeesCollected(), 0);
        assertEq(treasury.treasuryBalance(), 0);
        assertEq(treasury.arbitratorPoolBalance(), 0);
    }

    function test_Constructor_RevertIfZeroUsdc() public {
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.ZeroAddress.selector));
        new AegisTreasury(address(0), owner);
    }

    // =========================================================================
    // Fee Collection Tests (receiveFee)
    // =========================================================================

    function test_ReceiveFee_Success() public {
        _receiveFee(FEE_AMOUNT);

        // 20% to arbitrator pool, 80% to treasury
        uint256 arbShare = (FEE_AMOUNT * 2000) / 10_000; // 20 USDC
        uint256 treasuryShare = FEE_AMOUNT - arbShare; // 80 USDC

        assertEq(treasury.treasuryBalance(), treasuryShare);
        assertEq(treasury.arbitratorPoolBalance(), arbShare);
        assertEq(treasury.totalFeesCollected(), FEE_AMOUNT);
        assertEq(usdc.balanceOf(address(treasury)), FEE_AMOUNT);
    }

    function test_ReceiveFee_MultipleFees() public {
        _receiveFee(FEE_AMOUNT);
        _receiveFee(50e6);
        _receiveFee(25e6);

        uint256 total = FEE_AMOUNT + 50e6 + 25e6;
        assertEq(treasury.totalFeesCollected(), total);
        assertEq(usdc.balanceOf(address(treasury)), total);
    }

    function test_ReceiveFee_SplitAccuracy() public {
        // Test with an odd amount to verify split math
        uint256 oddAmount = 33e6; // 33 USDC
        _receiveFee(oddAmount);

        uint256 arbShare = (oddAmount * 2000) / 10_000; // 6.6 USDC → 6_600_000
        uint256 treasuryShare = oddAmount - arbShare; // 26_400_000

        assertEq(treasury.arbitratorPoolBalance(), arbShare);
        assertEq(treasury.treasuryBalance(), treasuryShare);
        assertEq(arbShare + treasuryShare, oddAmount);
    }

    function test_ReceiveFee_AnyoneCanSend() public {
        // Fund outsider and approve
        usdc.mint(outsider, 1000e6);
        vm.prank(outsider);
        usdc.approve(address(treasury), type(uint256).max);

        // Anyone can call receiveFee (not just authorized sources)
        vm.prank(outsider);
        treasury.receiveFee(50e6);

        assertEq(treasury.totalFeesCollected(), 50e6);
    }

    function test_ReceiveFee_CustomSplit() public {
        // Change split to 0% arbitrator
        vm.prank(owner);
        treasury.setArbitratorPoolBps(0);

        _receiveFee(FEE_AMOUNT);

        assertEq(treasury.arbitratorPoolBalance(), 0);
        assertEq(treasury.treasuryBalance(), FEE_AMOUNT);
    }

    function test_ReceiveFee_MaxArbitratorSplit() public {
        // 50% to arbitrators
        vm.prank(owner);
        treasury.setArbitratorPoolBps(5000);

        _receiveFee(FEE_AMOUNT);

        assertEq(treasury.arbitratorPoolBalance(), FEE_AMOUNT / 2);
        assertEq(treasury.treasuryBalance(), FEE_AMOUNT / 2);
    }

    // =========================================================================
    // Treasury Withdrawal Tests
    // =========================================================================

    function test_WithdrawTreasury_Success() public {
        _receiveFee(FEE_AMOUNT);

        uint256 treasuryShare = treasury.treasuryBalance();

        vm.prank(owner);
        treasury.withdrawTreasury(recipient, treasuryShare);

        assertEq(usdc.balanceOf(recipient), treasuryShare);
        assertEq(treasury.treasuryBalance(), 0);
    }

    function test_WithdrawTreasury_Partial() public {
        _receiveFee(FEE_AMOUNT);

        uint256 fullBalance = treasury.treasuryBalance();
        uint256 halfWithdraw = fullBalance / 2;

        vm.prank(owner);
        treasury.withdrawTreasury(recipient, halfWithdraw);

        assertEq(usdc.balanceOf(recipient), halfWithdraw);
        assertEq(treasury.treasuryBalance(), fullBalance - halfWithdraw);
    }

    function test_WithdrawTreasury_RevertIfNotOwner() public {
        _receiveFee(FEE_AMOUNT);

        vm.prank(outsider);
        vm.expectRevert();
        treasury.withdrawTreasury(recipient, 1e6);
    }

    function test_WithdrawTreasury_RevertIfZeroAddress() public {
        _receiveFee(FEE_AMOUNT);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.ZeroAddress.selector));
        treasury.withdrawTreasury(address(0), 1e6);
    }

    function test_WithdrawTreasury_RevertIfInsufficientBalance() public {
        _receiveFee(FEE_AMOUNT);

        uint256 treasuryBal = treasury.treasuryBalance();

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(
            AegisTypes.InsufficientBalance.selector, treasuryBal + 1, treasuryBal
        ));
        treasury.withdrawTreasury(recipient, treasuryBal + 1);
    }

    // =========================================================================
    // Arbitrator Reward Distribution Tests
    // =========================================================================

    function test_DistributeArbitratorRewards_Success() public {
        _receiveFee(FEE_AMOUNT);

        uint256 arbPool = treasury.arbitratorPoolBalance();

        vm.prank(owner);
        treasury.distributeArbitratorRewards(disputeAddr, arbPool);

        assertEq(usdc.balanceOf(disputeAddr), arbPool);
        assertEq(treasury.arbitratorPoolBalance(), 0);
    }

    function test_DistributeArbitratorRewards_Partial() public {
        _receiveFee(FEE_AMOUNT);

        uint256 arbPool = treasury.arbitratorPoolBalance();
        uint256 halfDistribution = arbPool / 2;

        vm.prank(owner);
        treasury.distributeArbitratorRewards(disputeAddr, halfDistribution);

        assertEq(usdc.balanceOf(disputeAddr), halfDistribution);
        assertEq(treasury.arbitratorPoolBalance(), arbPool - halfDistribution);
    }

    function test_DistributeArbitratorRewards_RevertIfNotOwner() public {
        _receiveFee(FEE_AMOUNT);

        vm.prank(outsider);
        vm.expectRevert();
        treasury.distributeArbitratorRewards(disputeAddr, 1e6);
    }

    function test_DistributeArbitratorRewards_RevertIfZeroAddress() public {
        _receiveFee(FEE_AMOUNT);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.ZeroAddress.selector));
        treasury.distributeArbitratorRewards(address(0), 1e6);
    }

    function test_DistributeArbitratorRewards_RevertIfInsufficientBalance() public {
        _receiveFee(FEE_AMOUNT);

        uint256 arbPool = treasury.arbitratorPoolBalance();

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(
            AegisTypes.InsufficientBalance.selector, arbPool + 1, arbPool
        ));
        treasury.distributeArbitratorRewards(disputeAddr, arbPool + 1);
    }

    // =========================================================================
    // Sweep Tests
    // =========================================================================

    function test_Sweep_TracksUntrackedBalance() public {
        // Directly transfer USDC to treasury (not through receiveFee)
        usdc.mint(address(treasury), 50e6);

        // Untracked balance exists
        uint256 trackedBefore = treasury.treasuryBalance() + treasury.arbitratorPoolBalance();
        uint256 actualBalance = usdc.balanceOf(address(treasury));
        uint256 untracked = actualBalance - trackedBefore;
        assertEq(untracked, 50e6);

        vm.prank(owner);
        treasury.sweep();

        // Untracked amount added to treasury balance
        assertEq(treasury.treasuryBalance(), 50e6);
        assertEq(treasury.totalFeesCollected(), 50e6);
    }

    function test_Sweep_NoUntrackedBalance() public {
        _receiveFee(FEE_AMOUNT);

        uint256 treasuryBefore = treasury.treasuryBalance();

        // No untracked balance — sweep should be a no-op
        vm.prank(owner);
        treasury.sweep();

        assertEq(treasury.treasuryBalance(), treasuryBefore);
    }

    function test_Sweep_CombinedTrackedAndUntracked() public {
        // Receive fee normally
        _receiveFee(FEE_AMOUNT);

        uint256 trackedTreasury = treasury.treasuryBalance();
        uint256 trackedArbPool = treasury.arbitratorPoolBalance();

        // Also send USDC directly
        usdc.mint(address(treasury), 25e6);

        vm.prank(owner);
        treasury.sweep();

        // Untracked goes to treasury balance
        assertEq(treasury.treasuryBalance(), trackedTreasury + 25e6);
        // Arbitrator pool unchanged
        assertEq(treasury.arbitratorPoolBalance(), trackedArbPool);
    }

    function test_Sweep_RevertIfNotOwner() public {
        vm.prank(outsider);
        vm.expectRevert();
        treasury.sweep();
    }

    // =========================================================================
    // Admin Tests
    // =========================================================================

    function test_SetArbitratorPoolBps() public {
        vm.prank(owner);
        treasury.setArbitratorPoolBps(3000); // 30%

        assertEq(treasury.arbitratorPoolBps(), 3000);
    }

    function test_SetArbitratorPoolBps_RevertIfTooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Max 50%");
        treasury.setArbitratorPoolBps(5001);
    }

    function test_SetArbitratorPoolBps_RevertIfNotOwner() public {
        vm.prank(outsider);
        vm.expectRevert();
        treasury.setArbitratorPoolBps(3000);
    }

    function test_SetArbitratorPoolBps_ZeroAllowed() public {
        vm.prank(owner);
        treasury.setArbitratorPoolBps(0);
        assertEq(treasury.arbitratorPoolBps(), 0);
    }

    function test_SetAuthorizedSource() public {
        vm.prank(owner);
        treasury.setAuthorizedSource(escrow, true);
        assertTrue(treasury.authorizedSources(escrow));

        vm.prank(owner);
        treasury.setAuthorizedSource(escrow, false);
        assertFalse(treasury.authorizedSources(escrow));
    }

    function test_SetAuthorizedSource_RevertIfNotOwner() public {
        vm.prank(outsider);
        vm.expectRevert();
        treasury.setAuthorizedSource(escrow, true);
    }

    // =========================================================================
    // View Tests
    // =========================================================================

    function test_TotalBalance() public {
        assertEq(treasury.totalBalance(), 0);

        _receiveFee(FEE_AMOUNT);
        assertEq(treasury.totalBalance(), FEE_AMOUNT);

        // Direct transfer adds to actual balance
        usdc.mint(address(treasury), 50e6);
        assertEq(treasury.totalBalance(), FEE_AMOUNT + 50e6);
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_ReceiveFee_SplitAlwaysConsistent(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e6);

        usdc.mint(escrow, amount);
        vm.prank(escrow);
        usdc.approve(address(treasury), amount);

        _receiveFee(amount);

        uint256 arbShare = treasury.arbitratorPoolBalance();
        uint256 treasuryShare = treasury.treasuryBalance();

        // Sum of shares must equal total
        assertEq(arbShare + treasuryShare, amount);
        // Arb share should be exactly (amount * 2000) / 10_000
        assertEq(arbShare, (amount * 2000) / 10_000);
    }
}
