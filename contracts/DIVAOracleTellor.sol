// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./UsingTellor.sol";
import "./interfaces/IDIVAOracleTellor.sol";
import "./interfaces/IDIVA.sol";
import "./libraries/SafeDecimalMath.sol";

contract DIVAOracleTellor is UsingTellor, IDIVAOracleTellor, Ownable {
    using SafeDecimalMath for uint256;

    // Ordered to optimize storage
    uint256 private _maxFeeAmountUSD;
    address private _excessFeeRecipient;
    address private _tellorAddress;
    uint96 private _minPeriodUndisputed;
    bool private immutable _challengeable;

    constructor(
        address payable tellorAddress_, 
        address excessFeeRecipient_, 
        uint96 minPeriodUndisputed_, 
        uint256 maxFeeAmountUSD_
    ) UsingTellor(tellorAddress_) {
        _tellorAddress = tellorAddress_;
        _challengeable = false;
        _excessFeeRecipient = excessFeeRecipient_;
        _minPeriodUndisputed = minPeriodUndisputed_;
        _maxFeeAmountUSD = maxFeeAmountUSD_;

    }

    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId) external override {
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);   // updated the Pool struct based on the latest contracts

        uint256 _expiryDate = _params.expiryDate;

        // Tellor query
        bytes memory _b = abi.encode("DIVAProtocolPolygon", abi.encode(_poolId)); 
        bytes32 _queryID = keccak256(_b);
        (, bytes memory _finalReferenceValue, uint256 _timestampRetrieved) = getDataBefore(_queryID, block.timestamp - _minPeriodUndisputed); // takes the latest value that is undisputed for at least an hour
        
        address _reporter; // TODO: (Tim)

        require(_timestampRetrieved >= _expiryDate, "Tellor: value set before expiry"); // if value disputed, timestampRetrieved will be 0 and hence this test will not pass, hence _ifRetrieve = true check not needed
        
        uint256 _formattedFinalReferenceValue = _sliceUint(_finalReferenceValue);
        uint256 _formattedCollateralValueUSD = _sliceUint(_collateralValueUSD); // TODO: (Tim)
        
        // Forward final value to DIVA contract
        _diva.setFinalReferenceValue(_poolId, _formattedFinalReferenceValue, _challengeable);

        // Get the current fee allocated to this contract address
        _feeClaim = _diva.getClaims(_params.collateralToken, address(this))      // denominated in collateral token
        _feeClaimUSD = _feeClaim.multiplyDecimals(_formattedCollateralValueUSD)  // denominated in USD
        if (_feeClaimsUSD > _maxFeeAmountUSD) {     // check whether there could be any rounding issues resulting in _feeToExcessRecipient < 0
            _feeToReporter = _maxFeeAmountUSD.divideDecimal(_formattedCollateralValueUSD);
            _feeToExcessRecipient = _feeClaim - _feeToReporter;
        } else {
            _feeToReporter = _feeClaim;
            _feeToExcessRecipient = 0;
        }
        
        _diva.transferFeeClaim(_reporter, _params.collateralToken, _feeToReporter)
        _diva.transferFeeClaim(_excessFeeRecipient, _params.collateralToken, _feeToExcessRecipient)

        emit FinalReferenceValueSet(_poolId, _formattedFinalReferenceValue, _expiryDate, _timestampRetrieved);
    }

    function setMinPeriodUndisputed(uint32 _newMinPeriodUndisputed) external override onlyOwner {
        require(_newMinPeriodUndisputed >= 3600 && _newMinPeriodUndisputed <= 64800, "Tellor: out of range");
        _minPeriodUndisputed = _newMinPeriodUndisputed;
    }

    function setMaxFeeAmountUSD(uint256 _newMaxFeeAmountUSD) external override onlyOwner {
        _maxFeeAmountUSD = _newMaxFeeAmountUSD;
    }
    
    function challengeable() external view override returns (bool) {
        return _challengeable;
    }

    function getTellorAddress() external view override returns (address) {
        return _tellorAddress;
    }

    function getExcessFeeRecipient() external view override returns (address) {
        return _excessFeeRecipient;
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
        uint256 _length = _b.length;
        for (uint256 _i = 0; _i < _length; ) {
            _number = _number * 2**8;
            _number = _number + uint8(_b[_i]);
        
        unchecked {
                i++;
            }

        }

        return _number;
    }

}
