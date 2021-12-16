// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IChainlinkV3OracleFactory {
    
    /**
     * @notice Emitted when a new DIVA specific Chainlink oracle contract is deployed.
     * @param oracleAddress Address of the DIVA specific Chainlink oracle contract.
     * @param chainlinkPriceFeed Chainlink price feed address.
     * @param creator Address of the msg.sender.      
     */
    event OracleCreated(address indexed oracleAddress, address indexed chainlinkPriceFeed, address indexed creator);
}