// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IChainlinkV3OracleFactory {
    /**
     * @dev Deploys a DIVA specific Chainlink specific contract
     * @param _chainlinkPriceFeed Chainlink price feed address
     * @param _assetName Name of the asset. Does not need to be equal to Chainlink name
     */
    function createChainlinkV3Oracle(
        address _chainlinkPriceFeed,
        string memory _assetName
    ) external;

    /**
     * @dev Returns the full array of deployed Chainlink oracles.
     * If array becomes too large, use a combination of {getChainlinkV3OraclesLength} and
     * {getChainlinkV3OraclesByIndex} functions or indexed data in
     * TheGraph to retrieve available oracle addresses
     */
    function getChainlinkV3Oracles() external view returns (address[] memory);

    /**
     * @dev Returns the Chainlink oracle address stored at array index `_index`
     */
    function getChainlinkV3OraclesByIndex(uint256 _index)
        external
        view
        returns (address);

    /**
     * @dev Returns the length of the oracles array
     */
    function getChainlinkV3OraclesLength() external view returns (uint256);

    /**
     * @dev Returns whether an address is part of the oracles array. Useful for
     * validation before selecting an oracle as the data feed provider in DIVA.
     */
    function exists(address _oracle) external view returns (bool);

    /**
     * @notice Emitted when a new DIVA specific Chainlink oracle contract is deployed.
     * @param oracleAddress Address of the DIVA specific Chainlink oracle contract.
     * @param chainlinkPriceFeed Chainlink price feed address.
     * @param creator Address of the msg.sender.
     */
    event OracleCreated(
        address indexed oracleAddress,
        address indexed chainlinkPriceFeed,
        address indexed creator
    );
}
