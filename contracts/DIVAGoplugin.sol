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

    address private immutable _ownershipContract;
    bool private immutable _challengeable;
    IDIVA private immutable _diva;
    IERC20Metadata private immutable _pli;

    uint32 private constant MIN_PERIOD_UNDISPUTED = 12 hours;
    uint256 private constant FEE_PER_REQUEST = 0.1 * 10**18;

    modifier onlyOwner() {
        address _owner = _contractOwner();
        if (msg.sender != _owner) {
            revert NotContractOwner(msg.sender, _owner);
        }
        _;
    }

    constructor(
        address ownershipContract_,
        address diva_,
        address pli_
    ) {
        if (ownershipContract_ == address(0)) {
            revert ZeroOwnershipContractAddress();
        }
        if (pli_ == address(0)) {
            revert ZeroPLIAddress();
        }

        _ownershipContract = ownershipContract_;
        _challengeable = false;
        _diva = IDIVA(diva_);
        _pli = IERC20Metadata(pli_);
    }

    function requestFinalReferenceValue(uint256 _poolId)
        external
        returns (bytes32)
    {
        _pli.safeTransferFrom(msg.sender, address(this), FEE_PER_REQUEST);

        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);
        bytes32 _requestId = IInvokeOracle(
            _stringToAddress(_params.referenceAsset)
        ).requestData({_caller: msg.sender});

        _lastRequestedBlocktimestamps[_poolId] = block.timestamp;
        _poolIdToRequester[_poolId] = msg.sender;

        return _requestId;
    }

    function setFinalReferenceValue(uint256 _poolId)
        external
        override
        nonReentrant
    {
        _setFinalReferenceValue(_poolId);
    }

    function getChallengeable() external view override returns (bool) {
        return _challengeable;
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

    function getOwnershipContract() external view override returns (address) {
        return _ownershipContract;
    }

    function getMinPeriodUndisputed() external pure override returns (uint32) {
        return MIN_PERIOD_UNDISPUTED;
    }

    function _contractOwner() internal view returns (address) {
        return IDIVAOwnershipShared(_ownershipContract).getCurrentOwner();
    }

    function _setFinalReferenceValue(uint256 _poolId) private {
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        uint256 _lastRequestedBlocktimestamp = _lastRequestedBlocktimestamps[
            _poolId
        ];

        // Check that data exists (_lastRequestedBlocktimestamp = 0 if it doesn't)
        if (_lastRequestedBlocktimestamp == 0) {
            revert NoOracleSubmissionAfterExpiryTime();
        }

        // Check that `MIN_PERIOD_UNDISPUTED` has passed after _lastRequestedBlocktimestamp
        if (
            block.timestamp - _lastRequestedBlocktimestamp <
            MIN_PERIOD_UNDISPUTED
        ) {
            revert MinPeriodUndisputedNotPassed();
        }

        // Format values (18 decimals)
        uint256 _formattedFinalReferenceValue = IInvokeOracle(
            _stringToAddress(_params.referenceAsset)
        ).showPrice();

        // Forward final value to DIVA contract. Allocates the fee as part of that process.
        _diva.setFinalReferenceValue(
            _poolId,
            _formattedFinalReferenceValue,
            _challengeable
        );

        // Transfer fee claim to requester
        _diva.transferFeeClaim(
            _poolIdToRequester[_poolId],
            _params.collateralToken,
            _diva.getClaim(_params.collateralToken, address(this))
        );

        emit FinalReferenceValueSet(
            _poolId,
            _formattedFinalReferenceValue,
            _params.expiryTime,
            _lastRequestedBlocktimestamp
        );
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
