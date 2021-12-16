// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IChainlinkV3Oracle {

    /**
     * @dev Function to set the final reference value for a given `poolId`. 
     * Internally, the submitted value is converted to 18 decimals, passed on 
     * to the diva smart contract and subject to the revert logic defined therein, e.g., 
     * will throw when triggered before expiration, when final value is already confirmed
     * or when msg.sender is not the data feed provider of the pool. 
     * Function will also throw if the time interval implied by the Chainlink roundId 
     * does not include the expiry date of the pool. Use {getLatestPrice} function or 
     * Chainlink's graph to query the roundId that includes the expiry time.
     * Function can be triggered by anyone following expiration of the pool. 
     * Price feed cannot be challenged, i.e. is immediately confirmed by the diva 
     * smart contract on submission. 
     * Negative price feeds are not possible. Price feeds that have more than 18 
     * decimals are not accepted.
     * @param _divaDiamond Address of the diva smart contract. This is to avoid
     * redeploying the oracle contracts when a new version of diva protocol is available.
     * @param _roundId Chainlink's round number that includes the expiry date. 
     * @param _poolId The unique identifier of the pool.
     */
    function setFinalReferenceValue(address _divaDiamond, uint80 _roundId, uint256 _poolId) external;

    /**
     * @dev Returns whether the oracle's data feed is challengeable or not. 
     * Will return false in that implementation.
     */
    function challengeable() external view returns (bool);

    /**
     * @dev Returns Chainlink's AggregatorV3 interface  
     */
    function priceFeed() external view returns (AggregatorV3Interface);

    /**
     * @dev Returns the historical price for a given `roundId` and related Chainlink specific parameters
     * @param _roundId Chainlink's round number that includes the expiry date
     * @return roundId, price, startedAt, timeStamp, answeredInRound, decimals
     */
    function getHistoricalPrice(uint80 _roundId) external view returns (uint80, int256, uint256, uint256, uint80, uint8);

    /**
     * @dev Returns the latest price and related Chainlink specific parameters
     * @return roundId, price, startedAt, timeStamp, answeredInRound
     */
    function getLatestPrice() external view returns (uint80, int256, uint256, uint256, uint80);

    /**
     * @dev Returns the asset name assigned to the respective oracle contract. Note that the 
     * initially assigned value cannot be changed once the contract is deployed
     */
    function getAsset() external view returns (string memory);

    /**
     * @notice Emitted when the final reference value is set.
     * @param poolId The Id of an existing derivatives contract
     * @param decimalAdjustedHistoricalPrice Chainlink price converted into 18 decimals
     * @param expiryDate Unix timestamp in seconds of pool expiry date      
     * @param roundId Chainlink's round number that includes the expiry date                                                    
     */
    event FinalReferenceValueSet(uint256 indexed poolId, uint256 decimalAdjustedHistoricalPrice, uint256 indexed expiryDate, uint256 indexed roundId);

}