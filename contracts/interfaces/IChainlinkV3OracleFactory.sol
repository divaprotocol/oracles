// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IChainlinkV3OracleFactory {

    /**
     * @dev Deploys a DIVA specific Chainlink specific contract
     * @param _chainlinkPriceFeed Chainlink price feed address
     */
    function createChainlinkV3Oracle(address _chainlinkPriceFeed) external;

    /**
     * @dev Returns the full array of deployed Chainlink oracles. 
     * If array becomes too large, use {getChainlinkV3OraclesLength} and
     * {getChainlinkV3OraclesByIndex} functions or leverage indexed data in
     * TheGraph to retrieve the available oracle addresses
     */
    function getChainlinkV3Oracles() external view returns (address[] memory);

    /**
     * @dev Returns the Chainlink oracle address stored at array index `_index` 
     */
    function getChainlinkV3OraclesByIndex(uint256 _index) external view returns (address);

    /**
     * @dev Returns the length of the oracles array 
     */
    function getChainlinkV3OraclesLength() external view returns (uint256);

    /**
     * @notice Emitted when a new DIVA specific Chainlink oracle contract is deployed.
     * @param oracleAddress Address of the DIVA specific Chainlink oracle contract.
     * @param chainlinkPriceFeed Chainlink price feed address.
     * @param creator Address of the msg.sender.      
     */
    event OracleCreated(address indexed oracleAddress, address indexed chainlinkPriceFeed, address indexed creator);

}