// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./UsingTellor.sol";
import "./interfaces/IDIVAOracleTellor.sol";
import "./interfaces/IDIVA.sol";

contract DIVAOracleTellor is UsingTellor, IDIVAOracleTellor, Ownable {

    bool private _challengeable;
    address private _tellorAddress;
    address private _settlementFeeRecipient;
    uint32 private _minPeriodUndisputed;

    constructor(address payable tellorAddress_, address settlementFeeRecipient_, uint32 minPeriodUndisputed_) UsingTellor(tellorAddress_) {
        _tellorAddress = tellorAddress_;
        _challengeable = false;
        _settlementFeeRecipient = settlementFeeRecipient_;
        _minPeriodUndisputed = minPeriodUndisputed_;
    }

    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId) external override {
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        uint256 _expiryDate = _params.expiryDate;

        // Tellor query
        bytes memory _b = abi.encode("DIVAProtocolPolygon", abi.encode(_poolId)); 
        bytes32 _queryID = keccak256(_b);
        (, bytes memory _value, uint256 _timestampRetrieved) = getDataBefore(_queryID, block.timestamp - _minPeriodUndisputed); // takes the latest value that is undisputed for at least an hour

        require(_timestampRetrieved >= _expiryDate, "Tellor: value set before expiry"); // if value disputed, timestampRetrieved will be 0 and hence this test will not pass, hence _ifRetrieve = true check not needed
        uint256 _formattedValue = _sliceUint(_value);

        // Forward final value to DIVA contract
        _diva.setFinalReferenceValue(_poolId, _formattedValue, _challengeable);

        emit FinalReferenceValueSet(_poolId, _formattedValue, _expiryDate, _timestampRetrieved);
    }

    function transferFeeClaim(address _divaDiamond, address _collateralToken, uint256 _amount) external override {
        // Throws within DIVA contract if `_amount` exceeds the available fee claim
        IDIVA(_divaDiamond).transferFeeClaim(_settlementFeeRecipient, _collateralToken, _amount);
    }

    function setMinPeriodUndisputed(uint32 _newMinPeriodUndisputed) external override onlyOwner {
        require(_newMinPeriodUndisputed >= 3600 && _newMinPeriodUndisputed <= 64800, "Tellor: out of range");
        _minPeriodUndisputed = _newMinPeriodUndisputed;
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

    function getMinPeriodUndisputed() external view override returns (uint32) {
        return _minPeriodUndisputed;
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
