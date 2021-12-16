// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./interfaces/IChainlinkV3Oracle.sol";
import "./interfaces/IDIVA.sol";

// IMPORTANT: Activate the two require statements in setFinalReferenceValueById if you have deactivated them for testing!

contract ChainlinkV3Oracle is IChainlinkV3Oracle {

    bool private _challengeable; 
    
    AggregatorV3Interface internal _priceFeed;

    constructor(address _chainlinkAddress) {
        _priceFeed = AggregatorV3Interface(_chainlinkAddress);
        _challengeable = false;
    }

    function setFinalReferenceValue(address _divaDiamond, uint80 _roundId, uint256 _pooId) external override {
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory params = _diva.getPoolParametersById(_pooId);

        uint256 expiryDate = params.expiryDate;
        (uint80 returnedRoundId, int256 price, uint256 roundIdStartedAt, uint256 roundIdTimestamp, uint80 answeredInRound, uint8 decimals) = getHistoricalPrice(_roundId); //TODO: Consider adding timestamp check--DONE
        
        require(price >= 0, "ChainlinkV3Oracle: negative price");
        require(decimals <= 18, "ChainlinkV3Oracle: exceeds max allowed decimals");
        require((roundIdStartedAt <= expiryDate) && (expiryDate > roundIdTimestamp) , "ChainlinkV3Oracle: expiry time outside of round"); // Checking expiry date within 60 second window
        require(returnedRoundId == answeredInRound , "ChainlinkV3Oracle: round not equal to answered round");

        uint256 historicalPrice = uint256(price);
        uint256 decimalAdjustedHistoricalPrice = historicalPrice * (10**(18-decimals));
        
        require(_diva.setFinalReferenceValueById(_pooId, decimalAdjustedHistoricalPrice, _challengeable)); 
        
        emit FinalReferenceValueSet(_pooId, decimalAdjustedHistoricalPrice, expiryDate, _roundId);
    }

    function challengeable() external view override returns (bool) {
        return _challengeable;
    }

    function priceFeed() external view override returns (AggregatorV3Interface) {
        return _priceFeed;
    }

    function getHistoricalPrice(uint80 _roundId) public view override returns (uint80, int256, uint256, uint256, uint80, uint8) {
        (
            uint80 id, 
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = _priceFeed.getRoundData(_roundId);
        require(timeStamp > 0, "ChainlinkV3Oracle: round not complete");
        uint8 decimals = _priceFeed.decimals();
        return (id, price, startedAt, timeStamp, answeredInRound, decimals);
    }

    function getLatestPrice() external view override returns (uint80, int256, uint256, uint256, uint80) {
        (
            uint80 roundId, 
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = _priceFeed.latestRoundData();
        require(timeStamp > 0, "ChainlinkV3Oracle: Round not complete");
        return (roundId, price, startedAt, timeStamp, answeredInRound);
    }

}
