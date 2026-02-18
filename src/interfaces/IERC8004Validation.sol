// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004Validation
/// @notice Interface for the ERC-8004 Validation Registry
/// @dev Derived from EIP-8004 specification. Enables agents to request work verification
///      from validator smart contracts (stake-secured re-execution, zkML, TEE oracles).
///      Response encoding: uint8 (0-100). 0 = failed, 100 = passed.
///      Multiple responses per requestHash allowed (soft/hard finality via tag).
interface IERC8004Validation {
    // =========================================================================
    // Events
    // =========================================================================

    event ValidationRequest(
        address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash
    );

    event ValidationResponse(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8 response,
        string responseURI,
        bytes32 responseHash,
        string tag
    );

    // =========================================================================
    // Write Functions
    // =========================================================================

    /// @notice Submit a validation request for an agent's work
    /// @param validatorAddress Address of the validator contract to handle this request
    /// @param agentId The agent whose work is being validated
    /// @param requestURI URI containing the validation request details (job spec + deliverable)
    /// @param requestHash KECCAK-256 commitment of the request content
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    )
        external;

    /// @notice Submit a validation response (called by validator contracts)
    /// @param requestHash The request being responded to
    /// @param response Validation score 0-100 (0=failed, 100=passed)
    /// @param responseURI URI containing detailed validation report
    /// @param responseHash KECCAK-256 of responseURI content
    /// @param tag Category tag (e.g., "softFinality", "hardFinality", "quality", "correctness")
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    )
        external;

    // =========================================================================
    // Read Functions
    // =========================================================================

    /// @notice Get the current validation status for a request
    /// @return validatorAddress The validator that handled/is handling the request
    /// @return agentId The agent being validated
    /// @return response Latest response score (0-100)
    /// @return responseHash Hash of the latest response content
    /// @return tag Tag of the latest response
    /// @return lastUpdate Timestamp of the last update
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
        );

    /// @notice Get aggregated validation summary for an agent
    /// @param agentId The agent to query
    /// @param validatorAddresses Array of trusted validators to filter by
    /// @param tag Filter by tag (empty = no filter)
    /// @return count Number of matching validations
    /// @return averageResponse Average response score (0-100)
    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    )
        external
        view
        returns (uint64 count, uint8 averageResponse);

    /// @notice Get all validation request hashes for an agent
    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory requestHashes);

    /// @notice Get all request hashes assigned to a validator
    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory requestHashes);
}
