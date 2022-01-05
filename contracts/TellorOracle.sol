 // SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "usingtellor/contracts/UsingTellor.sol";
import "usingtellor/contracts/TellorPlayground.sol";

import "hardhat/console.sol";

contract TellorOracle is UsingTellor{
    event SetFinalReferenceValue(uint256 indexed optionID, uint256 value, uint256 indexed expiryDate, uint256 indexed timestamp);
    
    address private _tellorAddress;

    constructor(address tellorAddress_) {
        _tellorAddress = tellorAddress_;
    }

    // Conscious decision to have the addressDIVAFactory as input in setFinalPriceByID function to avoid re-deploying
    function setFinalReferenceValue(address _addressDIVAFactory,uint256 _optionId) public returns (bool) {
        IDIVA _DIVAFactory = IDIVA(_addressDIVAFactory);
        // _DIVAFactory.Pool storage params = _DIVAFactory.getPoolParametersById(_optionId);
        IDIVA.Pool memory params = _DIVAFactory.getPoolParametersById(_optionId);
        uint256 _expiryDate = params.expiryDate;
        string memory _s = string(abi.encode({type:\"divaProtocolPolygon",\"","id:",_optionId,"}")
        bytes32 _queryID = return keccak256(abi.encode(_s));
        bool _didRetrieve;
        bytes memory _value;
        uint256 _timestampRetrieved;
        (_didRetrieve,_value,_timestampRetrieved) = getDataBefore(_s, now - 1 hour);
        require(_timestampRetrieved >= _expiryDate, "expiry date has not yest passed");
        require(_DIVAFactory.setFinalReferenceValueById(_optionId, _value, false)); //passing on to diva, ultimate handover. Retain false bool. 
        emit SetFinalReferenceValue(_optionId,_value,_expiryDate,_timestampRetrieved);
        return true;
    }

    function getTellorOracleAddress() public view returns (address) {
        return _tellorAddress;
    }
}