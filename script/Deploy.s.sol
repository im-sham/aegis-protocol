// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AegisEscrow} from "../src/AegisEscrow.sol";
import {AegisDispute} from "../src/AegisDispute.sol";
import {AegisTreasury} from "../src/AegisTreasury.sol";
import {AegisJobFactory} from "../src/AegisJobFactory.sol";

// Mock ERC-8004 registries (deployed on testnet until real registries exist)
import {MockIdentityRegistry} from "../test/mocks/Mocks.sol";
import {MockReputationRegistry} from "../test/mocks/Mocks.sol";
import {MockValidationRegistry} from "../test/mocks/Mocks.sol";

/// @title Deploy AEGIS Protocol
/// @notice Deploys the full AEGIS stack to a target network
/// @dev For testnet: deploys mock ERC-8004 registries since real ones don't exist yet
///
///   # Testnet deployment (Base Sepolia):
///   forge script script/Deploy.s.sol:DeployAegis \
///     --rpc-url https://sepolia.base.org \
///     --private-key $PRIVATE_KEY \
///     --broadcast --verify \
///     --etherscan-api-key $ETHERSCAN_API_KEY
///
///   # Mainnet deployment (Base):
///   forge script script/Deploy.s.sol:DeployAegis \
///     --rpc-url $BASE_MAINNET_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast --verify \
///     --etherscan-api-key $ETHERSCAN_API_KEY
contract DeployAegis is Script {
    // =========================================================================
    // Configuration — update these for each network
    // =========================================================================

    // USDC addresses per network
    // Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    // Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // Base Sepolia chain ID
    uint256 constant BASE_SEPOLIA_CHAIN_ID = 84532;
    uint256 constant BASE_MAINNET_CHAIN_ID = 8453;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== AEGIS Protocol Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        // Select USDC address based on chain
        address usdc;
        if (block.chainid == BASE_SEPOLIA_CHAIN_ID) {
            usdc = USDC_BASE_SEPOLIA;
            console.log("Network: Base Sepolia (testnet)");
        } else if (block.chainid == BASE_MAINNET_CHAIN_ID) {
            usdc = USDC_BASE_MAINNET;
            console.log("Network: Base Mainnet");
        } else {
            revert("Unsupported chain - add USDC address for this chain");
        }

        console.log("USDC:", usdc);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // =====================================================================
        // Step 1: Deploy ERC-8004 Mock Registries (testnet only)
        // =====================================================================
        address identityRegistry;
        address reputationRegistry;
        address validationRegistry;

        if (block.chainid == BASE_SEPOLIA_CHAIN_ID) {
            console.log("--- Deploying Mock ERC-8004 Registries (testnet) ---");

            MockIdentityRegistry identity = new MockIdentityRegistry();
            identityRegistry = address(identity);
            console.log("MockIdentityRegistry:", identityRegistry);

            MockReputationRegistry reputation = new MockReputationRegistry();
            reputationRegistry = address(reputation);
            console.log("MockReputationRegistry:", reputationRegistry);

            MockValidationRegistry validation = new MockValidationRegistry();
            validationRegistry = address(validation);
            console.log("MockValidationRegistry:", validationRegistry);

            console.log("");
        } else {
            // Mainnet: read registry addresses from environment
            identityRegistry = vm.envAddress("IDENTITY_REGISTRY");
            reputationRegistry = vm.envAddress("REPUTATION_REGISTRY");
            validationRegistry = vm.envAddress("VALIDATION_REGISTRY");
        }

        // =====================================================================
        // Step 2: Deploy AEGIS Core Contracts
        // =====================================================================
        console.log("--- Deploying AEGIS Core Contracts ---");

        // 2a. Treasury
        AegisTreasury treasury = new AegisTreasury(usdc, deployer);
        console.log("AegisTreasury:", address(treasury));

        // 2b. Escrow (core contract)
        AegisEscrow escrow = new AegisEscrow(
            identityRegistry,
            reputationRegistry,
            validationRegistry,
            usdc,
            address(treasury),
            deployer
        );
        console.log("AegisEscrow:", address(escrow));

        // 2c. Dispute
        AegisDispute dispute = new AegisDispute(address(escrow), usdc, address(treasury), deployer);
        console.log("AegisDispute:", address(dispute));

        // 2d. Job Factory
        AegisJobFactory factory = new AegisJobFactory(address(escrow), deployer);
        console.log("AegisJobFactory:", address(factory));

        console.log("");

        // =====================================================================
        // Step 3: Wire Up Contracts
        // =====================================================================
        console.log("--- Wiring contracts ---");

        escrow.setDisputeContract(address(dispute));
        console.log("Escrow -> Dispute contract set");

        escrow.setAuthorizedCaller(address(factory), true);
        console.log("Escrow -> Factory authorized as caller");

        treasury.setAuthorizedSource(address(escrow), true);
        console.log("Treasury -> Escrow authorized as fee source");

        treasury.setAuthorizedSource(address(dispute), true);
        console.log("Treasury -> Dispute authorized as fee source");

        vm.stopBroadcast();

        // =====================================================================
        // Summary
        // =====================================================================
        console.log("");
        console.log("========================================");
        console.log("  AEGIS Protocol Deployed Successfully");
        console.log("========================================");

        if (block.chainid == BASE_SEPOLIA_CHAIN_ID) {
            console.log("MockIdentityRegistry:    ", identityRegistry);
            console.log("MockReputationRegistry:  ", reputationRegistry);
            console.log("MockValidationRegistry:  ", validationRegistry);
        }

        console.log("AegisTreasury:           ", address(treasury));
        console.log("AegisEscrow:             ", address(escrow));
        console.log("AegisDispute:            ", address(dispute));
        console.log("AegisJobFactory:         ", address(factory));
        console.log("========================================");
        console.log("");
        console.log("USDC:                    ", usdc);
        console.log("Owner/Admin:             ", deployer);
        console.log("========================================");
    }
}
