// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {AegisTypes} from "./libraries/AegisTypes.sol";

/// @title AegisTreasury
/// @author AEGIS Protocol
/// @notice Collects protocol fees from settled escrow jobs. Manages fee distribution
///         to protocol treasury and arbitrator reward pool.
/// @dev Receives USDC from AegisEscrow on settlement. In V2, governance token
///      stakers will also receive distributions.
contract AegisTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State Variables
    // =========================================================================

    /// @notice USDC token
    IERC20 public immutable usdc;

    /// @notice Authorized fee sources (AegisEscrow, AegisDispute)
    mapping(address => bool) public authorizedSources;

    /// @notice Total fees collected historically
    uint256 public totalFeesCollected;

    /// @notice Current treasury balance (owner-withdrawable)
    uint256 public treasuryBalance;

    /// @notice Arbitrator reward pool balance
    uint256 public arbitratorPoolBalance;

    /// @notice Split: percentage of fees going to arbitrator pool (basis points)
    uint256 public arbitratorPoolBps;

    // =========================================================================
    // Events
    // =========================================================================

    event FeeReceived(address indexed source, uint256 amount, uint256 treasuryShare, uint256 arbitratorShare);
    event TreasuryWithdrawal(address indexed to, uint256 amount);
    event ArbitratorRewardsDistributed(uint256 amount);
    event SourceAuthorized(address indexed source, bool authorized);
    event ArbitratorPoolBpsUpdated(uint256 oldBps, uint256 newBps);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _usdc, address _owner) Ownable(_owner) {
        if (_usdc == address(0)) revert AegisTypes.ZeroAddress();
        usdc = IERC20(_usdc);
        arbitratorPoolBps = 2000; // 20% of fees go to arbitrator pool
    }

    // =========================================================================
    // Fee Collection
    // =========================================================================

    /// @notice Receive fees — called by AegisEscrow on settlement
    /// @dev Anyone can send USDC, but we track authorized sources for accounting
    function receiveFee(uint256 amount) external nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        uint256 arbitratorShare = (amount * arbitratorPoolBps) / 10_000;
        uint256 treasuryShare = amount - arbitratorShare;

        treasuryBalance += treasuryShare;
        arbitratorPoolBalance += arbitratorShare;
        totalFeesCollected += amount;

        emit FeeReceived(msg.sender, amount, treasuryShare, arbitratorShare);
    }

    /// @notice Direct USDC transfers are also accepted (for slashed stakes, etc.)
    /// @dev Tracks incoming balance changes
    function sweep() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 tracked = treasuryBalance + arbitratorPoolBalance;

        if (balance > tracked) {
            uint256 untracked = balance - tracked;
            treasuryBalance += untracked;
            totalFeesCollected += untracked;
        }
    }

    // =========================================================================
    // Withdrawals
    // =========================================================================

    /// @notice Withdraw from treasury balance
    function withdrawTreasury(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert AegisTypes.ZeroAddress();
        if (amount > treasuryBalance) {
            revert AegisTypes.InsufficientBalance(amount, treasuryBalance);
        }

        treasuryBalance -= amount;
        usdc.safeTransfer(to, amount);

        emit TreasuryWithdrawal(to, amount);
    }

    /// @notice Distribute arbitrator rewards to the dispute contract
    /// @param disputeContract Address of AegisDispute to receive rewards
    /// @param amount Amount to distribute from arbitrator pool
    function distributeArbitratorRewards(address disputeContract, uint256 amount) external onlyOwner nonReentrant {
        if (disputeContract == address(0)) revert AegisTypes.ZeroAddress();
        if (amount > arbitratorPoolBalance) {
            revert AegisTypes.InsufficientBalance(amount, arbitratorPoolBalance);
        }

        arbitratorPoolBalance -= amount;
        usdc.safeTransfer(disputeContract, amount);

        emit ArbitratorRewardsDistributed(amount);
    }

    // =========================================================================
    // Admin
    // =========================================================================

    function setArbitratorPoolBps(uint256 _bps) external onlyOwner {
        require(_bps <= 5000, "Max 50%");
        emit ArbitratorPoolBpsUpdated(arbitratorPoolBps, _bps);
        arbitratorPoolBps = _bps;
    }

    function setAuthorizedSource(address source, bool authorized) external onlyOwner {
        authorizedSources[source] = authorized;
        emit SourceAuthorized(source, authorized);
    }

    // =========================================================================
    // Views
    // =========================================================================

    function totalBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
