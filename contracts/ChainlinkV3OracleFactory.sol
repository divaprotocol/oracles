// // SPDX-License-Identifier: MIT
// pragma solidity 0.8.4;
//
// import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
// import "./interfaces/IChainlinkV3OracleFactory.sol";
// import "./ChainlinkV3Oracle.sol";
//
// /**
//  * IMPORTANT: DO NOT use this contract in production as it's not straightforward to verify whether a given roundId is the closest
//  * to a given expiry timestamp (see ChainlinkV3Oracle.sol)
//  */
//
// /**
//  * @notice Main contract to create DIVA specific Chainlink v3 oracles.
//  * @dev Implementation of the {IChainlinkV3OracleFactory} interface.
//  */
// contract ChainlinkV3OracleFactory is IChainlinkV3OracleFactory {
//
//     address[] private _chainlinkV3Oracles;
//     mapping(address => bool) _exists;
//
//     // TODO: Use ENS name instead of address
//     // TODO: Add reference asset label
//     function createChainlinkV3Oracle(address _chainlinkPriceFeed, string memory _asset) external override {
//
//         ChainlinkV3Oracle chainlinkV3Oracle = new ChainlinkV3Oracle(_chainlinkPriceFeed, _asset);
//         _chainlinkV3Oracles.push(address(chainlinkV3Oracle));
//         _exists[address(chainlinkV3Oracle)] = true;
//
//         emit OracleCreated(address(chainlinkV3Oracle), _chainlinkPriceFeed, msg.sender);
//     }
//
//     function getChainlinkV3Oracles() external view override returns (address[] memory) {
//         return _chainlinkV3Oracles;
//     }
//
//     function getChainlinkV3OraclesByIndex(uint256 _index) external view override returns (address) {
//         return _chainlinkV3Oracles[_index];
//     }
//
//     function getChainlinkV3OraclesLength() external view override returns (uint256) {
//         return _chainlinkV3Oracles.length;
//     }
//
//     function exists(address _oracle) external view override returns (bool) {
//         return _exists[_oracle];
//     }
//
// }
