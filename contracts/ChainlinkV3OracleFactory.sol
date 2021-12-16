// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./interfaces/IChainlinkV3OracleFactory.sol";
import "./ChainlinkV3Oracle.sol";

// QUESTION: Add Ownable library?
// TODO: Explore CloneFactory: https://soliditydeveloper.com/clonefactory
/**
 * @notice Main contract to create DIVA specific Chainlink v3 oracles.
 * @dev Implementation of the {IChainlinkV3OracleFactory} interface.
 */
contract ChainlinkV3OracleFactory is IChainlinkV3OracleFactory {

    address[] private _chainlinkV3Oracles;
    	
    // TODO: Use ENS name instead of address
    function createChainlinkV3Oracle(address _chainlinkPriceFeed) public returns (ChainlinkV3Oracle chainlinkV3Oracle) {
        
        ChainlinkV3Oracle chainlinkV3Oracle = new ChainlinkV3Oracle(_chainlinkPriceFeed);
        _chainlinkV3Oracles.push(address(chainlinkV3Oracle));

        emit OracleCreated(address(chainlinkV3Oracle), _chainlinkPriceFeed, msg.sender);
    }

    function getChainlinkV3Oracles() external view returns (address[] memory) {
        return _chainlinkV3Oracles;
    }

    function getChainlinkV3OraclesByIndex(uint256 _index) external view returns (address) {
        return _chainlinkV3Oracles[_index];    
    }

    function getChainlinkV3OraclesLength() external view returns (uint256) {
        return _chainlinkV3Oracles.length;
    }

}