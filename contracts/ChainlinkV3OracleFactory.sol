// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./ChainlinkV3Oracle.sol";

// QUESTION: Add Ownable library?
// TODO: Explore CloneFactory: https://soliditydeveloper.com/clonefactory
/**
 * @notice Main contract to create Chainlink v3 oracles.
 * @dev Implementation of the {IChainlinkV3OracleFactory} interface.
 */
contract ChainlinkV3OracleFactory {

    address[] public chainlinkV3Oracles;

    event OracleCreated(address indexed oracleAddress, address indexed chainlinkAddress, address indexed creator);
    	
    // TODO: Use ENS name instead of address
    function createChainlinkV3Oracle(address _chainlinkAddress) public returns (ChainlinkV3Oracle chainlinkV3Oracle){
        
        ChainlinkV3Oracle chainlinkV3Oracle = new ChainlinkV3Oracle(_chainlinkAddress);
        chainlinkV3Oracles.push(address(chainlinkV3Oracle));
        emit OracleCreated(address(chainlinkV3Oracle), _chainlinkAddress, msg.sender);
    }

    function getChainlinkV3Oracles() public view returns (address[] memory) {
        return chainlinkV3Oracles;
    }

}