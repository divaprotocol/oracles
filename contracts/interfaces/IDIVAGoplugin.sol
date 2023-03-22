// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAGoplugin {
    // Thrown in `setFinalReferenceValue` if user tries to call the function
    // but the data was not requested via `requestFinalReferenceValue` yet.
    error FinalReferenceValueNotRequested();

    // Thrown in `setFinalReferenceValue` if no data has been submitted for the
    // `requestId` yet.
    error FinalReferenceValueNotReported();

    // Thrown in constructor if the DIVA protocol address equals the
    // zero address.
    error ZeroDIVAAddress();

    // Thrown in constructor if the PLI token address equals the zero address.
    error ZeroPLIAddress();

    // Thrown `onlyOwner` modifier if `msg.sender` is not contract owner.
    error NotContractOwner(address _user, address _contractOwner);

    // Thrown in `requestFinalReferenceValue` if user tries to call the
    // function before pool expiry time.
    error PoolNotExpired();

    // Thrown in `requestFinalReferenceValue` if the final reference value was
    // already requested for the given pool id.
    error FinalReferenceValueAlreadyRequested();

    /**
     * @notice Emitted when the final reference value is requested.
     * @param poolId The Id of an existing derivatives pool.
     * @param requestedTimestamp Current timestamp.
     * @param requestId Request Id.
     */
    event FinalReferenceValueRequested(
        uint256 indexed poolId,
        uint256 requestedTimestamp,
        bytes32 requestId
    );

    /**
     * @dev Function to request final reference value to Goplugin Feed
     * for a given `_poolId`.
     * @param _poolId The unique identifier of the pool.
     */
    function requestFinalReferenceValue(
        uint256 _poolId
    ) external returns (bytes32);

    /**
     * @dev Function to set the final reference value for a given `_poolId`.
     * @param _poolId The unique identifier of the pool.
     */
    function setFinalReferenceValue(uint256 _poolId) external;

    /**
     * @dev Returns whether the oracle's data feed is challengeable or not.
     * Will return false in that implementation.
     */
    function getChallengeable() external view returns (bool);

    /**
     * @dev Returns the value from Goplugin Feed with 18 decimals.
     * @param _poolId The unique identifier of the pool.
     */
    function getGoPluginValue(uint256 _poolId) external view returns (uint256);

    /**
     * @dev Returns the last requested timestamp.
     * @param _poolId The unique identifier of the pool.
     */
    function getLastRequestedTimestamp(
        uint256 _poolId
    ) external view returns (uint256);

    function getRequestId(uint256 _poolId) external view returns (bytes32);

    /**
     * @dev Returns the DIVA protocol contract address that the oracle is linked to.
     */
    function getDIVAAddress() external view returns (address);

    function getPLIAddress() external view returns (address);

    function getMinDepositAmount() external pure returns (uint256);
}
