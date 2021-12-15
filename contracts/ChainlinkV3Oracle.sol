// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IDIVA.sol";

// IMPORTANT: Activate the two require statements in setFinalReferenceValueById if you have deactivated them for testing!

contract ChainlinkV3Oracle {

    event SetFinalReferenceValue(uint256 indexed pooId, uint256 decimalAdjustedHistoricalPrice, uint256 indexed expiryDate, uint256 indexed roundid );
    
    address private _chainlinkAddress;

    AggregatorV3Interface internal _priceFeed;

    constructor(address chainlinkAddress_) {
        _chainlinkAddress = chainlinkAddress_;
        _priceFeed = AggregatorV3Interface(_chainlinkAddress);
    }

    // Conscious decision to have the addressDIVAFactory as input in setFinalPriceByID function to avoid re-deploying
    function setFinalReferenceValue(address _addressDIVAFactory, uint80 _roundId, uint256 _pooId) external {
        IDIVA _DIVAFactory = IDIVA(_addressDIVAFactory);

        IDIVA.Pool memory params = _DIVAFactory.getPoolParametersById(_pooId);

        uint256 expiryDate = params.expiryDate;

        (uint80 returnedRoundId, uint256 historicalPrice, uint256 roundIdStartedAt, uint256 roundIdTimestamp, uint80 answeredInRound, uint8 decimals) = getHistoricalPrice(_roundId); //TODO: Consider adding timestamp check--DONE

        // TODO: require((roundIdStartedAt <= expiryDate) && (expiryDate > roundIdTimestamp) , "ChainlinkV3Oracle: expiry date outside of round"); // Checking expiry date within 60 second window
        // TODO: require(returnedRoundId == answeredInRound , "ChainlinkV3Oracle: round not equal to answered round");
        uint256 decimalAdjustedHistoricalPrice = historicalPrice * (10**(18-decimals));
        require(_DIVAFactory.setFinalReferenceValueById(_pooId, decimalAdjustedHistoricalPrice, false)); //passing on to diva, ultimate handover. Retain false bool. 
        emit SetFinalReferenceValue(_pooId, decimalAdjustedHistoricalPrice, expiryDate, _roundId);
    }

    function getChainlinkOracleAddress() external view returns (address) {
        return _chainlinkAddress;
    }

    function getHistoricalPrice(uint80 _roundId) public view returns (uint80, uint256, uint256, uint256, uint80, uint8) {
        (
            uint80 id, 
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = _priceFeed.getRoundData(_roundId);
        require(timeStamp > 0, "Chainlink: round not complete");
        require(price >= 0, "Chainlink: negative price");
        uint8 decimals = _priceFeed.decimals();
        require(decimals <= 18, "Chainlink: exceeds max allowed decimals");
        return (id, uint256(price), startedAt, timeStamp, answeredInRound, decimals);
    }

    function getLatestPrice() external view returns (uint80, int256, uint256, uint256, uint80) {
        (
            uint80 roundID, 
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = _priceFeed.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0, "Chainlink: Round not complete");
        return (roundID, price, startedAt, timeStamp, answeredInRound);
    }

}
