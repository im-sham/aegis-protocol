// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AegisEscrow} from "../src/AegisEscrow.sol";
import {MockIdentityRegistry} from "../test/mocks/Mocks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title AEGIS E2E Step 1: Register Agents + Create Job
/// @notice Registers two agents and creates an escrow job locking 10 USDC
/// @dev After running, check the broadcast logs or Basescan for the jobId.
///      Then pass it to Step 2.
///
///   forge script script/E2E_Step1_Setup.s.sol:E2EStep1 --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY
/// --broadcast
contract E2EStep1 is Script {
    address constant IDENTITY = 0xc67ed2b93a4B05c35872fBB15c199Ee30ce4300D;
    address constant ESCROW = 0xe988128467299fD856Bb45D2241811837BF35E77;
    address constant USDC_ADDR = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        MockIdentityRegistry identity = MockIdentityRegistry(IDENTITY);
        AegisEscrow escrow = AegisEscrow(ESCROW);
        IERC20 usdc = IERC20(USDC_ADDR);

        console.log("========================================");
        console.log("  AEGIS E2E Step 1: Setup");
        console.log("========================================");
        console.log("Deployer:", deployer);

        uint256 balance = usdc.balanceOf(deployer);
        console.log("USDC Balance:", balance);
        require(balance >= 10e6, "Need at least 10 USDC");

        vm.startBroadcast(deployerPrivateKey);

        // Register agents
        uint256 clientAgentId = identity.register("agent://aegis-demo/client-agent");
        console.log("Client Agent ID:", clientAgentId);

        uint256 providerAgentId = identity.register("agent://aegis-demo/provider-agent");
        console.log("Provider Agent ID:", providerAgentId);

        // Approve + create job
        uint256 jobAmount = 10e6;
        usdc.approve(ESCROW, jobAmount);

        bytes32 jobId = escrow.createJob(
            clientAgentId,
            providerAgentId,
            keccak256("aegis-demo-code-review-job-v1"),
            "ipfs://QmDemoJobSpec_CodeReview",
            deployer,
            block.timestamp + 7 days,
            jobAmount,
            70
        );

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  Step 1 COMPLETE");
        console.log("========================================");
        console.log("Client Agent:", clientAgentId);
        console.log("Provider Agent:", providerAgentId);
        console.log("Job ID:");
        console.logBytes32(jobId);
        console.log("10 USDC locked in escrow");
        console.log("");
        console.log("NEXT: Read the ACTUAL Job ID from the broadcast tx on Basescan,");
        console.log("then run Step 2 with that Job ID.");
    }
}
