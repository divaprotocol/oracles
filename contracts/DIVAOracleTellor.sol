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

        uint256 _expiryDate = _params.expiryTime;

        // Tellor query
        bytes memory _b = abi.encode("DIVAProtocolPolygon", abi.encode(_poolId));
        bytes32 _queryID = keccak256(_b);

        // Find first oracle submission after expiryDate
        uint256 _timestampRetrieved = getTimestampbyQueryIdandIndex(_queryID, 0);
        if (_timestampRetrieved < _expiryDate) {
          require(_timestampRetrieved > 0, "no oracle submission");
          (, uint256 _index) = getIndexForDataBefore(_queryID, _expiryDate);
          _index++;
          _timestampRetrieved = getTimestampbyQueryIdandIndex(_queryID, _index);
          require(_timestampRetrieved > 0, "no oracle submission after expiry data");
        }
        require(block.timestamp - _timestampRetrieved >= _minPeriodUndisputed, "must wait _minPeriodUndisputed before calling this function");
        bytes memory _valueRetrieved = retrieveData(_queryID, _timestampRetrieved);
        (uint256 _formattedFinalReferenceValue, uint256 _formattedCollateralValueUSD) = abi.decode(_valueRetrieved, (uint256, uint256));

        address _reporter = ITellor(_tellorAddress).getReporterByTimestamp(_queryID, _timestampRetrieved); // TODO: (Tim)

        // Forward final value to DIVA contract. Allocates the fee as part of that process.
        _diva.setFinalReferenceValue(_poolId, _formattedFinalReferenceValue, _challengeable);

        // Get the current fee allocated to this contract address
        uint256 _feeClaim = _diva.getClaims(_params.collateralToken, address(this));      // denominated in collateral token
        uint256 _feeClaimUSD = _feeClaim.multiplyDecimals(_formattedCollateralValueUSD);  // denominated in USD
        uint256 _feeToReporter;
        uint256 _feeToExcessRecipient;
        if (_feeClaimUSD > _maxFeeAmountUSD) {     // check whether there could be any rounding issues resulting in _feeToExcessRecipient < 0
            _feeToReporter = _maxFeeAmountUSD.divideDecimal(_formattedCollateralValueUSD);
            _feeToExcessRecipient = _feeClaim - _feeToReporter;
        } else {
            _feeToReporter = _feeClaim;
            _feeToExcessRecipient = 0;
        }

        _diva.transferFeeClaim(_reporter, _params.collateralToken, _feeToReporter);
        _diva.transferFeeClaim(_excessFeeRecipient, _params.collateralToken, _feeToExcessRecipient);

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
}
