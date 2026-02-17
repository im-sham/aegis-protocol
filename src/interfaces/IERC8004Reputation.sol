// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004Reputation
/// @notice Interface for the ERC-8004 Reputation Registry
/// @dev Derived from EIP-8004 specification. Stores feedback from clients about agents.
///      Feedback is stored per (agentId, clientAddress) pair with incrementing feedbackIndex.
///      CRITICAL: getSummary() requires clientAddresses array to prevent Sybil attacks.
interface IERC8004Reputation {
    // =========================================================================
    // Events
    // =========================================================================

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex);

    event ResponseAppended(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        address indexed responder,
        string responseURI,
        bytes32 responseHash
    );

    // =========================================================================
    // Write Functions
    // =========================================================================

    /// @notice Submit feedback for an agent
    /// @param agentId The target agent's ID in the Identity Registry
    /// @param value Signed fixed-point feedback value (e.g., 85 for 85/100 quality)
    /// @param valueDecimals Decimal places for the value (0-18)
    /// @param tag1 Primary categorization tag (e.g., "starred", "responseTime", "jobCompletion")
    /// @param tag2 Secondary tag (e.g., "code-review", "data-analysis")
    /// @param endpoint The service endpoint being reviewed
    /// @param feedbackURI URI to off-chain detailed feedback (IPFS recommended)
    /// @param feedbackHash KECCAK-256 of feedbackURI content (not required for IPFS)
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    )
        external;

    /// @notice Revoke previously submitted feedback
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    /// @notice Append a response to existing feedback (agent can respond to reviews)
    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    )
        external;

    // =========================================================================
    // Read Functions
    // =========================================================================

    /// @notice Get aggregated summary of feedback for an agent
    /// @dev REQUIRES non-empty clientAddresses to prevent Sybil attacks
    /// @param agentId The agent to query
    /// @param clientAddresses Array of trusted reviewer addresses to filter by
    /// @param tag1 Filter by primary tag (empty string = no filter)
    /// @param tag2 Filter by secondary tag (empty string = no filter)
    /// @return count Number of matching feedback entries
    /// @return summaryValue Aggregated feedback value
    /// @return summaryValueDecimals Decimal places for summaryValue
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    )
        external
        view
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);

    /// @notice Read a specific feedback entry
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    )
        external
        view
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked);

    /// @notice Get all clients who have submitted feedback for an agent
    function getClients(uint256 agentId) external view returns (address[] memory);

    /// @notice Get the last feedback index for a specific client-agent pair
    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64);
}
