// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IDIVAOracleTellor {
    /**
     * @notice Emitted when the final reference value is set.
     * @param poolId The Id of an existing derivatives pool
     * @param finalValue Tellor value (converted into 18 decimals)
     * @param expiryDate Unix timestamp in seconds of pool expiry date
     * @param timestamp Tellor value timestamp
     */
    event FinalReferenceValueSet(
        uint256 indexed poolId,
        uint256 finalValue,
        uint256 expiryDate,
        uint256 timestamp
    );

    /**
     * @dev Function to set the final reference value for a given `poolId`.
     * @param _divaDiamond Address of the diva smart contract. This is to avoid
     * redeploying the oracle contracts when a new version of diva protocol
     * is released.
     * @param _poolId The unique identifier of the pool.
     */
    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId)
        external;

    /**
     * @dev Function to update `minPeriodUndisputed` with minimum value of  
     * 1 hour (3600 seconds) and maximum value of 18 hours (64800 seconds).
     * @param _newMinPeriodUndisputed New `minPeriodUndisputed` in seconds.
     */
    function setMinPeriodUndisputed(uint32 _newMinPeriodUndisputed) external;

    /**
     * @dev Returns whether the oracle's data feed is challengeable or not.
     * Will return false in that implementation.
     */
    function challengeable() external view returns (bool);

    /**
     * @dev Returns Tellor's oracle address
     */
    function getTellorAddress() external view returns (address);

    /**
     * @dev Returns the settlement fee recipient
     */
    function getSettlementFeeRecipient() external view returns (address);

    /**
     * @dev Returns the minimum period (in seconds) a value has to remain 
     * undisputed in order to be considered valid 
     */
    function getMinPeriodUndisputed() external view returns (uint32);
}
