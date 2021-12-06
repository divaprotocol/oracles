// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IDIVA.sol";

import "hardhat/console.sol";

contract ChainlinkV3Oracle {

    event SetFinalReferenceValue(uint256 indexed optionID, uint256 decimalAdjustedHistoricalPrice, uint256 indexed expiryDate, uint256 indexed roundid );
    
    address private _chainlinkAddress;

    constructor(address chainlinkAddress_) {
        _chainlinkAddress = chainlinkAddress_;
    }

    // Conscious decision to have the addressDIVAFactory as input in setFinalPriceByID function to avoid re-deploying
    function setFinalReferenceValue(address _addressDIVAFactory, uint80 _roundId, uint256 _optionId) public returns (bool) {
        IDIVA _DIVAFactory = IDIVA(_addressDIVAFactory);

        //Fetching option expiry date so that one cannot call maliciously call this function with wrong roundId
        // _DIVAFactory.Pool storage params = _DIVAFactory.getPoolParametersById(_optionId);
        IDIVA.Pool memory params = _DIVAFactory.getPoolParametersById(_optionId);

        uint256 expiryDate = params.expiryDate;

        (uint80 returnedRoundId, uint256 historicalPrice, uint256 roundIdStartedAt, uint256 roundIdTimestamp, uint80 answeredInRound, uint8 decimals) = getHistoricalPrice(_roundId); //TODO: Consider adding timestamp check--DONE
        

        require((roundIdStartedAt <= expiryDate) && (expiryDate > roundIdTimestamp) , "Option expiry date does not match with roundId timestamp"); // Checking expiry date within 60 second window
        require((returnedRoundId == answeredInRound) , "Chainlink price based on date is answered in different roundID");

        //TODO input price needs to be 18 digits
        //historical price adjusted for historicalprice*10**(18-decimal)
        //set price withing the diva factory contract. permission checks/ expiry checks etc are handeled by diva factory

        uint256 decimalAdjustedHistoricalPrice = historicalPrice * (10**(18-decimals));
        require(_DIVAFactory.setFinalReferenceValueById(_optionId, decimalAdjustedHistoricalPrice, false)); //passing on to diva, ultimate handover. Retain false bool. 
        emit SetFinalReferenceValue(_optionId, decimalAdjustedHistoricalPrice, expiryDate, _roundId);
        return true;
    }

    function getChainlinkOracleAddress() public view returns (address) {
        return _chainlinkAddress;
    }


    function getHistoricalPrice(uint80 _roundId) public view returns (uint80, uint256, uint256, uint256, uint80, uint8) {

        AggregatorV3Interface chainlinkOracleContract = AggregatorV3Interface(_chainlinkAddress);
        (
            uint80 id, 
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = chainlinkOracleContract.getRoundData(_roundId);
        require(timeStamp > 0, "Chainlink: Round not complete");
        require(price >= 0, "Chainlink: Negative price");
        uint8 decimals = chainlinkOracleContract.decimals();
        return (id, uint256(price), startedAt, timeStamp, answeredInRound, decimals);
    }

   


}
