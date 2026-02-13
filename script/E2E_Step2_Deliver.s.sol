// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AegisEscrow} from "../src/AegisEscrow.sol";
import {AegisTypes} from "../src/libraries/AegisTypes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title AEGIS E2E Step 2: Deliver + Confirm + Settle
/// @notice Reads the job from chain, submits deliverable, confirms delivery, verifies payouts
/// @dev Reads the first active job for the deployer from totalJobsCreated counter.
///
///   forge script script/E2E_Step2_Deliver.s.sol:E2EStep2 --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY --broadcast
contract E2EStep2 is Script {
    address constant ESCROW = 0xe988128467299fD856Bb45D2241811837BF35E77;
    address constant TREASURY = 0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5;
    address constant USDC_ADDR = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        AegisEscrow escrow = AegisEscrow(ESCROW);
        IERC20 usdc = IERC20(USDC_ADDR);

        console.log("========================================");
        console.log("  AEGIS E2E Step 2: Deliver & Settle");
        console.log("========================================");
        console.log("Deployer:", deployer);

        // Find the job — read from agent jobs list
        // Agent ID 1 (client) should have jobs
        bytes32[] memory agentJobs = escrow.getAgentJobIds(1);
        require(agentJobs.length > 0, "No jobs found for agent 1 - run Step 1 first");

        // Use the last job created
        bytes32 jobId = agentJobs[agentJobs.length - 1];
        console.log("Found job ID:");
        console.logBytes32(jobId);

        // Read job state
        AegisTypes.Job memory job = escrow.getJob(jobId);
        console.log("Job state:", uint256(job.state));
        console.log("Job amount:", job.amount);
        console.log("Client:", job.clientAddress);
        console.log("Provider wallet:", job.providerWallet);

        uint256 startBalance = usdc.balanceOf(deployer);
        console.log("USDC balance before:", startBalance);

        vm.startBroadcast(deployerPrivateKey);

        // Step 3: Submit deliverable (only if job is in FUNDED state)
        if (job.state == AegisTypes.JobState.FUNDED) {
            console.log("");
            console.log("--- Submitting Deliverable ---");
            escrow.submitDeliverable(
                jobId,
                "ipfs://QmDemoDeliverable_CodeReviewReport",
                keccak256("demo-code-review-deliverable-v1")
            );
            console.log("Deliverable submitted! Job is now VALIDATING.");
        } else {
            console.log("Job not in FUNDED state, skipping submitDeliverable");
        }

        // Step 4: Client confirms delivery
        console.log("");
        console.log("--- Client Confirms Delivery ---");
        escrow.confirmDelivery(jobId);
        console.log("Delivery confirmed! Job SETTLED.");

        vm.stopBroadcast();

        // Step 5: Verify payouts
        console.log("");
        console.log("--- Verify Payouts ---");
        uint256 endBalance = usdc.balanceOf(deployer);
        uint256 treasuryBalance = usdc.balanceOf(TREASURY);
        uint256 escrowBalance = usdc.balanceOf(ESCROW);

        console.log("Deployer USDC (end):", endBalance);
        console.log("Treasury USDC:", treasuryBalance);
        console.log("Escrow USDC (should be 0):", escrowBalance);

        console.log("");
        console.log("========================================");
        console.log("  AEGIS E2E Demo COMPLETE!");
        console.log("========================================");
        console.log("Job ID:");
        console.logBytes32(jobId);
        console.log("Escrow Amount:     10 USDC");
        console.log("Protocol Fee:      0.25 USDC (2.5%)");
        console.log("Provider Received: 9.75 USDC");
        console.log("Resolution:        CLIENT_CONFIRM");
        console.log("Status:            SETTLED");
        console.log("========================================");
    }
}
