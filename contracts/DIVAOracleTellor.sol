// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
    using SafeERC20 for IERC20Metadata;
    using SafeDecimalMath for uint256;

    // Ordered to optimize storage
    mapping(uint256 => mapping(address => uint256)) private _tips; // mapping poolId => tipping token address => tip amount
    mapping(uint256 => address[]) private _poolIdToTippingTokens; // mapping poolId to tipping tokens
    mapping(uint256 => address) private _poolIdToReporter; // mapping poolId to reporter address

    uint256 private _maxFeeAmountUSD; // expressed as an integer with 18 decimals
    address private _excessFeeRecipient;
    uint32 private _minPeriodUndisputed;
    bool private immutable _challengeable;
    IDIVA private immutable _diva;

    modifier onlyConfirmedPool(uint256 _poolId) {
        if (_poolIdToReporter[_poolId] == address(0)) {
            revert NotConfirmedPool();
        }
        _;
    }

    constructor(
        address payable tellorAddress_,
        address excessFeeRecipient_,
        uint32 minPeriodUndisputed_,
        uint256 maxFeeAmountUSD_,
        address diva_
    ) UsingTellor(tellorAddress_) {
        _challengeable = false;
        _excessFeeRecipient = excessFeeRecipient_;
        _minPeriodUndisputed = minPeriodUndisputed_;
        _maxFeeAmountUSD = maxFeeAmountUSD_;
        _diva = IDIVA(diva_);
    }

    function addTip(
        uint256 _poolId,
        uint256 _amount,
        address _tippingToken
    ) external override nonReentrant {
        if (_poolIdToReporter[_poolId] != address(0)) {
            revert AlreadyConfirmedPool();
        }

        if (_tips[_poolId][_tippingToken] == 0) {
            _poolIdToTippingTokens[_poolId].push(_tippingToken);
        }
        IERC20Metadata(_tippingToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        _tips[_poolId][_tippingToken] += _amount;
        emit TipAdded(_poolId, _tippingToken, _amount, msg.sender);
    }

    // QUESTION: need this function?
    function claimTips(uint256 _poolId, address[] calldata _tippingTokens)
        external
        override
        nonReentrant
    {
        _claimTips(_poolId, _tippingTokens);
    }

    function batchClaimTips(
        uint256[] calldata _poolIds,
        address[] calldata _tippingTokens
    ) external override nonReentrant {
        uint256 len = _poolIds.length;
        for (uint256 i = 0; i < len; ) {
            _claimTips(_poolIds[i], _tippingTokens);

            unchecked {
                ++i;
            }
        }
    }

    // QUESTION: need this function? need batch version of this function?
    function claimDIVAFee(uint256 _poolId)
        external
        override
        nonReentrant
        onlyConfirmedPool(_poolId)
    {
        _claimDIVAFee(_poolId);
    }

    // QUESTION: need this function?
    function claimTipsAndDIVAFee(
        uint256 _poolId,
        address[] calldata _tippingTokens
    ) external override nonReentrant {
        _claimTips(_poolId, _tippingTokens);
        _claimDIVAFee(_poolId);
    }

    function batchClaimTipsAndDIVAFee(
        uint256[] calldata _poolIds,
        address[] calldata _tippingTokens
    ) external override nonReentrant {
        uint256 len = _poolIds.length;
        for (uint256 i = 0; i < len; ) {
            _claimTips(_poolIds[i], _tippingTokens);
            _claimDIVAFee(_poolIds[i]);

            unchecked {
                ++i;
            }
        }
    }

    function setFinalReferenceValue(uint256 _poolId)
        external
        override
        nonReentrant
    {
        _setFinalReferenceValue(_poolId);
    }

    function setFinalReferenceValueAndClaimTips(
        uint256 _poolId,
        address[] calldata _tippingTokens
    ) external override nonReentrant {
        _setFinalReferenceValue(_poolId);
        _claimTips(_poolId, _tippingTokens);
    }

    function setFinalReferenceValueAndClaimDIVAFee(uint256 _poolId)
        external
        override
        nonReentrant
    {
        _setFinalReferenceValue(_poolId);
        _claimDIVAFee(_poolId);
    }

    function setFinalReferenceValueAndClaimTipsAndDIVAFee(
        uint256 _poolId,
        address[] calldata _tippingTokens
    ) external override nonReentrant {
        _setFinalReferenceValue(_poolId);
        _claimTips(_poolId, _tippingTokens);
        _claimDIVAFee(_poolId);
    }

    function setExcessFeeRecipient(address _newExcessFeeRecipient)
        external
        override
        onlyOwner
    {
        if (_newExcessFeeRecipient == address(0)) {
            revert ZeroExcessFeeRecipient();
        }
        _excessFeeRecipient = _newExcessFeeRecipient;
    }

    function setMinPeriodUndisputed(uint32 _newMinPeriodUndisputed)
        external
        override
        onlyOwner
    {
        if (_newMinPeriodUndisputed < 3600 || _newMinPeriodUndisputed > 64800) {
            revert OutOfRange();
        }
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

    function getExcessFeeRecipient() external view override returns (address) {
        return _excessFeeRecipient;
    }

    function getMaxFeeAmountUSD() external view override returns (uint256) {
        return _maxFeeAmountUSD;
    }

    function getMinPeriodUndisputed() external view override returns (uint32) {
        return _minPeriodUndisputed;
    }

    function getTippingTokens(uint256 _poolId)
        external
        view
        override
        returns (address[] memory)
    {
        return _poolIdToTippingTokens[_poolId];
    }

    function getTip(uint256 _poolId, address _tippingToken)
        external
        view
        override
        returns (uint256)
    {
        return _tips[_poolId][_tippingToken];
    }

    function getQueryId(uint256 _poolId)
        public
        view
        override
        returns (bytes32)
    {
        // Construct Tellor queryID
        // https://github.com/tellor-io/dataSpecs/blob/main/types/DIVAProtocolPolygon.md
        return
            keccak256(
                abi.encode(
                    "DIVAProtocol",
                    abi.encode(_poolId, address(_diva), block.chainid)
                )
            );
    }

    function getDIVAAddress() external view override returns (address) {
        return address(_diva);
    }

    function getReporter(uint256 _poolId)
        external
        view
        override
        returns (address)
    {
        return _poolIdToReporter[_poolId];
    }

    function _claimDIVAFee(uint256 _poolId) private {
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);
        _diva.claimFee(_params.collateralToken, _poolIdToReporter[_poolId]);
    }

    function _claimTips(uint256 _poolId, address[] calldata _tippingTokens)
        private
        onlyConfirmedPool(_poolId)
    {
        uint256 len = _tippingTokens.length;
        for (uint256 i = 0; i < len; ) {
            address _tippingToken = _tippingTokens[i];

            uint256 _tipAmount = _tips[_poolId][_tippingToken];
            _tips[_poolId][_tippingToken] = 0;

            IERC20Metadata(_tippingToken).safeTransfer(
                _poolIdToReporter[_poolId],
                _tipAmount
            );

            emit TipClaimed(
                _poolId,
                _poolIdToReporter[_poolId],
                _tippingToken,
                _tipAmount
            );

            unchecked {
                ++i;
            }
        }
    }

    function _setFinalReferenceValue(uint256 _poolId) private {
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId); // updated the Pool struct based on the latest contracts

        // Get queryId from poolId
        bytes32 _queryId = getQueryId(_poolId);

        // Find first oracle submission after or at expiryTime, if it exists
        (
            bytes memory _valueRetrieved,
            uint256 _timestampRetrieved
        ) = getDataAfter(_queryId, _params.expiryTime - 1);

        // Check that data exists (_timestampRetrieved = 0 if it doesn't)
        if (_timestampRetrieved == 0) {
            revert NoOracleSubmissionAfterExpiryTime();
        }

        // Check that _minPeriodUndisputed has passed after _timestampRetrieved
        if (block.timestamp - _timestampRetrieved < _minPeriodUndisputed) {
            revert MinPeriodUndisputedNotPassed();
        }

        // Format values (18 decimals)
        (
            uint256 _formattedFinalReferenceValue,
            uint256 _formattedCollateralToUSDRate
        ) = abi.decode(_valueRetrieved, (uint256, uint256));

        // Get address of reporter who will receive
        address _reporter = tellor.getReporterByTimestamp(
            _queryId,
            _timestampRetrieved
        );

        // Set reporter with pool id
        _poolIdToReporter[_poolId] = _reporter;

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
        uint256 feeClaim = _diva.getClaim(
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
        IDIVA.ArgsBatchTransferFeeClaim[]
            memory _feeClaimTransfers = new IDIVA.ArgsBatchTransferFeeClaim[](
                2
            );
        _feeClaimTransfers[0] = IDIVA.ArgsBatchTransferFeeClaim(
            _reporter,
            _params.collateralToken,
            feeToReporter
        );
        _feeClaimTransfers[1] = IDIVA.ArgsBatchTransferFeeClaim(
            _excessFeeRecipient,
            _params.collateralToken,
            feeToExcessRecipient
        );
        _diva.batchTransferFeeClaim(_feeClaimTransfers);

        emit FinalReferenceValueSet(
            _poolId,
            _formattedFinalReferenceValue,
            _params.expiryTime,
            _timestampRetrieved
        );
    }
}
