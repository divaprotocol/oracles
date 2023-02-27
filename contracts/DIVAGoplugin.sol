// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IDIVAGoplugin.sol";
import "./interfaces/IDIVA.sol";
import "./interfaces/IDIVAOwnershipShared.sol";
import "./interfaces/IInvokeOracle.sol";
import "./libraries/SafeDecimalMath.sol";

contract DIVAGoplugin is IDIVAGoplugin, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;
    using SafeDecimalMath for uint256;

    // Ordered to optimize storage
    mapping(uint256 => uint256) private _lastRequestedBlocktimestamps; // mapping `poolId` to last requested blocktimestamp
    mapping(uint256 => address) private _poolIdToRequester; // mapping poolId to requester address
    mapping(address => address) private _tokenToGopluginFeedAddr; // mapping collateral token to Goplugin feed address

    mapping(address => uint256[]) private _requesterToPoolIds; // mapping requester to poolIds

    uint256 private _previousMaxFeeAmountUSD; // expressed as an integer with 18 decimals, initialized to zero at contract deployment
    uint256 private _maxFeeAmountUSD; // expressed as an integer with 18 decimals
    uint256 private _startTimeMaxFeeAmountUSD;

    address private _previousExcessFeeRecipient; // initialized to zero address at contract deployment
    address private _excessFeeRecipient;
    uint256 private _startTimeExcessFeeRecipient;

    address private _ownershipContract;
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
        address excessFeeRecipient_,
        uint256 maxFeeAmountUSD_,
        address diva_
    ) {
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

    function requestFinalReferenceValue(uint256 _poolId)
        external
        returns (bytes32)
    {
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        bytes32 _requestId = IInvokeOracle(
            _stringToAddress(_params.referenceAsset)
        ).requestData({_caller: msg.sender});
        return _requestId;
    }

    function setFinalReferenceValue(uint256 _poolId)
        external
        override
        nonReentrant
    {
        _setFinalReferenceValue(_poolId);
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

    function getDIVAAddress() external view override returns (address) {
        return address(_diva);
    }

    function getRequesters(uint256[] calldata _poolIds)
        external
        view
        override
        returns (address[] memory)
    {
        uint256 _len = _poolIds.length;
        address[] memory _requesters = new address[](_len);
        for (uint256 i = 0; i < _len; ) {
            _requesters[i] = _poolIdToRequester[_poolIds[i]];

            unchecked {
                ++i;
            }
        }
        return _requesters;
    }

    function getPoolIdsForRequesters(
        ArgsGetPoolIdsForRequesters[] calldata _argsGetPoolIdsForRequesters
    ) external view override returns (uint256[][] memory) {
        uint256 _len = _argsGetPoolIdsForRequesters.length;
        uint256[][] memory _poolIds = new uint256[][](_len);
        for (uint256 i = 0; i < _len; ) {
            uint256[] memory _poolIdsForRequester = new uint256[](
                _argsGetPoolIdsForRequesters[i].endIndex -
                    _argsGetPoolIdsForRequesters[i].startIndex
            );
            for (
                uint256 j = _argsGetPoolIdsForRequesters[i].startIndex;
                j < _argsGetPoolIdsForRequesters[i].endIndex;

            ) {
                if (
                    j >=
                    _requesterToPoolIds[
                        _argsGetPoolIdsForRequesters[i].requester
                    ].length
                ) {
                    _poolIdsForRequester[
                        j - _argsGetPoolIdsForRequesters[i].startIndex
                    ] = 0;
                } else {
                    _poolIdsForRequester[
                        j - _argsGetPoolIdsForRequesters[i].startIndex
                    ] = _requesterToPoolIds[
                        _argsGetPoolIdsForRequesters[i].requester
                    ][j];
                }

                unchecked {
                    ++j;
                }
            }
            _poolIds[i] = _poolIdsForRequester;

            unchecked {
                ++i;
            }
        }
        return _poolIds;
    }

    function getPoolIdsLengthForRequesters(address[] calldata _requesters)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256 _len = _requesters.length;
        uint256[] memory _poolIdsLength = new uint256[](_len);
        for (uint256 i = 0; i < _len; ) {
            _poolIdsLength[i] = _requesterToPoolIds[_requesters[i]].length;

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

    function _setFinalReferenceValue(uint256 _poolId) private {
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId); // updated the Pool struct based on the latest contracts

        uint256 _lastRequestedBlocktimestamp = _lastRequestedBlocktimestamps[
            _poolId
        ];

        // Check that data exists (_lastRequestedBlocktimestamp = 0 if it doesn't)
        if (_lastRequestedBlocktimestamp == 0) {
            revert NoOracleSubmissionAfterExpiryTime();
        }

        // Check that _minPeriodUndisputed has passed after _lastRequestedBlocktimestamp
        if (
            block.timestamp - _lastRequestedBlocktimestamp <
            _minPeriodUndisputed
        ) {
            revert MinPeriodUndisputedNotPassed();
        }

        // Format values (18 decimals)
        uint256 _formattedFinalReferenceValue = IInvokeOracle(
            _stringToAddress(_params.referenceAsset)
        ).showPrice();
        uint256 _formattedCollateralToUSDRate = IInvokeOracle(
            _tokenToGopluginFeedAddr[_params.collateralToken]
        ).showPrice();

        // Get address of requester who will receive
        address _requester = _poolIdToRequester[_poolId];

        // Set requester with pool id
        // _poolIdToRequester[_poolId] = _requester;
        // _requesterToPoolIds[_requester].push(_poolId);

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
        uint256 feeToRequester;

        uint256 _currentMaxFeeAmountUSD = _getCurrentMaxFeeAmountUSD();
        if (feeClaimUSD > _currentMaxFeeAmountUSD) {
            // if _formattedCollateralToUSDRate = 0, then feeClaimUSD = 0 in
            // which case it will go into the else part, hence division by zero
            // is not a problem
            feeToRequester =
                _currentMaxFeeAmountUSD.divideDecimal(
                    _formattedCollateralToUSDRate
                ) /
                _SCALING; // integer with collateral token decimals
        } else {
            feeToRequester = feeClaim;
        }

        // Transfer fee claim to requester and excessFeeRecipient
        IDIVA.ArgsBatchTransferFeeClaim[]
            memory _feeClaimTransfers = new IDIVA.ArgsBatchTransferFeeClaim[](
                2
            );
        _feeClaimTransfers[0] = IDIVA.ArgsBatchTransferFeeClaim(
            _requester,
            _params.collateralToken,
            feeToRequester
        );
        _feeClaimTransfers[1] = IDIVA.ArgsBatchTransferFeeClaim(
            _getCurrentExcessFeeRecipient(),
            _params.collateralToken,
            feeClaim - feeToRequester // integer with collateral token decimals
        );
        _diva.batchTransferFeeClaim(_feeClaimTransfers);

        emit FinalReferenceValueSet(
            _poolId,
            _formattedFinalReferenceValue,
            _params.expiryTime,
            _lastRequestedBlocktimestamp
        );
    }

    /**
     * @notice Function to convert address to string.
     */
    function _addressToString(address _addr)
        internal
        pure
        returns (string memory)
    {
        bytes32 _bytes = bytes32(uint256(uint160(_addr)));
        bytes memory _hex = "0123456789abcdef";

        bytes memory _string = new bytes(42);
        _string[0] = "0";
        _string[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            _string[2 + i * 2] = _hex[uint256(uint8(_bytes[i + 12] >> 4))];
            _string[3 + i * 2] = _hex[uint256(uint8(_bytes[i + 12] & 0x0f))];
        }
        return string(_string);
    }

    /**
     * @notice Function to convert string to address.
     */
    function _stringToAddress(string memory _a)
        internal
        pure
        returns (address)
    {
        bytes memory tmp = bytes(_a);
        require(tmp.length == 42, "DIVAPorterModule: invalid address");
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint256 i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) b1 -= 87;
            else if ((b1 >= 48) && (b1 <= 57)) b1 -= 48;
            if ((b2 >= 97) && (b2 <= 102)) b2 -= 87;
            else if ((b2 >= 48) && (b2 <= 57)) b2 -= 48;
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }
}
