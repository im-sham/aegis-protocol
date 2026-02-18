// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004Identity
/// @notice Interface for the ERC-8004 Identity Registry (based on ERC-721 + URIStorage)
/// @dev Derived from EIP-8004 specification. Each agent = NFT with globally unique ID.
///      agentRegistry format: {namespace}:{chainId}:{identityRegistry}
///      agentId: ERC-721 tokenId (assigned incrementally)
interface IERC8004Identity {
    // =========================================================================
    // Events
    // =========================================================================

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);

    event MetadataSet(
        uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue
    );

    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    // =========================================================================
    // Registration
    // =========================================================================

    /// @notice Register a new agent with a URI and optional metadata
    /// @param agentURI URI resolving to the agent registration file (JSON)
    /// @param metadata Array of key-value metadata entries
    /// @return agentId The newly assigned agent ID (ERC-721 tokenId)
    function register(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);

    /// @notice Register a new agent with a URI only
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice Register a new agent with no URI (can be set later)
    function register() external returns (uint256 agentId);

    // =========================================================================
    // Metadata
    // =========================================================================

    /// @notice Get metadata value for a given agent and key
    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory);

    /// @notice Set metadata for an agent (caller must be owner)
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external;

    // =========================================================================
    // Agent Wallet (reserved metadata key)
    // =========================================================================

    /// @notice Set the agent's wallet address (requires EIP-712 or ERC-1271 signature)
    /// @dev The agentWallet is a reserved metadata key that cannot be set via setMetadata()
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;

    /// @notice Get the agent's designated wallet address
    function getAgentWallet(uint256 agentId) external view returns (address);

    /// @notice Remove the agent's wallet association
    function unsetAgentWallet(uint256 agentId) external;

    // =========================================================================
    // URI Management
    // =========================================================================

    /// @notice Update the agent's URI
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    // =========================================================================
    // ERC-721 Standard (subset we need)
    // =========================================================================

    /// @notice Returns the owner of the agent NFT
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Returns the token URI
    function tokenURI(uint256 tokenId) external view returns (string memory);

    // =========================================================================
    // Structs
    // =========================================================================

    struct MetadataEntry {
        string key;
        bytes value;
    }
}
