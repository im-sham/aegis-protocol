// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AegisEscrow} from "../src/AegisEscrow.sol";
import {AegisDispute} from "../src/AegisDispute.sol";
import {AegisTreasury} from "../src/AegisTreasury.sol";
import {AegisJobFactory} from "../src/AegisJobFactory.sol";
import {AegisTypes} from "../src/libraries/AegisTypes.sol";
import {MockIdentityRegistry, MockReputationRegistry, MockValidationRegistry, MockUSDC} from "./mocks/Mocks.sol";

contract AegisJobFactoryTest is Test {
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
    address public validatorAddr = makeAddr("validator");
    address public outsider = makeAddr("outsider");
    address public templateCreator = makeAddr("templateCreator");

    // Agent IDs
    uint256 public clientAgentId;
    uint256 public providerAgentId;

    // Constants
    uint256 public constant JOB_AMOUNT = 100e6;
    bytes32 public constant JOB_SPEC_HASH = keccak256("factory test job");
    string public constant JOB_SPEC_URI = "ipfs://QmFactoryJob";

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

        // Wire up: set factory as authorized caller on escrow
        vm.prank(owner);
        escrow.setAuthorizedCaller(address(factory), true);

        // Register agents
        vm.prank(client);
        clientAgentId = identity.register("ipfs://client-agent");

        vm.prank(provider);
        providerAgentId = identity.register("ipfs://provider-agent");

        // Fund client
        usdc.mint(client, 100_000e6);

        // Client approves escrow (not factory) for USDC spending
        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // =========================================================================
    // Helper Functions
    // =========================================================================

    /// @dev Create a default template as owner, return templateId
    function _createDefaultTemplate() internal returns (uint256 templateId) {
        vm.prank(owner);
        templateId = factory.createTemplate(
            "code-review",
            validatorAddr,
            7 days,
            250, // 2.5% fee
            70, // min validation
            50 // dispute split
        );
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsEscrow() public view {
        assertEq(address(factory.escrow()), address(escrow));
        assertEq(factory.owner(), owner);
        assertEq(factory.templateCount(), 0);
        assertFalse(factory.openTemplateCreation());
    }

    function test_Constructor_RevertIfZeroEscrow() public {
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.ZeroAddress.selector));
        new AegisJobFactory(address(0), owner);
    }

    // =========================================================================
    // Template Creation Tests
    // =========================================================================

    function test_CreateTemplate_OwnerOnly() public {
        uint256 templateId = _createDefaultTemplate();

        assertEq(templateId, 0);
        assertEq(factory.templateCount(), 1);

        AegisTypes.JobTemplate memory tpl = factory.getTemplate(templateId);
        assertEq(tpl.defaultValidator, validatorAddr);
        assertEq(tpl.defaultTimeout, 7 days);
        assertEq(tpl.feeBps, 250);
        assertEq(tpl.minValidation, 70);
        assertEq(tpl.defaultDisputeSplit, 50);
        assertTrue(tpl.active);
        assertEq(tpl.creator, owner);
    }

    function test_CreateTemplate_RevertIfNotOwnerAndClosed() public {
        // openTemplateCreation is false by default
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.NotAuthorized.selector, outsider));
        factory.createTemplate("test", validatorAddr, 7 days, 0, 70, 50);
    }

    function test_CreateTemplate_OpenCreation() public {
        // Enable open creation
        vm.prank(owner);
        factory.setOpenTemplateCreation(true);

        // Now anyone can create templates
        vm.prank(outsider);
        uint256 templateId = factory.createTemplate("community-template", validatorAddr, 7 days, 0, 70, 50);

        AegisTypes.JobTemplate memory tpl = factory.getTemplate(templateId);
        assertEq(tpl.creator, outsider);
    }

    function test_CreateTemplate_IncrementingIds() public {
        vm.startPrank(owner);
        uint256 id0 = factory.createTemplate("first", validatorAddr, 7 days, 0, 70, 50);
        uint256 id1 = factory.createTemplate("second", validatorAddr, 14 days, 100, 80, 60);
        uint256 id2 = factory.createTemplate("third", validatorAddr, 3 days, 200, 50, 40);
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(factory.templateCount(), 3);
    }

    function test_CreateTemplate_RevertIfInvalidValidator() public {
        vm.prank(owner);
        vm.expectRevert("Invalid validator");
        factory.createTemplate("test", address(0), 7 days, 0, 70, 50);
    }

    function test_CreateTemplate_RevertIfTimeoutTooShort() public {
        vm.prank(owner);
        vm.expectRevert("Timeout too short");
        factory.createTemplate("test", validatorAddr, 30 minutes, 0, 70, 50); // below 1 hour
    }

    function test_CreateTemplate_RevertIfInvalidThreshold() public {
        vm.prank(owner);
        vm.expectRevert("Invalid threshold");
        factory.createTemplate("test", validatorAddr, 7 days, 0, 101, 50);
    }

    function test_CreateTemplate_RevertIfInvalidSplit() public {
        vm.prank(owner);
        vm.expectRevert("Invalid split");
        factory.createTemplate("test", validatorAddr, 7 days, 0, 70, 101);
    }

    function test_CreateTemplate_RevertIfFeeTooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Fee too high");
        factory.createTemplate("test", validatorAddr, 7 days, 1001, 70, 50);
    }

    function test_CreateTemplate_BoundaryValues() public {
        // Min timeout (1 hour), max fee (1000 bps), max threshold (100), max split (100)
        vm.prank(owner);
        uint256 templateId = factory.createTemplate("boundary", validatorAddr, 1 hours, 1000, 100, 100);

        AegisTypes.JobTemplate memory tpl = factory.getTemplate(templateId);
        assertEq(tpl.defaultTimeout, 1 hours);
        assertEq(tpl.feeBps, 1000);
        assertEq(tpl.minValidation, 100);
        assertEq(tpl.defaultDisputeSplit, 100);
    }

    // =========================================================================
    // Job Creation From Template Tests
    // =========================================================================

    function test_CreateJobFromTemplate_Success() public {
        uint256 templateId = _createDefaultTemplate();

        uint256 clientBalBefore = usdc.balanceOf(client);

        // Client calls factory to create job from template
        vm.prank(client);
        bytes32 jobId = factory.createJobFromTemplate(
            templateId, clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, JOB_AMOUNT
        );

        // Verify job was created in escrow
        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(job.clientAgentId, clientAgentId);
        assertEq(job.providerAgentId, providerAgentId);
        assertEq(job.amount, JOB_AMOUNT);
        assertEq(job.validatorAddress, validatorAddr);
        assertEq(job.validationThreshold, 70);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.FUNDED));

        // Deadline should be now + template's defaultTimeout (7 days)
        assertEq(job.deadline, block.timestamp + 7 days);

        // USDC transferred from client (not factory) to escrow
        assertEq(usdc.balanceOf(client), clientBalBefore - JOB_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), JOB_AMOUNT);
    }

    function test_CreateJobFromTemplate_UsdcFlowsFromClient() public {
        uint256 templateId = _createDefaultTemplate();

        uint256 factoryBalBefore = usdc.balanceOf(address(factory));
        uint256 clientBalBefore = usdc.balanceOf(client);

        vm.prank(client);
        factory.createJobFromTemplate(
            templateId, clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, JOB_AMOUNT
        );

        // Factory balance should not change (USDC goes client → escrow)
        assertEq(usdc.balanceOf(address(factory)), factoryBalBefore);
        assertEq(usdc.balanceOf(client), clientBalBefore - JOB_AMOUNT);
    }

    function test_CreateJobFromTemplate_RevertIfTemplateNotFound() public {
        // For a non-existent template, `active` defaults to false,
        // so TemplateNotActive fires before TemplateNotFound
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.TemplateNotActive.selector, 999));
        factory.createJobFromTemplate(999, clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, JOB_AMOUNT);
    }

    function test_CreateJobFromTemplate_RevertIfTemplateDeactivated() public {
        uint256 templateId = _createDefaultTemplate();

        // Deactivate template
        vm.prank(owner);
        factory.deactivateTemplate(templateId);

        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.TemplateNotActive.selector, templateId));
        factory.createJobFromTemplate(
            templateId, clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, JOB_AMOUNT
        );
    }

    function test_CreateJobFromTemplate_AnyoneCanCallWhenFactoryAuthorized() public {
        // When the factory is an authorized caller on escrow, the escrow resolves
        // clientOwner from the identity registry and pulls USDC from them.
        // So even an outsider calling the factory will create a job for the agent owner,
        // as long as the agent owner has approved USDC to the escrow.
        uint256 templateId = _createDefaultTemplate();

        uint256 clientBalBefore = usdc.balanceOf(client);

        vm.prank(outsider); // outsider calls, but USDC comes from client (agent owner)
        bytes32 jobId = factory.createJobFromTemplate(
            templateId, clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, JOB_AMOUNT
        );

        // Job is created and USDC came from the actual agent owner (client)
        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(job.clientAddress, client); // client is the actual client, not outsider
        assertEq(usdc.balanceOf(client), clientBalBefore - JOB_AMOUNT);
    }

    function test_CreateJobFromTemplate_RevertIfNotAuthorizedFactory() public {
        // Remove factory authorization
        vm.prank(owner);
        escrow.setAuthorizedCaller(address(factory), false);

        uint256 templateId = _createDefaultTemplate();

        // Factory is no longer authorized, so escrow will reject
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.NotAgentOwner.selector, clientAgentId, address(factory)));
        factory.createJobFromTemplate(
            templateId, clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, JOB_AMOUNT
        );
    }

    function test_CreateJobFromTemplate_MultipleJobs() public {
        uint256 templateId = _createDefaultTemplate();

        vm.prank(client);
        bytes32 jobId1 = factory.createJobFromTemplate(
            templateId, clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, JOB_AMOUNT
        );

        vm.prank(client);
        bytes32 jobId2 = factory.createJobFromTemplate(
            templateId, clientAgentId, providerAgentId, keccak256("second job"), "ipfs://second-job", 200e6
        );

        assertTrue(jobId1 != jobId2, "Job IDs should be unique");
        assertEq(escrow.getJob(jobId1).amount, JOB_AMOUNT);
        assertEq(escrow.getJob(jobId2).amount, 200e6);
    }

    // =========================================================================
    // Template Deactivation Tests
    // =========================================================================

    function test_DeactivateTemplate_ByOwner() public {
        uint256 templateId = _createDefaultTemplate();

        vm.prank(owner);
        factory.deactivateTemplate(templateId);

        assertFalse(factory.isTemplateActive(templateId));
    }

    function test_DeactivateTemplate_ByCreator() public {
        // Enable open creation so someone else creates a template
        vm.prank(owner);
        factory.setOpenTemplateCreation(true);

        vm.prank(templateCreator);
        uint256 templateId = factory.createTemplate("creator-template", validatorAddr, 7 days, 0, 70, 50);

        // Creator can deactivate their own template
        vm.prank(templateCreator);
        factory.deactivateTemplate(templateId);

        assertFalse(factory.isTemplateActive(templateId));
    }

    function test_DeactivateTemplate_RevertIfNotAuthorized() public {
        uint256 templateId = _createDefaultTemplate();

        vm.prank(outsider);
        vm.expectRevert("Not authorized");
        factory.deactivateTemplate(templateId);
    }

    function test_DeactivateTemplate_RevertIfNotFound() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.TemplateNotFound.selector, 999));
        factory.deactivateTemplate(999);
    }

    // =========================================================================
    // Template Update Tests
    // =========================================================================

    function test_UpdateTemplateValidator_ByOwner() public {
        uint256 templateId = _createDefaultTemplate();

        address newValidator = makeAddr("newValidator");
        vm.prank(owner);
        factory.updateTemplateValidator(templateId, newValidator);

        AegisTypes.JobTemplate memory tpl = factory.getTemplate(templateId);
        assertEq(tpl.defaultValidator, newValidator);
    }

    function test_UpdateTemplateValidator_ByCreator() public {
        vm.prank(owner);
        factory.setOpenTemplateCreation(true);

        vm.prank(templateCreator);
        uint256 templateId = factory.createTemplate("updatable", validatorAddr, 7 days, 0, 70, 50);

        address newValidator = makeAddr("newValidator");
        vm.prank(templateCreator);
        factory.updateTemplateValidator(templateId, newValidator);

        assertEq(factory.getTemplate(templateId).defaultValidator, newValidator);
    }

    function test_UpdateTemplateValidator_RevertIfNotAuthorized() public {
        uint256 templateId = _createDefaultTemplate();

        vm.prank(outsider);
        vm.expectRevert("Not authorized");
        factory.updateTemplateValidator(templateId, makeAddr("newVal"));
    }

    function test_UpdateTemplateValidator_RevertIfZeroAddress() public {
        uint256 templateId = _createDefaultTemplate();

        vm.prank(owner);
        vm.expectRevert("Invalid validator");
        factory.updateTemplateValidator(templateId, address(0));
    }

    function test_UpdateTemplateValidator_RevertIfNotFound() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.TemplateNotFound.selector, 999));
        factory.updateTemplateValidator(999, makeAddr("newVal"));
    }

    // =========================================================================
    // View Function Tests
    // =========================================================================

    function test_GetTemplate_RevertIfNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(AegisTypes.TemplateNotFound.selector, 0));
        factory.getTemplate(0);
    }

    function test_IsTemplateActive_ReturnsFalseForNonexistent() public view {
        // Default mapping value is false for non-existent template
        assertFalse(factory.isTemplateActive(999));
    }

    // =========================================================================
    // Admin Tests
    // =========================================================================

    function test_SetOpenTemplateCreation() public {
        assertFalse(factory.openTemplateCreation());

        vm.prank(owner);
        factory.setOpenTemplateCreation(true);

        assertTrue(factory.openTemplateCreation());
    }

    function test_SetOpenTemplateCreation_RevertIfNotOwner() public {
        vm.prank(outsider);
        vm.expectRevert();
        factory.setOpenTemplateCreation(true);
    }

    // =========================================================================
    // Integration Tests
    // =========================================================================

    function test_FullFlow_TemplateToSettledJob() public {
        // 1. Create template
        uint256 templateId = _createDefaultTemplate();

        // 2. Create job from template
        vm.prank(client);
        bytes32 jobId = factory.createJobFromTemplate(
            templateId, clientAgentId, providerAgentId, JOB_SPEC_HASH, JOB_SPEC_URI, JOB_AMOUNT
        );

        // 3. Provider delivers
        vm.prank(provider);
        escrow.submitDeliverable(jobId, "ipfs://deliverable", keccak256("deliverable"));

        // 4. Validator gives passing score
        bytes32 requestHash = escrow.getJob(jobId).validationRequestHash;
        validation.submitResponse(requestHash, 85);

        // 5. Process validation → auto-settle
        escrow.processValidation(jobId);

        // 6. Verify settled
        AegisTypes.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AegisTypes.JobState.SETTLED));

        // 7. Verify funds distributed
        uint256 fee = (JOB_AMOUNT * 250) / 10_000;
        uint256 providerAmount = JOB_AMOUNT - fee;
        assertEq(usdc.balanceOf(provider), providerAmount);
        assertEq(usdc.balanceOf(address(treasury)), fee);
    }
}
