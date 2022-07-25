// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./UsingTellor.sol";
import "./interfaces/IDIVAOracleTellor.sol";
import "./interfaces/IDIVA.sol";
import "./libraries/SafeDecimalMath.sol";

contract DIVAOracleTellor is
    UsingTellor,
    IDIVAOracleTellor,
    Ownable,
    ReentrancyGuard
{
    using SafeDecimalMath for uint256;

    // Ordered to optimize storage
    uint256 private _maxFeeAmountUSD; // expressed as an integer with 18 decimals
    address private _excessFeeRecipient;
    address private _tellorAddress;
    uint32 private _minPeriodUndisputed;
    bool private immutable _challengeable;

    constructor(
        address payable tellorAddress_,
        address excessFeeRecipient_,
        uint32 minPeriodUndisputed_,
        uint256 maxFeeAmountUSD_
    ) UsingTellor(tellorAddress_) {
        _tellorAddress = tellorAddress_;
        _challengeable = false;
        _excessFeeRecipient = excessFeeRecipient_;
        _minPeriodUndisputed = minPeriodUndisputed_;
        _maxFeeAmountUSD = maxFeeAmountUSD_;
    }

    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId)
        external
        override
        nonReentrant
    {
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId); // updated the Pool struct based on the latest contracts

        // uint256 _expiryTime = _params.expiryTime;

        // Construct Tellor queryID (http://querybuilder.tellor.io/divaprotocolpolygon)
        bytes32 _queryID = keccak256(
            abi.encode("DIVAProtocolPolygon", abi.encode(_poolId))
        );

        // Find first oracle submission
        uint256 _timestampRetrieved = getTimestampbyQueryIdandIndex(
            _queryID,
            0
        );

        // Handle case where data was submitted before expiryTime
        if (_timestampRetrieved < _params.expiryTime) {
            // Check that data exists (_timestampRetrieved = 0 if it doesn't)
            require(
                _timestampRetrieved > 0,
                "DIVAOracleTellor: no oracle submission"
            );

            // Retrieve latest array index of data before `_expiryTime` for the queryId
            (, uint256 _index) = getIndexForDataBefore(
                _queryID,
                _params.expiryTime
            );

            // Increment index to get the first data point after `_expiryTime`
            _index++;

            // Get timestamp of first data point after `_expiryTime`
            _timestampRetrieved = getTimestampbyQueryIdandIndex(
                _queryID,
                _index
            );

            // _timestampRetrieved = 0 if there is no submission
            require(
                _timestampRetrieved > 0,
                "DIVAOracleTellor: no oracle submission after expiry time"
            );
        }

        // Check that _minPeriodUndisputed has passed after _timestampRetrieved
        require(
            block.timestamp - _timestampRetrieved >= _minPeriodUndisputed,
            "DIVAOracleTellor: must wait _minPeriodUndisputed before calling this function"
        );

        // Retrieve values (final reference value and USD value of collateral asset)
        bytes memory _valueRetrieved = retrieveData(
            _queryID,
            _timestampRetrieved
        );

        // Format values (18 decimals)
        (
            uint256 _formattedFinalReferenceValue,
            uint256 _formattedCollateralToUSDRate
        ) = abi.decode(_valueRetrieved, (uint256, uint256));

        // Get address of reporter who will receive
        address _reporter = ITellor(_tellorAddress).getReporterByTimestamp(
            _queryID,
            _timestampRetrieved
        );

        // Forward final value to DIVA contract. Allocates the fee as part of that process.
        _diva.setFinalReferenceValue(
            _poolId,
            _formattedFinalReferenceValue,
            _challengeable
        );

        uint256 _SCALING = uint256(
            10**(18 - IERC20Metadata(_params.collateralToken).decimals())
        );
        // Get the current fee claim allocated to this contract address (msg.sender)
        uint256 feeClaim = _diva.getClaims(
            _params.collateralToken,
            address(this)
        ); // denominated in collateral token; integer with collateral token decimals
        uint256 feeClaimUSD = (feeClaim * _SCALING).multiplyDecimal(
            _formattedCollateralToUSDRate
        ); // denominated in USD; integer with 18 decimals
        uint256 feeToReporter;
        uint256 feeToExcessRecipient;

        if (feeClaimUSD > _maxFeeAmountUSD) {
            // if _formattedCollateralToUSDRate = 0, then feeClaimUSD = 0 in which case it will
            // go into the else part, hence division by zero is not a problem
            feeToReporter =
                _maxFeeAmountUSD.divideDecimal(_formattedCollateralToUSDRate) /
                _SCALING; // integer with collateral token decimals
        } else {
            feeToReporter = feeClaim;
        }

        feeToExcessRecipient = feeClaim - feeToReporter; // integer with collateral token decimals

        // Transfer fee claim to reporter and excessFeeRecipient
        _diva.transferFeeClaim(
            _reporter,
            _params.collateralToken,
            feeToReporter
        );
        _diva.transferFeeClaim(
            _excessFeeRecipient,
            _params.collateralToken,
            feeToExcessRecipient
        );

        emit FinalReferenceValueSet(
            _poolId,
            _formattedFinalReferenceValue,
            _params.expiryTime,
            _timestampRetrieved
        );
    }

    function setMinPeriodUndisputed(uint32 _newMinPeriodUndisputed)
        external
        override
        onlyOwner
    {
        require(
            _newMinPeriodUndisputed >= 3600 && _newMinPeriodUndisputed <= 64800,
            "DIVAOracleTellor: out of range"
        );
        _minPeriodUndisputed = _newMinPeriodUndisputed;
    }

    function setMaxFeeAmountUSD(uint256 _newMaxFeeAmountUSD)
        external
        override
        onlyOwner
    {
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
