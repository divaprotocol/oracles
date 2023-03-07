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

    uint256 private _previousMaxFeeAmountUSD; // expressed as an integer with 18 decimals, initialized to zero at contract deployment
    uint256 private _maxFeeAmountUSD; // expressed as an integer with 18 decimals
    uint256 private _startTimeMaxFeeAmountUSD;

    address private _previousExcessFeeRecipient; // initialized to zero address at contract deployment
    address private _excessFeeRecipient;
    uint256 private _startTimeExcessFeeRecipient;

    address private immutable _ownershipContract;
    bool private immutable _challengeable;
    IDIVA private immutable _diva;

    uint256 private constant _activationDelay = 3 days;
    uint32 private constant _minPeriodUndisputed = 12 hours;

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
        uint256 maxFeeAmountUSD_,
        address diva_
    ) UsingTellor(tellorAddress_) {
        if (ownershipContract_ == address(0)) {
            revert ZeroOwnershipContractAddress();
        }
        if (excessFeeRecipient_ == address(0)) {
            revert ZeroExcessFeeRecipient();
        }

        _ownershipContract = ownershipContract_;
        _challengeable = false;
        _excessFeeRecipient = excessFeeRecipient_;
        _maxFeeAmountUSD = maxFeeAmountUSD_;
        _diva = IDIVA(diva_);
    }

    // @todo add batch version of setFinalReferenceValue

    // @todo add test for batch function
    function addTip(
        uint256 _poolId,
        uint256 _amount,
        address _tippingToken
    ) external override nonReentrant {
        _addTip(_poolId, _amount, _tippingToken);
    }
    
    function _addTip(
        uint256 _poolId,
        uint256 _amount,
        address _tippingToken
    ) private {
        // Confirm that the final value hasn't been submitted to DIVA Protocol yet,
        // in which case `_poolIdToReporter` would resolve to the zero address.
        if (_poolIdToReporter[_poolId] != address(0)) {
            revert AlreadyConfirmedPool();
        }

        // Add a new entry in the `_poolIdToTippingTokens` array if the specified
        //`_tippingToken` does not yet exist for the specified pool. 
        if (_tips[_poolId][_tippingToken] == 0) {
            _poolIdToTippingTokens[_poolId].push(_tippingToken);
        }

        // Follow the CEI pattern by updating the balance before doing a potentially
        // unsafe `safeTransferFrom` call.
        _tips[_poolId][_tippingToken] += _amount;

        // Transfer tipping token from `msg.sender` to this contract.
        IERC20Metadata(_tippingToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        // Log event including tipped pool, amount and tipper address.
        emit TipAdded(_poolId, _tippingToken, _amount, msg.sender);
    }

    // @todo add test
    function batchAddTip(
        ArgsBatchAddTip[] calldata _argsBatchAddTip
    ) external override nonReentrant {
        uint256 _len = _argsBatchAddTip.length;
        for (uint256 i = 0; i < _len; ) {
            _addTip(
                _argsBatchAddTip[i].poolId,
                _argsBatchAddTip[i].amount,
                _argsBatchAddTip[i].tippingToken
            );

            unchecked {
                ++i;
            }
        }
    }

    function claimReward(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAReward
    ) external override nonReentrant {
        _claimReward(_poolId, _tippingTokens, _claimDIVAReward);
    }

    function batchClaimReward(
        ArgsBatchClaimReward[] calldata _argsBatchClaimReward
    ) external override nonReentrant {
        uint256 _len = _argsBatchClaimReward.length;
        for (uint256 i = 0; i < _len; ) {
            _claimReward(
                _argsBatchClaimReward[i].poolId,
                _argsBatchClaimReward[i].tippingTokens,
                _argsBatchClaimReward[i].claimDIVAReward
            );

            unchecked {
                ++i;
            }
        }
    }

    function setFinalReferenceValue(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAReward
    ) external override nonReentrant {
        _setFinalReferenceValue(_poolId);
        _claimReward(_poolId, _tippingTokens, _claimDIVAReward);
    }

    // @todo add test
    function batchSetFinalReferenceValue(
        ArgsBatchSetFinalReferenceValue[] calldata _argsBatchSetFinalReferenceValue
    ) external override nonReentrant {
        uint256 _len = _argsBatchSetFinalReferenceValue.length;
        for (uint256 i = 0; i < _len; ) {
            _setFinalReferenceValue(_argsBatchSetFinalReferenceValue[i].poolId);
            _claimReward(
                _argsBatchSetFinalReferenceValue[i].poolId,
                _argsBatchSetFinalReferenceValue[i].tippingTokens,
                _argsBatchSetFinalReferenceValue[i].claimDIVAReward
            );

            unchecked {
                ++i;
            }
        }
    }

    function updateExcessFeeRecipient(address _newExcessFeeRecipient)
        external
        override
        onlyOwner
    {
        // Confirm that provided excess fee recipient address
        // is not zero address
        if (_newExcessFeeRecipient == address(0)) {
            revert ZeroExcessFeeRecipient();
        }

        // Confirm that there is no pending excess fee recipient update.
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
        uint256 _startTimeNewExcessFeeRecipient = block.timestamp +
            _activationDelay;

        // Store start time and new excess fee recipient
        _startTimeExcessFeeRecipient = _startTimeNewExcessFeeRecipient;
        _excessFeeRecipient = _newExcessFeeRecipient;

        // Log the new excess fee recipient as well as the address that
        // initiated the change
        emit ExcessFeeRecipientUpdated(
            msg.sender,
            _newExcessFeeRecipient,
            _startTimeNewExcessFeeRecipient
        );
    }

    function updateMaxFeeAmountUSD(uint256 _newMaxFeeAmountUSD)
        external
        override
        onlyOwner
    {
        // Confirm that there is no pending max fee amount USD update.
        // Revoke to update pending value.
        if (_startTimeMaxFeeAmountUSD > block.timestamp) {
            revert PendingMaxFeeAmountUSDUpdate(
                block.timestamp,
                _startTimeMaxFeeAmountUSD
            );
        }

        // Store current max fee amount USD in `_previousMaxFeeAmountUSD`
        // variable
        _previousMaxFeeAmountUSD = _maxFeeAmountUSD;

        // Set time at which the new max fee amount USD will become applicable
        uint256 _startTimeNewMaxFeeAmountUSD = block.timestamp +
            _activationDelay;

        // Store start time and new max fee amount USD
        _startTimeMaxFeeAmountUSD = _startTimeNewMaxFeeAmountUSD;
        _maxFeeAmountUSD = _newMaxFeeAmountUSD;

        // Log the new max fee amount USD as well as the address that
        // initiated the change
        emit MaxFeeAmountUSDUpdated(
            msg.sender,
            _newMaxFeeAmountUSD,
            _startTimeNewMaxFeeAmountUSD
        );
    }

    function revokePendingExcessFeeRecipientUpdate()
        external
        override
        onlyOwner
    {
        // Confirm that new excess fee recipient is not active yet
        if (_startTimeExcessFeeRecipient <= block.timestamp) {
            revert ExcessFeeRecipientAlreadyActive(
                block.timestamp,
                _startTimeExcessFeeRecipient
            );
        }

        // Store `_excessFeeRecipient` value temporarily
        address _revokedExcessFeeRecipient = _excessFeeRecipient;

        // Reset excess fee recipient related variables
        _startTimeExcessFeeRecipient = block.timestamp;
        _excessFeeRecipient = _previousExcessFeeRecipient;

        // Log the excess fee recipient revoked, the previous one that now
        // applies as well as the address that initiated the change
        emit PendingExcessFeeRecipientUpdateRevoked(
            msg.sender,
            _revokedExcessFeeRecipient,
            _previousExcessFeeRecipient
        );
    }

    function revokePendingMaxFeeAmountUSDUpdate() external override onlyOwner {
        // Confirm that new max USD fee amount is not active yet
        if (_startTimeMaxFeeAmountUSD <= block.timestamp) {
            revert MaxFeeAmountUSDAlreadyActive(
                block.timestamp,
                _startTimeMaxFeeAmountUSD
            );
        }

        // Store `_maxFeeAmountUSD` value temporarily
        uint256 _revokedMaxFeeAmountUSD = _maxFeeAmountUSD;

        // Reset max fee amount USD related variables
        _startTimeMaxFeeAmountUSD = block.timestamp;
        _maxFeeAmountUSD = _previousMaxFeeAmountUSD;

        // Log the max fee amount USD revoked, the previous one that now
        // applies as well as the address that initiated the change
        emit PendingMaxFeeAmountUSDUpdateRevoked(
            msg.sender,
            _revokedMaxFeeAmountUSD,
            _previousMaxFeeAmountUSD
        );
    }

    function getChallengeable() external view override returns (bool) {
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

    function getMaxFeeAmountUSDInfo()
        external
        view
        override
        returns (
            uint256 previousMaxFeeAmountUSD,
            uint256 maxFeeAmountUSD,
            uint256 startTimeMaxFeeAmountUSD
        )
    {
        (previousMaxFeeAmountUSD, maxFeeAmountUSD, startTimeMaxFeeAmountUSD) = (
            _previousMaxFeeAmountUSD,
            _maxFeeAmountUSD,
            _startTimeMaxFeeAmountUSD
        );
    }

    function getMinPeriodUndisputed() external pure override returns (uint32) {
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

    function getOwnershipContract() external view override returns (address) {
        return _ownershipContract;
    }

    function getActivationDelay() external pure override returns (uint256) {
        return _activationDelay;
    }

    // @todo rename in tests
    function getQueryDataAndId(uint256 _poolId)
        public
        view
        override
        returns (bytes memory queryData, bytes32 queryId)
    {
        // Construct Tellor query data
        queryData = 
                abi.encode(
                    "DIVAProtocol",
                    abi.encode(_poolId, address(_diva), block.chainid)
                );

        // Construct Tellor queryId
        queryId = keccak256(queryData);
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

    function _getCurrentMaxFeeAmountUSD() internal view returns (uint256) {
        // Return the new max fee amount USD if `block.timestamp` is at or past
        // the activation time, else return the current max fee amount USD
        return
            block.timestamp < _startTimeMaxFeeAmountUSD
                ? _previousMaxFeeAmountUSD
                : _maxFeeAmountUSD;
    }

    function _contractOwner() internal view returns (address) {
        return IDIVAOwnershipShared(_ownershipContract).getCurrentOwner();
    }

    function _claimReward(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAReward
    ) private {
        // Check that the pool has already been confirmed. The `_poolIdToReporter`
        // value is set during `setFinalReferenceValue`
        if (_poolIdToReporter[_poolId] == address(0)) {
            revert NotConfirmedPool();
        }

        // Iterate over the provided `_tippingTokens` array. Will skip the for
        // loop if no tipping tokens have been provided.
        uint256 _len = _tippingTokens.length;
        for (uint256 i = 0; i < _len; ) {
            address _tippingToken = _tippingTokens[i];

            // Get tip amount for pool and tipping token.
            uint256 _tipAmount = _tips[_poolId][_tippingToken];

            // Set tip amount to zero to prevent multiple payouts in the event that 
            // the same tipping token is provided multiple times.
            _tips[_poolId][_tippingToken] = 0;

            // Transfer tip from `this` to eligible reporter.
            IERC20Metadata(_tippingToken).safeTransfer(
                _poolIdToReporter[_poolId],
                _tipAmount
            );

            // Log event for each tipping token claimed
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

        // Claim DIVA reward if indicated in the function call. Alternatively,
        // DIVA rewards can be claimed from the DIVA smart contract directly.
        if (_claimDIVAReward) {
            IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);
            _diva.claimFee(_params.collateralToken, _poolIdToReporter[_poolId]);
        }
    }

    function _setFinalReferenceValue(uint256 _poolId) private {
        // Load pool information from the DIVA smart contract.
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        // Get queryId from poolId for the value look-up inside the Tellor contract.
        (, bytes32 _queryId) = getQueryDataAndId(_poolId);

        // Find first oracle submission after or at expiryTime, if it exists.
        (
            bytes memory _valueRetrieved,
            uint256 _timestampRetrieved
        ) = getDataAfter(_queryId, _params.expiryTime);

        // Check that data exists (_timestampRetrieved = 0 if it doesn't).
        if (_timestampRetrieved == 0) {
            revert NoOracleSubmissionAfterExpiryTime();
        }

        // Check that `_minPeriodUndisputed` has passed after `_timestampRetrieved`.
        if (block.timestamp - _timestampRetrieved < _minPeriodUndisputed) {
            revert MinPeriodUndisputedNotPassed();
        }

        // Format values (18 decimals)
        (
            uint256 _formattedFinalReferenceValue,
            uint256 _formattedCollateralToUSDRate
        ) = abi.decode(_valueRetrieved, (uint256, uint256));

        // Get address of reporter who will receive
        address _reporter = getReporterByTimestamp(
            _queryId,
            _timestampRetrieved
        );

        // Set reporter with poolId
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

        uint256 _currentMaxFeeAmountUSD = _getCurrentMaxFeeAmountUSD();
        if (feeClaimUSD > _currentMaxFeeAmountUSD) {
            // if _formattedCollateralToUSDRate = 0, then feeClaimUSD = 0 in
            // which case it will go into the else part, hence division by zero
            // is not a problem
            feeToReporter =
                _currentMaxFeeAmountUSD.divideDecimal(
                    _formattedCollateralToUSDRate
                ) /
                _SCALING; // integer with collateral token decimals
        } else {
            feeToReporter = feeClaim;
        }

        // Transfer fee claim to reporter and excessFeeRecipient. Note that the
        // transfer takes place internally inside the DIVA smart contract and the
        // reward has to be claimed separately either by setting the `_claimDIVAReward`
        // parameter to `true` or later by calling the `claimReward` function. 
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
            feeClaim - feeToReporter // integer with collateral token decimals
        );
        _diva.batchTransferFeeClaim(_feeClaimTransfers);

        // Log event including reported information
        emit FinalReferenceValueSet(
            _poolId,
            _formattedFinalReferenceValue,
            _params.expiryTime,
            _timestampRetrieved
        );
    }
}
