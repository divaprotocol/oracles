// // SPDX-License-Identifier: MIT
// pragma solidity 0.8.4;
//
// import "./interfaces/IChainlinkV3Oracle.sol";
// import "./interfaces/IDIVA.sol";
//
// /**
//  * IMPORTANT: DO NOT use this contract in production as it's not straightforward to verify whether a given roundId is the closest
//  * to a given expiry timestamp.
//  */
// contract ChainlinkV3Oracle is IChainlinkV3Oracle {
//
//     string private _asset;
//
//     bool private _challengeable;
//
//     AggregatorV3Interface internal _priceFeed;
//
//     constructor(address _chainlinkAddress, string memory _assetName) {
//         _priceFeed = AggregatorV3Interface(_chainlinkAddress);
//         _challengeable = false;
//         _asset = _assetName;
//     }
//
//     function setFinalReferenceValue(address _divaDiamond, uint80 _roundId, uint256 _poolId) external override {
//         IDIVA _diva = IDIVA(_divaDiamond);
//         IDIVA.Pool memory params = _diva.getPoolParametersById(_poolId);
//
//         uint256 expiryDate = params.expiryDate;
//         (uint80 returnedRoundId, int256 price, uint256 roundIdStartedAt, uint256 roundIdTimestamp, uint80 answeredInRound, uint8 decimals) = getHistoricalPrice(_roundId);
//
//         require(price >= 0, "ChainlinkV3Oracle: negative price");
//         require(decimals <= 18, "ChainlinkV3Oracle: exceeds max allowed decimals");
//         require((roundIdStartedAt <= expiryDate) && (expiryDate <= roundIdTimestamp) , "ChainlinkV3Oracle: expiry time outside of round");
//         require(returnedRoundId == answeredInRound , "ChainlinkV3Oracle: round not equal to answered round");
//
//         uint256 historicalPrice = uint256(price);
//         uint256 decimalAdjustedHistoricalPrice = historicalPrice * (10**(18-decimals));
//
//         require(_diva.setFinalReferenceValueById(_poolId, decimalAdjustedHistoricalPrice, _challengeable));
//
//         emit FinalReferenceValueSet(_poolId, decimalAdjustedHistoricalPrice, expiryDate, _roundId);
//     }
//
//     function challengeable() external view override returns (bool) {
//         return _challengeable;
//     }
//
//     function priceFeed() external view override returns (AggregatorV3Interface) {
//         return _priceFeed;
//     }
//
//     function getHistoricalPrice(uint80 _roundId) public view override returns (uint80, int256, uint256, uint256, uint80, uint8) {
//         (
//             uint80 id,
//             int256 price,
//             uint256 startedAt,
//             uint256 timeStamp,
//             uint80 answeredInRound
//         ) = _priceFeed.getRoundData(_roundId);
//         require(timeStamp > 0, "ChainlinkV3Oracle: round not complete");
//         uint8 decimals = _priceFeed.decimals();
//         return (id, price, startedAt, timeStamp, answeredInRound, decimals);
//     }
//
//     function getLatestPrice() external view override returns (uint80, int256, uint256, uint256, uint80) {
//         (
//             uint80 roundId,
//             int256 price,
//             uint256 startedAt,
//             uint256 timeStamp,
//             uint80 answeredInRound
//         ) = _priceFeed.latestRoundData();
//         require(timeStamp > 0, "ChainlinkV3Oracle: round not complete");
//         return (roundId, price, startedAt, timeStamp, answeredInRound);
//     }
//
//     function getAsset() external view override returns (string memory) {
//         return _asset;
//     }
//
// }
//
