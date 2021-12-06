// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IDIVA.sol";

contract ChainlinkV3Oracle {

    // Collection of pool related parameters
    // struct Pool {
    //     string referenceAsset;
    //     uint256 inflection;
    //     uint256 cap;
    //     uint256 floor;
    //     uint256 supplyShortInitial;
    //     uint256 supplyLongInitial;
    //     uint256 supplyShort;
    //     uint256 supplyLong;
    //     uint256 expiryDate;
    //     address collateralToken;
    //     uint256 collateralBalanceShortInitial;
    //     uint256 collateralBalanceLongInitial;
    //     uint256 collateralBalanceShort;
    //     uint256 collateralBalanceLong;
    //     address shortToken;
    //     address longToken;
    //     uint256 finalReferenceValue;
    //     Status statusFinalReferenceValue;
    //     uint256 redemptionAmountLongToken;
    //     uint256 redemptionAmountShortToken;
    //     uint256 statusTimeStamp;
    //     address dataFeedProvider;
    //     uint256 redemptionFee; 
    //     uint256 settlementFee;
    // } 

    // // Settlement status
    // enum Status {
    //     Open,
    //     Submitted,
    //     Challenged,
    //     Confirmed
    // }

    event SetFinalReferenceValue(uint256 indexed optionID, uint256 decimalAdjustedHistoricalPrice, uint256 indexed expiryDate, uint256 indexed roundid );
    
    address chainlinkAddress;

    constructor(address _chainlinkAddress) {
        chainlinkAddress = _chainlinkAddress;

    }

    // Conscious decision to have the addressDIVAFactory as input in setFinalPriceByID function to avoid re-deploying
    function setFinalPrice(address _addressDIVAFactory, uint80 _roundId, uint256 _optionId) public returns (bool) {
        IDIVA _DIVAFactory = IDIVA(_addressDIVAFactory);

        //Fetching option expiry date so that one cannot call maliciously call this function with wrong roundId
        // Pool storage params = _DIVAFactory.getPoolParametersById(_optionId);
        // require(_DIVAFactory.call(bytes4(keccak256("getPoolParametersById(uint256)")),_optionId));
        // uint256 expiryDate = params.expiryDate;
        uint256 expiryDate = _DIVAFactory.getExpiryDateById(_optionId);

        //(,,uint256 roundIdTimestampPrevious) = getHistoricalPrice(_roundId-1);
        //require(roundIdTimestampPrevious >= expiryDate,"Chainlink: Not first roundId following expiry") ;

        //decimal information needed? what does diva factory expect
        (uint80 returnedRoundId, uint256 historicalPrice, uint256 roundIdStartedAt, uint256 roundIdTimestamp, uint80 answeredInRound, uint8 decimals) = getHistoricalPrice(_roundId); //TODO: Consider adding timestamp check--DONE
        

        require((roundIdStartedAt <= expiryDate) && (expiryDate > roundIdTimestamp) , "Option expiry date does not match with roundId timestamp"); // Checking expiry date within 60 second window
        require((returnedRoundId == answeredInRound) , "Chainlink price based on date is answered in different roundID");

        //TODO input price needs to be 18 digits
        //historical price adjusted for historicalprice*10**(18-decimal)
        //set price withing the diva factory contract. permission checks/ expiry checks etc are handeled by diva factory

        uint256 decimalAdjustedHistoricalPrice = historicalPrice*(10**(18-decimals));
        require(_DIVAFactory.setFinalReferenceValueById(_optionId, decimalAdjustedHistoricalPrice, false)); //passing on to diva, ultimate handover. Retain false bool. 
        emit SetFinalReferenceValue(_optionId, decimalAdjustedHistoricalPrice, expiryDate, _roundId);
        return true;
    }


    function getHistoricalPrice(uint80 roundId) public view returns (uint80, uint256, uint256, uint256, uint80, uint8) {

        AggregatorV3Interface chainlinkOracleContract = AggregatorV3Interface(chainlinkAddress);
        (
            uint80 id, 
            int price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = chainlinkOracleContract.getRoundData(roundId);
        require(timeStamp > 0, "Chainlink: Round not complete");
        require(price >= 0, "Chainlink: Negative price");
        uint8 decimals = chainlinkOracleContract.decimals();
        return (id, uint256(price), startedAt, timeStamp, answeredInRound, decimals);
    }



}
