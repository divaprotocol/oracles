// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./UsingTellor.sol";
import "./interfaces/ITellorOracle.sol";
import "./interfaces/IDIVA.sol";

contract TellorOracle is UsingTellor, ITellorOracle {

    string private _asset;
    
    bool private _challengeable; 
    
    address private _tellorAddress;
    
    constructor(address payable tellorAddress_, string memory _assetName) UsingTellor(tellorAddress_) {
        _tellorAddress = tellorAddress_;
        _challengeable = false;
        _asset = _assetName;
    }

    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId) external override {
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParametersById(_poolId);

        uint256 _expiryDate = _params.expiryDate;
        
        // Tellor query
        string memory _s = string(abi.encode("{type:","\"divaProtocolPolygon","\"","id:",_poolId,"}")); // QUESTION: Aren't there commas missing? Is this string Polygon specific? On Arbitrum it would be different?

        bytes32 _queryID = keccak256(abi.encode(_s));
        
        // QUESTION: Is it necessary to define below values given that the output types are already defined in the getDataBefore function?
        bool _didRetrieve;
        bytes memory _value;
        uint256 _timestampRetrieved;

        (_didRetrieve, _value, _timestampRetrieved) = getDataBefore(_queryID, block.timestamp - 1 hours); // QUESTION: What if someone calls this functino 23 after expiry? Which value will be returned? Still the last one before expiry? 
        require(_timestampRetrieved >= _expiryDate, "Tellor: expiry date has not yet passed");
        uint256 _formattedValue = _sliceUint(_value); // QUESTION: Is _formattedValue scaled to 18 decimals (e.g., in Chainlink, ETH/USD price has 8 decimals only)?
        
        // Forward value to DIVA contract
        require(_diva.setFinalReferenceValueById(_poolId, _formattedValue, _challengeable)); 
        
        emit FinalReferenceValueSet(_poolId, _formattedValue, _expiryDate, _timestampRetrieved);
    }

    function challengeable() external view override returns (bool) {
        return _challengeable;
    }

    function getTellorOracleAddress() external view override returns (address) {
        return _tellorAddress;
    }

    function getAsset() external view override returns (string memory) {
        return _asset;
    }

    /**
     * @dev Utilized to help slice a bytes variable into a uint
     * @param _b is the bytes variable to be sliced
     * @return _x of the sliced uint256
     */
    function _sliceUint(bytes memory _b) private pure returns (uint256 _x) {
        uint256 _number = 0;
        for (uint256 _i = 0; _i < _b.length; _i++) {
            _number = _number * 2**8;
            _number = _number + uint8(_b[_i]);
        }
        return _number;
    }

}

