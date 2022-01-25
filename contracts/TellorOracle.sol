// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./UsingTellor.sol";
import "./interfaces/ITellorOracle.sol";
import "./interfaces/IDIVA.sol";

contract TellorOracle is UsingTellor, ITellorOracle {

    bool private _challengeable;
    address private _tellorAddress;
    address private _settlementFeeRecipient;

    constructor(address payable tellorAddress_, address settlementFeeRecipient_) UsingTellor(tellorAddress_) {
        _tellorAddress = tellorAddress_;
        _challengeable = false;
        _settlementFeeRecipient = settlementFeeRecipient_;
    }

    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId) external override {
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        uint256 _expiryDate = _params.expiryDate;
        address _collateralToken = _params.collateralToken;

        // Tellor query
        bytes memory _b = abi.encode("divaProtocolPolygon", abi.encode(_poolId)); 
        bytes32 _queryID = keccak256(_b);
        (, bytes memory _value, uint256 _timestampRetrieved) = getDataBefore(_queryID, block.timestamp - 1 hours);

        require(_timestampRetrieved >= _expiryDate, "Tellor: value at expiration not yet available");
        uint256 _formattedValue = _sliceUint(_value);

        // Forward final value to DIVA contract
        _diva.setFinalReferenceValue(_poolId, _formattedValue, _challengeable);

        // Transfer fee claim from this contract's address to Tellor's payment contract address
        uint256 _feeClaimAmount = _diva.getClaims(_collateralToken, address(this));
        _diva.transferFeeClaim(_settlementFeeRecipient, _params.collateralToken, _feeClaimAmount);

        emit FinalReferenceValueSet(_poolId, _formattedValue, _expiryDate, _timestampRetrieved);
    }

    function challengeable() external view override returns (bool) {
        return _challengeable;
    }

    function getTellorAddress() external view override returns (address) {
        return _tellorAddress;
    }

    function getSettlementFeeRecipient() external view override returns (address) {
        return _settlementFeeRecipient;
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
