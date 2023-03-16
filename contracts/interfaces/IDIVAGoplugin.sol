// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAGoplugin {
    // Thrown in `setFinalReferenceValue` if user tries to call the function
    // before request final reference value.
    error FinalReferenceValueNotRequested();

    error NotInValidPeriod();

    // Thrown in constructor if zero address is provided as DIVA protocol address.
    error ZeroDIVAAddress();

    // Thrown `onlyOwner` modifier if `msg.sender` is not contract owner.
    error NotContractOwner(address _user, address _contractOwner);

    error AlreadyConfirmedPool();

    /**
     * @notice Emitted when the final reference value is requested.
     * @param poolId The Id of an existing derivatives pool.
     * @param requestedTimestamp Current blocktimestamp.
     */
    event FinalReferenceValueRequested(
        uint256 indexed poolId,
        uint256 requestedTimestamp
    );

    /**
     * @notice Emitted when the final reference value is set.
     * @param poolId The Id of an existing derivatives pool.
     * @param finalValue Tellor value (converted into 18 decimals).
     * @param expiryTime Unix timestamp in seconds of pool expiry date.
     */
    event FinalReferenceValueSet(
        uint256 indexed poolId,
        uint256 finalValue,
        uint256 expiryTime
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
    function getGopluginValue(uint256 _poolId) external view returns (uint256);

    /**
     * @dev Returns the last requested blocktimestamp.
     * @param _poolId The unique identifier of the pool.
     */
    function getLastRequestedBlocktimestamp(
        uint256 _poolId
    ) external view returns (uint256);

    function getRequestId(uint256 _poolId) external view returns (bytes32);

    /**
     * @dev Returns the DIVA protocol contract address that the oracle is linked to.
     */
    function getDIVAAddress() external view returns (address);
}
