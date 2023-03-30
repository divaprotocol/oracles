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

    // Thrown in `requestFinalReferenceValue` if user tries to call the
    // function before pool is expired.
    error PoolNotExpired();

    // Thrown in `requestFinalReferenceValue` if the final reference value was
    // already requested for the given pool id.
    error FinalReferenceValueAlreadyRequested();

    /**
     * @notice Emitted when the final reference value is requested.
     * @param poolId The unique identifier of the pool.
     * @param requestedTimestamp Timestamp of request.
     * @param requestId Request Id.
     */
    event FinalReferenceValueRequested(
        uint256 indexed poolId,
        uint256 requestedTimestamp,
        bytes32 requestId
    );

    /**
     * @notice Function to initiate a request to submit the data point
     * for a given `_poolId`.
     * @param _poolId The unique identifier of the pool.
     */
    function requestFinalReferenceValue(
        uint256 _poolId
    ) external returns (bytes32);

    /**
     * @notice Function to submit the provided data point to DIVA Protocol.
     * @param _poolId The unique identifier of the pool.
     */
    function setFinalReferenceValue(uint256 _poolId) external;

    /**
     * @notice Returns whether the oracle's data feed is challengeable or not.
     * Will return `false` in that implementation.
     */
    function getChallengeable() external view returns (bool);

    /**
     * @notice Returns the value from Goplugin Feed with 18 decimals.
     * @dev Returns 0 if no data has been reported yet.
     * @param _poolId The unique identifier of the pool.
     */
    function getGoPluginValue(uint256 _poolId) external view returns (uint256);

    /**
     * @notice Returns the timestamp of the data request for a given `_poolId`.
     * @param _poolId The unique identifier of the pool.
     */
    function getLastRequestedTimestamp(
        uint256 _poolId
    ) external view returns (uint256);

    function getRequestId(uint256 _poolId) external view returns (bytes32);

    /**
     * @notice Returns the DIVA protocol contract address that the oracle is linked to.
     */
    function getDIVAAddress() external view returns (address);

    /**
     * @notice Returns the PLI token contract address.
     */
    function getPLIAddress() external view returns (address);

    /**
     * @notice Returns the minimum PLI deposit amount (1 PLI = 1e18 in integer terms).
     */
    function getMinDepositAmount() external pure returns (uint256);
}
