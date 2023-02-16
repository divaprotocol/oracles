// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./UsingTellor.sol";
import "./interfaces/IDIVAOracleTellor.sol";
import "./interfaces/IDIVA.sol";
import "./interfaces/IDIVAOwnershipShared.sol";
import "./libraries/SafeDecimalMath.sol";

contract DIVAOracleTellor is UsingTellor, IDIVAOracleTellor, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;
    using SafeDecimalMath for uint256;

    // Ordered to optimize storage
    mapping(uint256 => mapping(address => uint256)) private _tips; // mapping poolId => tipping token address => tip amount
    mapping(uint256 => address[]) private _poolIdToTippingTokens; // mapping poolId to tipping tokens
    mapping(uint256 => address) private _poolIdToReporter; // mapping poolId to reporter address
    mapping(address => uint256[]) private _reporterToPoolIds; // mapping reporter to poolIds

    address private _ownershipContract;
    uint256 private _maxFeeAmountUSD; // expressed as an integer with 18 decimals

    address private _previousExcessFeeRecipient;
    address private _excessFeeRecipient;
    uint256 private _startTimeExcessFeeRecipient;

    uint32 private _minPeriodUndisputed;
    bool private immutable _challengeable;
    IDIVA private immutable _diva;

    modifier onlyConfirmedPool(uint256 _poolId) {
        if (_poolIdToReporter[_poolId] == address(0)) {
            revert NotConfirmedPool();
        }
        _;
    }

    modifier onlyOwner() {
        address _owner = _contractOwner();
        if (msg.sender != _owner) {
            revert NotContractOwner(msg.sender, _owner);
        }
        _;
    }

    constructor(
        address ownershipContract_,
        address payable tellorAddress_,
        address excessFeeRecipient_,
        uint32 minPeriodUndisputed_,
        uint256 maxFeeAmountUSD_,
        address diva_
    ) UsingTellor(tellorAddress_) {
        if (ownershipContract_ == address(0)) {
            revert ZeroOwnershipContractAddress();
        }

        _ownershipContract = ownershipContract_;
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

    function claimReward(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAFee
    ) external override nonReentrant {
        _claimReward(_poolId, _tippingTokens, _claimDIVAFee);
    }

    function batchClaimReward(
        ArgsBatchClaimReward[] calldata _argsBatchClaimReward
    ) external override nonReentrant {
        uint256 _len = _argsBatchClaimReward.length;
        for (uint256 i = 0; i < _len; ) {
            _claimReward(
                _argsBatchClaimReward[i].poolId,
                _argsBatchClaimReward[i].tippingTokens,
                _argsBatchClaimReward[i].claimDIVAFee
            );

            unchecked {
                ++i;
            }
        }
    }

    function setFinalReferenceValue(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAFee
    ) external override nonReentrant {
        _setFinalReferenceValue(_poolId);
        _claimReward(_poolId, _tippingTokens, _claimDIVAFee);
    }

    function updateExcessFeeRecipient(address _newExcessFeeRecipient)
        external
        override
        onlyOwner
    {
        if (_newExcessFeeRecipient == address(0)) {
            revert ZeroExcessFeeRecipient();
        }

        // Confirm that there is no pending fallback data provider update.
        // Revoke to update pending value.
        if (_startTimeExcessFeeRecipient > block.timestamp) {
            revert PendingExcessFeeRecipientUpdate(
                block.timestamp,
                _startTimeExcessFeeRecipient
            );
        }

        // Store current excess fee recipient in `_previousExcessFeeRecipient`
        // variable
        _previousExcessFeeRecipient = _excessFeeRecipient;

        // Set time at which the new excess fee recipient will become applicable
        uint256 _startTimeNewExcessFeeRecipient = block.timestamp + 2 days;

        // Store start time and new excess fee recipient
        _startTimeExcessFeeRecipient = _startTimeNewExcessFeeRecipient;
        _excessFeeRecipient = _newExcessFeeRecipient;

        // Log the new fallback data provider as well as the address that
        // initiated the change
        emit ExcessFeeRecipientUpdated(
            msg.sender,
            _newExcessFeeRecipient,
            _startTimeNewExcessFeeRecipient
        );
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

    function getExcessFeeRecipientInfo()
        external
        view
        override
        returns (
            address previousExcessFeeRecipient,
            address excessFeeRecipient,
            uint256 startTimeExcessFeeRecipient
        )
    {
        (
            previousExcessFeeRecipient,
            excessFeeRecipient,
            startTimeExcessFeeRecipient
        ) = (
            _previousExcessFeeRecipient,
            _excessFeeRecipient,
            _startTimeExcessFeeRecipient
        );
    }

    function getMaxFeeAmountUSD() external view override returns (uint256) {
        return _maxFeeAmountUSD;
    }

    function getMinPeriodUndisputed() external view override returns (uint32) {
        return _minPeriodUndisputed;
    }

    function getTippingTokens(
        ArgsGetTippingTokens[] calldata _argsGetTippingTokens
    ) external view override returns (address[][] memory) {
        uint256 _len = _argsGetTippingTokens.length;
        address[][] memory _tippingTokens = new address[][](_len);
        for (uint256 i = 0; i < _len; ) {
            address[] memory _tippingTokensForPoolId = new address[](
                _argsGetTippingTokens[i].endIndex -
                    _argsGetTippingTokens[i].startIndex
            );
            for (
                uint256 j = _argsGetTippingTokens[i].startIndex;
                j < _argsGetTippingTokens[i].endIndex;

            ) {
                if (
                    j >=
                    _poolIdToTippingTokens[_argsGetTippingTokens[i].poolId]
                        .length
                ) {
                    _tippingTokensForPoolId[
                        j - _argsGetTippingTokens[i].startIndex
                    ] = address(0);
                } else {
                    _tippingTokensForPoolId[
                        j - _argsGetTippingTokens[i].startIndex
                    ] = _poolIdToTippingTokens[_argsGetTippingTokens[i].poolId][
                        j
                    ];
                }

                unchecked {
                    ++j;
                }
            }
            _tippingTokens[i] = _tippingTokensForPoolId;

            unchecked {
                ++i;
            }
        }
        return _tippingTokens;
    }

    function getTippingTokensLengthForPoolIds(uint256[] calldata _poolIds)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256 _len = _poolIds.length;
        uint256[] memory _tippingTokensLength = new uint256[](_len);
        for (uint256 i = 0; i < _len; ) {
            _tippingTokensLength[i] = _poolIdToTippingTokens[_poolIds[i]]
                .length;

            unchecked {
                ++i;
            }
        }
        return _tippingTokensLength;
    }

    function getTipAmounts(ArgsGetTipAmounts[] calldata _argsGetTipAmounts)
        external
        view
        override
        returns (uint256[][] memory)
    {
        uint256 _len = _argsGetTipAmounts.length;
        uint256[][] memory _tipAmounts = new uint256[][](_len);
        for (uint256 i = 0; i < _len; ) {
            uint256 _tippingTokensLen = _argsGetTipAmounts[i]
                .tippingTokens
                .length;
            uint256[] memory _tipAmountsForPoolId = new uint256[](
                _tippingTokensLen
            );
            for (uint256 j = 0; j < _tippingTokensLen; ) {
                _tipAmountsForPoolId[j] = _tips[_argsGetTipAmounts[i].poolId][
                    _argsGetTipAmounts[i].tippingTokens[j]
                ];

                unchecked {
                    ++j;
                }
            }

            _tipAmounts[i] = _tipAmountsForPoolId;

            unchecked {
                ++i;
            }
        }
        return _tipAmounts;
    }

    function getDIVAAddress() external view override returns (address) {
        return address(_diva);
    }

    function getReporters(uint256[] calldata _poolIds)
        external
        view
        override
        returns (address[] memory)
    {
        uint256 _len = _poolIds.length;
        address[] memory _reporters = new address[](_len);
        for (uint256 i = 0; i < _len; ) {
            _reporters[i] = _poolIdToReporter[_poolIds[i]];

            unchecked {
                ++i;
            }
        }
        return _reporters;
    }

    function getPoolIdsForReporters(
        ArgsGetPoolIdsForReporters[] calldata _argsGetPoolIdsForReporters
    ) external view override returns (uint256[][] memory) {
        uint256 _len = _argsGetPoolIdsForReporters.length;
        uint256[][] memory _poolIds = new uint256[][](_len);
        for (uint256 i = 0; i < _len; ) {
            uint256[] memory _poolIdsForReporter = new uint256[](
                _argsGetPoolIdsForReporters[i].endIndex -
                    _argsGetPoolIdsForReporters[i].startIndex
            );
            for (
                uint256 j = _argsGetPoolIdsForReporters[i].startIndex;
                j < _argsGetPoolIdsForReporters[i].endIndex;

            ) {
                if (
                    j >=
                    _reporterToPoolIds[_argsGetPoolIdsForReporters[i].reporter]
                        .length
                ) {
                    _poolIdsForReporter[
                        j - _argsGetPoolIdsForReporters[i].startIndex
                    ] = 0;
                } else {
                    _poolIdsForReporter[
                        j - _argsGetPoolIdsForReporters[i].startIndex
                    ] = _reporterToPoolIds[
                        _argsGetPoolIdsForReporters[i].reporter
                    ][j];
                }

                unchecked {
                    ++j;
                }
            }
            _poolIds[i] = _poolIdsForReporter;

            unchecked {
                ++i;
            }
        }
        return _poolIds;
    }

    function getPoolIdsLengthForReporters(address[] calldata _reporters)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256 _len = _reporters.length;
        uint256[] memory _poolIdsLength = new uint256[](_len);
        for (uint256 i = 0; i < _len; ) {
            _poolIdsLength[i] = _reporterToPoolIds[_reporters[i]].length;

            unchecked {
                ++i;
            }
        }
        return _poolIdsLength;
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

    function _getCurrentExcessFeeRecipient() internal view returns (address) {
        // Return the new excess fee recipient if `block.timestamp` is at or
        // past the activation time, else return the current excess fee
        // recipient
        return
            block.timestamp < _startTimeExcessFeeRecipient
                ? _previousExcessFeeRecipient
                : _excessFeeRecipient;
    }

    function _contractOwner() internal view returns (address) {
        return IDIVAOwnershipShared(_ownershipContract).getCurrentOwner();
    }

    function _claimReward(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAFee
    ) private onlyConfirmedPool(_poolId) {
        uint256 _len = _tippingTokens.length;
        for (uint256 i = 0; i < _len; ) {
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

        if (_claimDIVAFee) {
            IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);
            _diva.claimFee(_params.collateralToken, _poolIdToReporter[_poolId]);
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
        _reporterToPoolIds[_reporter].push(_poolId);

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
            _getCurrentExcessFeeRecipient(),
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
