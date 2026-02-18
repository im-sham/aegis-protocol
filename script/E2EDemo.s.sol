// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AegisEscrow} from "../src/AegisEscrow.sol";
import {MockIdentityRegistry} from "../test/mocks/Mocks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title AEGIS End-to-End Testnet Demo
/// @notice Runs the full escrow lifecycle on Base Sepolia:
///   1. Register two agents (client + provider)
///   2. Create a job (locks USDC in escrow)
///   3. Provider submits deliverable
///   4. Client confirms delivery (bypasses oracle - settles immediately)
///   5. Verify USDC payouts and fee collection
///
/// @dev Since deployer owns both agents in this demo, confirmDelivery is used
///      instead of processValidation (which requires cross-tx oracle response).
///
///   forge script script/E2EDemo.s.sol:E2EDemo \
///     --rpc-url https://sepolia.base.org \
///     --private-key $PRIVATE_KEY \
///     --broadcast
contract E2EDemo is Script {
    // Deployed contract addresses (Base Sepolia - Block 37617228)
    address constant IDENTITY = 0xc67ed2b93a4B05c35872fBB15c199Ee30ce4300D;
    address constant ESCROW = 0xe988128467299fD856Bb45D2241811837BF35E77;
    address constant TREASURY = 0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5;
    address constant USDC_ADDR = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        MockIdentityRegistry identity = MockIdentityRegistry(IDENTITY);
        AegisEscrow escrow = AegisEscrow(ESCROW);
        IERC20 usdc = IERC20(USDC_ADDR);

        console.log("========================================");
        console.log("  AEGIS E2E Demo - Base Sepolia");
        console.log("========================================");
        console.log("Deployer/Caller:", deployer);
        console.log("");

        // Check USDC balance
        uint256 startBalance = usdc.balanceOf(deployer);
        console.log("Starting USDC Balance:", startBalance);
        require(startBalance >= 10e6, "Need at least 10 USDC - get from faucet.circle.com");

        vm.startBroadcast(deployerPrivateKey);

        // =====================================================================
        // Step 1: Register two agents
        // =====================================================================
        console.log("");
        console.log("--- Step 1: Register Agents ---");

        uint256 clientAgentId = identity.register("agent://aegis-demo/client-agent");
        console.log("Client Agent ID:", clientAgentId);
        console.log("Client Owner:", deployer);

        uint256 providerAgentId = identity.register("agent://aegis-demo/provider-agent");
        console.log("Provider Agent ID:", providerAgentId);
        console.log("Provider Wallet:", deployer);
        console.log("(Same wallet for demo - in production these are different entities)");

        // =====================================================================
        // Step 2: Approve USDC & Create Escrow Job
        // =====================================================================
        console.log("");
        console.log("--- Step 2: Create Escrow Job (10 USDC) ---");

        uint256 jobAmount = 10e6; // 10 USDC (6 decimals)
        uint256 deadline = block.timestamp + 7 days;
        bytes32 jobSpecHash = keccak256("aegis-demo-code-review-job-v1");
        uint8 validationThreshold = 70;

        // Approve escrow contract to pull USDC
        usdc.approve(ESCROW, jobAmount);
        console.log("USDC approved for escrow");

        // Create the job - this atomically transfers USDC into escrow
        bytes32 jobId = escrow.createJob(
            clientAgentId,
            providerAgentId,
            jobSpecHash,
            "ipfs://QmDemoJobSpec_CodeReview",
            deployer, // validator address (not used since we'll confirmDelivery)
            deadline,
            jobAmount,
            validationThreshold
        );
        console.log("Job created!");
        console.log("Job ID:");
        console.logBytes32(jobId);

        uint256 balanceAfterLock = usdc.balanceOf(deployer);
        uint256 escrowBalance = usdc.balanceOf(ESCROW);
        console.log("Client USDC after lock:", balanceAfterLock);
        console.log("Escrow USDC balance:", escrowBalance);

        // =====================================================================
        // Step 3: Provider Submits Deliverable
        // =====================================================================
        console.log("");
        console.log("--- Step 3: Provider Submits Deliverable ---");

        escrow.submitDeliverable(
            jobId, "ipfs://QmDemoDeliverable_CodeReviewReport", keccak256("demo-code-review-deliverable-v1")
        );
        console.log("Deliverable submitted! Job is now VALIDATING.");

        // =====================================================================
        // Step 4: Client Confirms Delivery (immediate settlement)
        // =====================================================================
        console.log("");
        console.log("--- Step 4: Client Confirms Delivery ---");

        // The client is satisfied with the deliverable and confirms directly.
        // This bypasses the validation oracle and settles the job immediately.
        // Provider receives (amount - protocolFee), treasury gets the fee.
        escrow.confirmDelivery(jobId);
        console.log("Delivery confirmed! Job SETTLED.");

        // =====================================================================
        // Step 5: Verify Payouts
        // =====================================================================
        console.log("");
        console.log("--- Step 5: Verify Payouts ---");

        uint256 endBalance = usdc.balanceOf(deployer);
        uint256 treasuryBalance = usdc.balanceOf(TREASURY);
        uint256 escrowBalanceAfter = usdc.balanceOf(ESCROW);

        console.log("Deployer USDC (end):", endBalance);
        console.log("Treasury USDC:", treasuryBalance);
        console.log("Escrow USDC (should be 0):", escrowBalanceAfter);

        // Since deployer is both client AND provider wallet:
        //   - Paid 10 USDC into escrow (as client)
        //   - Received (10 - 0.25) = 9.75 USDC from escrow (as provider)
        //   - Net loss = 0.25 USDC (the 2.5% protocol fee)
        uint256 netCost = startBalance - endBalance;
        console.log("Net cost (protocol fee):", netCost);
        console.log("Expected fee (2.5% of 10 USDC):", jobAmount * 250 / 10_000);

        vm.stopBroadcast();

        // =====================================================================
        // Summary
        // =====================================================================
        console.log("");
        console.log("========================================");
        console.log("  AEGIS E2E Demo COMPLETE!");
        console.log("========================================");
        console.log("Client Agent:      ID", clientAgentId);
        console.log("Provider Agent:    ID", providerAgentId);
        console.log("Job ID:");
        console.logBytes32(jobId);
        console.log("Escrow Amount:     10 USDC");
        console.log("Protocol Fee:      0.25 USDC (2.5%)");
        console.log("Provider Received: 9.75 USDC");
        console.log("Resolution:        CLIENT_CONFIRM");
        console.log("Status:            SETTLED");
        console.log("========================================");
        console.log("");
        console.log("View on Basescan:");
        console.log("  Escrow:   https://sepolia.basescan.org/address/0xe988128467299fD856Bb45D2241811837BF35E77");
        console.log("  Treasury: https://sepolia.basescan.org/address/0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5");
    }
}
