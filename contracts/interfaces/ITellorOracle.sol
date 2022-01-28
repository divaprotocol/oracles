// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface ITellorOracle {
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
     * @dev Function to transfer existing fee claims from the original 
     * settlement fee recipient (this contract) to a new settlement fee 
     * recipient `_settlementFeeRecipient`. 
     * @param _divaDiamond Address of the diva smart contract that stores
     * the fee claims.
     * @param _collateralToken Collateral token in which fees are denominated.
     */
    function transferFeeClaim(address _divaDiamond, address _collateralToken) 
        external;

    /**
     * @dev Function to get the current fee claim balance for `msg.sender` 
     * (i.e. this contract) stored in the diva smart contract. 
     * @param _divaDiamond Address of the diva smart contract that stores
     * the fee claims.
     * @param _collateralToken Collateral token in which fees were paid.
     */
    function getClaims(address _divaDiamond, address _collateralToken) external returns (uint256);

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
}
