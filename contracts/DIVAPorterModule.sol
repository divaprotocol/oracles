// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IDIVAPorterModule.sol";
import "./interfaces/IBond.sol";
import "./interfaces/IBondFactory.sol";
import "./interfaces/IDIVA.sol";

contract DIVAPorterModule is IDIVAPorterModule, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;

    // Mapping to check if pool is settled already
    mapping(uint256 => bool) public poolIsSettled;

    bool private immutable _challengeable;
    address private _bondFactoryAddress;

    constructor(address bondFactoryAddress_) {
        _challengeable = false;
        _bondFactoryAddress = bondFactoryAddress_;
    }

    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId)
        external
        override
        nonReentrant
    {
        require(
            !poolIsSettled[_poolId],
            "DIVAPorterModule: pool is already settled"
        );

        // Connect to DIVA contract and extract pool parameters based on `_poolId`
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        // Connect to Porter Bond contract based on the address stored in the
        // referenceAsset field
        string memory _porterBond = _params.referenceAsset;
        IBond _bond = IBond(_stringToAddress(_porterBond));

        uint256 _amountUnpaid = _bond.amountUnpaid();

        // Get scaling factor as DIVA Protocol expects the final reference value
        // to be expressed as an integer with 18 decimals, but payment token
        // may have less decimals
        uint256 _SCALING = uint256(
            10**(18 - IERC20Metadata(_bond.paymentToken()).decimals())
        );

        // Update poolIsSettled storage variable external contract interactions
        poolIsSettled[_poolId] = true;

        // Forward final value to DIVA contract. Allocates the settlement fee as part of
        // that process to this contract.
        _diva.setFinalReferenceValue(
            _poolId,
            _amountUnpaid * _SCALING, // formatted value (18 decimals)
            _challengeable
        );

        // Get the current fee claim allocated to this contract address (msg.sender)
        uint256 feeClaim = _diva.getClaim(
            _params.collateralToken,
            address(this)
        );

        // Transfer fee claim to the first reporter who is calling the function
        _diva.transferFeeClaim(msg.sender, _params.collateralToken, feeClaim);
    }

    function createContingentPool(
        address _divaDiamond,
        PorterPoolParams calldata _porterPoolParams
    ) external override nonReentrant returns (uint256) {
        IBondFactory _bondFactory = IBondFactory(_bondFactoryAddress);
        address _porterBond = _porterPoolParams.referenceAsset;

        // Check if Bond address is valid from Bond factory contract
        require(
            _bondFactory.isBond(_porterBond),
            "DIVAPorterModule: invalid Bond address"
        );

        IBond _bond = IBond(_porterBond);
        uint256 gracePeriodEnd = _bond.gracePeriodEnd();
        uint256 bondTotalSupply = IERC20Metadata(_porterBond).totalSupply();

        // Set allowance for collateral token
        IERC20Metadata collateralToken = IERC20Metadata(
            _porterPoolParams.collateralToken
        );
        collateralToken.approve(
            _divaDiamond,
            _porterPoolParams.collateralAmount
        );

        // Transfer approved collateral tokens from user to DIVAPorterModule contract
        collateralToken.safeTransferFrom(
            msg.sender,
            address(this),
            _porterPoolParams.collateralAmount
        );

        IDIVA.PoolParams memory _poolParams;
        _poolParams.referenceAsset = _addressToString(_porterBond);
        _poolParams.expiryTime = uint96(gracePeriodEnd);
        _poolParams.floor = 0;
        _poolParams.inflection = _porterPoolParams.inflection;
        _poolParams.cap = bondTotalSupply;
        _poolParams.gradient = _porterPoolParams.gradient;
        _poolParams.collateralAmount = _porterPoolParams.collateralAmount;
        _poolParams.collateralToken = _porterPoolParams.collateralToken;
        _poolParams.dataProvider = address(this);
        _poolParams.capacity = _porterPoolParams.capacity;
        _poolParams.longRecipient = _porterPoolParams.longRecipient;
        _poolParams.shortRecipient = _porterPoolParams.shortRecipient;
        _poolParams.permissionedERC721Token = _porterPoolParams
            .permissionedERC721Token;

        IDIVA _diva = IDIVA(_divaDiamond);
        uint256 _poolId = _diva.createContingentPool(_poolParams);

        return _poolId;
    }

    function setBondFactoryAddress(address _newBondFactoryAddress)
        external
        override
        onlyOwner
    {
        _bondFactoryAddress = _newBondFactoryAddress;
    }

    function getChallengeable() external view override returns (bool) {
        return _challengeable;
    }

    function getBondFactoryAddress() external view override returns (address) {
        return _bondFactoryAddress;
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
