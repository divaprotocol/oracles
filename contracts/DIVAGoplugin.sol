// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IDIVAGoplugin} from "./interfaces/IDIVAGoplugin.sol";
import {IDIVA} from "./interfaces/IDIVA.sol";
import {IDIVAOwnershipShared} from "./interfaces/IDIVAOwnershipShared.sol";
import {IInvokeOracle} from "./interfaces/IInvokeOracle.sol";
import {SafeDecimalMath} from "./libraries/SafeDecimalMath.sol";

contract DIVAGoplugin is IDIVAGoplugin, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;
    using SafeDecimalMath for uint256;

    // mapping `poolId` to last requested blocktimestamp
    mapping(uint256 => uint256) private _lastRequestedBlocktimestamps;

    bool private immutable _challengeable;
    IDIVA private immutable _diva;

    modifier onlyOwner() {
        address _owner = _diva.getOwner();
        if (msg.sender != _owner) {
            revert NotContractOwner(msg.sender, _owner);
        }
        _;
    }

    constructor(address diva_) {
        if (diva_ == address(0)) {
            revert ZeroDIVAAddress();
        }

        _challengeable = false;
        _diva = IDIVA(diva_);
    }

    function requestFinalReferenceValue(
        uint256 _poolId
    ) external override returns (bytes32) {
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);
        if (_params.statusFinalReferenceValue == IDIVA.Status.Confirmed) {
            revert AlreadyConfirmedPool();
        }

        bytes32 _requestId = IInvokeOracle(
            _stringToAddress(_params.referenceAsset)
        ).requestData({_caller: msg.sender});
        _lastRequestedBlocktimestamps[_poolId] = block.timestamp;

        emit FinalReferenceValueRequested(_poolId, block.timestamp);

        return _requestId;
    }

    function setFinalReferenceValue(
        uint256 _poolId
    ) external override nonReentrant {
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        uint256 _lastRequestedBlocktimestamp = _lastRequestedBlocktimestamps[
            _poolId
        ];

        // Check that final reference value is requested and requested in the
        // previous block or not
        if (
            _lastRequestedBlocktimestamp == 0 ||
            block.timestamp == _lastRequestedBlocktimestamp
        ) {
            revert FinalReferenceValueNotRequested();
        }

        // Format values (18 decimals)
        uint256 _formattedFinalReferenceValue = IInvokeOracle(
            _stringToAddress(_params.referenceAsset)
        ).showPrice() * 10 ** 14;

        // Forward final value to DIVA contract.
        //Allocates the fee as part of that process.
        _diva.setFinalReferenceValue(
            _poolId,
            _formattedFinalReferenceValue,
            _challengeable
        );

        emit FinalReferenceValueSet(
            _poolId,
            _formattedFinalReferenceValue,
            _params.expiryTime,
            _lastRequestedBlocktimestamp
        );
    }

    function getChallengeable() external view override returns (bool) {
        return _challengeable;
    }

    function getDIVAAddress() external view override returns (address) {
        return address(_diva);
    }

    function getLastRequestedBlocktimestamp(
        uint256 _poolId
    ) external view override returns (uint256) {
        return _lastRequestedBlocktimestamps[_poolId];
    }

    function getGopluginValue(
        uint256 _poolId
    ) external view override returns (uint256) {
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        return
            IInvokeOracle(_stringToAddress(_params.referenceAsset))
                .showPrice() * 10 ** 14;
    }

    /**
     * @notice Function to convert string to address.
     */
    function _stringToAddress(
        string memory _a
    ) internal pure returns (address) {
        bytes memory tmp = bytes(_a);
        require(tmp.length == 42, "DIVAGoplugin: invalid address");
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint256 i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if (b1 >= 97 && b1 <= 102) b1 -= 87;
            else if (b1 >= 65 && b1 <= 70) b1 -= 55;
            else if (b1 >= 48 && b1 <= 57) b1 -= 48;
            if (b2 >= 97 && b2 <= 102) b2 -= 87;
            else if (b2 >= 65 && b2 <= 70) b2 -= 55;
            else if (b2 >= 48 && b2 <= 57) b2 -= 48;
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }
}
