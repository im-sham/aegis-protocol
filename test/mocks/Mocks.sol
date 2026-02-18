// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC8004Identity} from "../../src/interfaces/IERC8004Identity.sol";
import {IERC8004Reputation} from "../../src/interfaces/IERC8004Reputation.sol";
import {IERC8004Validation} from "../../src/interfaces/IERC8004Validation.sol";

/// @dev Mock Identity Registry for testing. Simulates ERC-8004 Identity with
///      in-memory agent registration, wallet assignment, and ownership tracking.
contract MockIdentityRegistry {
    uint256 public nextAgentId = 1;
    mapping(uint256 => address) public owners;
    mapping(uint256 => address) public agentWallets;
    mapping(uint256 => string) public agentURIs;

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        owners[agentId] = msg.sender;
        agentWallets[agentId] = msg.sender; // default wallet = owner
        agentURIs[agentId] = agentURI;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        require(owners[tokenId] != address(0), "Agent not registered");
        return owners[tokenId];
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return agentWallets[agentId];
    }

    function setAgentWallet(uint256 agentId, address wallet) external {
        require(owners[agentId] == msg.sender, "Not owner");
        agentWallets[agentId] = wallet;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return agentURIs[tokenId];
    }

    // Test helper: register agent for a specific address
    function registerFor(address owner, string calldata agentURI) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        owners[agentId] = owner;
        agentWallets[agentId] = owner;
        agentURIs[agentId] = agentURI;
    }

    // Test helper: set wallet for an agent without ownership check
    function setAgentWalletUnchecked(uint256 agentId, address wallet) external {
        agentWallets[agentId] = wallet;
    }
}

/// @dev Mock Reputation Registry for testing
contract MockReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    // agentId → clientAddress → feedbackIndex → Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) public feedbacks;
    mapping(uint256 => mapping(address => uint64)) public lastIndexes;
    mapping(uint256 => address[]) public clients;

    uint256 public feedbackCount;

    event FeedbackGiven(uint256 agentId, address client, int128 value, string tag1, string tag2);

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata, // endpoint
        string calldata, // feedbackURI
        bytes32 // feedbackHash
    )
        external
    {
        uint64 index = lastIndexes[agentId][msg.sender];

        feedbacks[agentId][msg.sender][index] =
            Feedback({value: value, valueDecimals: valueDecimals, tag1: tag1, tag2: tag2, isRevoked: false});

        if (index == 0) {
            clients[agentId].push(msg.sender);
        }

        lastIndexes[agentId][msg.sender] = index + 1;
        feedbackCount++;

        emit FeedbackGiven(agentId, msg.sender, value, tag1, tag2);
    }

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata, // tag1
        string calldata // tag2
    )
        external
        view
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
    {
        int256 total = 0;
        uint64 n = 0;

        for (uint256 i = 0; i < clientAddresses.length; i++) {
            uint64 maxIdx = lastIndexes[agentId][clientAddresses[i]];
            for (uint64 j = 0; j < maxIdx; j++) {
                Feedback memory fb = feedbacks[agentId][clientAddresses[i]][j];
                if (!fb.isRevoked) {
                    total += int256(fb.value);
                    n++;
                }
            }
        }

        return (n, n > 0 ? int128(total / int256(uint256(n))) : int128(0), 0);
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return clients[agentId];
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return lastIndexes[agentId][clientAddress];
    }

    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    )
        external
        view
        returns (int128, uint8, string memory, string memory, bool)
    {
        Feedback memory fb = feedbacks[agentId][clientAddress][feedbackIndex];
        return (fb.value, fb.valueDecimals, fb.tag1, fb.tag2, fb.isRevoked);
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        feedbacks[agentId][msg.sender][feedbackIndex].isRevoked = true;
    }

    function appendResponse(uint256, address, uint64, string calldata, bytes32) external pure {}
}

/// @dev Mock Validation Registry for testing
contract MockValidationRegistry {
    struct ValidationStatus {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
    }

    mapping(bytes32 => ValidationStatus) public statuses;
    mapping(uint256 => bytes32[]) public agentValidations;
    mapping(address => bytes32[]) public validatorRequests;

    event ValidationRequestEmitted(
        address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash
    );

    event ValidationResponseEmitted(
        address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response
    );

    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    )
        external
    {
        statuses[requestHash] = ValidationStatus({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            responseHash: bytes32(0),
            tag: "",
            lastUpdate: 0 // Not yet responded
        });

        agentValidations[agentId].push(requestHash);
        validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequestEmitted(validatorAddress, agentId, requestURI, requestHash);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata, // responseURI
        bytes32 responseHash,
        string calldata tag
    )
        external
    {
        ValidationStatus storage status = statuses[requestHash];
        require(status.validatorAddress != address(0), "Request not found");

        status.response = response;
        status.responseHash = responseHash;
        status.tag = tag;
        status.lastUpdate = block.timestamp;

        emit ValidationResponseEmitted(status.validatorAddress, status.agentId, requestHash, response);
    }

    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
            uint256 lastUpdate
        )
    {
        ValidationStatus memory s = statuses[requestHash];
        return (s.validatorAddress, s.agentId, s.response, s.responseHash, s.tag, s.lastUpdate);
    }

    // Test helper: submit a validation response directly
    function submitResponse(bytes32 requestHash, uint8 score) external {
        ValidationStatus storage status = statuses[requestHash];
        status.response = score;
        status.lastUpdate = block.timestamp;
    }

    function getSummary(
        uint256,
        address[] calldata,
        string calldata
    )
        external
        pure
        returns (uint64 count, uint8 averageResponse)
    {
        return (0, 0);
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return agentValidations[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory) {
        return validatorRequests[validatorAddress];
    }
}

/// @dev Simple mock ERC-20 for USDC
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
