// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAGoplugin {
    // Thrown in `setFinalReferenceValue` if there is no data reported after
    // the expiry time of the underlying pool.
    error NoOracleSubmissionAfterExpiryTime();

    // Thrown in `setFinalReferenceValue` if user tries to call the function
    // before the minimum period undisputed period has passed.
    error MinPeriodUndisputedNotPassed();

    // Thrown in constructor if zero address is provided as ownershipContract.
    error ZeroOwnershipContractAddress();

    // Thrown in constructor if zero address is provided as PLI token address.
    error ZeroPLIAddress();

    // Thrown `onlyOwner` modifier if `msg.sender` is not contract owner.
    error NotContractOwner(address _user, address _contractOwner);

    /**
     * @notice Emitted when the final reference value is set.
     * @param poolId The Id of an existing derivatives pool.
     * @param finalValue Tellor value (converted into 18 decimals).
     * @param expiryTime Unix timestamp in seconds of pool expiry date.
     * @param timestamp Tellor value timestamp.
     */
    event FinalReferenceValueSet(
        uint256 indexed poolId,
        uint256 finalValue,
        uint256 expiryTime,
        uint256 timestamp
    );

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
     * @dev Returns the minimum period (in seconds) a reported value has
     * to remain undisputed in order to be considered valid.
     */
    function getMinPeriodUndisputed() external pure returns (uint32);

    /**
     * @dev Returns the list of requester addresses that are entitled to receive
     * the fees/tips for the provided poolIds. Note that it returns
     * the zero address if a value has been reported to the Tellor contract
     * but it hasn't been pulled into DIVA Protocol by calling
     * `setFinalReferenceValue` yet.
     * @param _poolIds Array of poolIds.
     */
    function getRequesters(uint256[] calldata _poolIds)
        external
        view
        returns (address[] memory);

    /**
     * @dev Returns the DIVA protocol contract address that the oracle is linked to.
     */
    function getDIVAAddress() external view returns (address);

    /**
     * @dev Returns the DIVA ownership contract address.
     */
    function getOwnershipContract() external view returns (address);
}
