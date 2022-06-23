// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IDIVAPorterModule.sol";
import "./interfaces/IBond.sol";
import "./interfaces/IDIVA.sol";

contract DIVAPorterModule is IDIVAPorterModule, Ownable, ReentrancyGuard {
    // Mapping to check if pool is settled already
    mapping(uint256 => bool) public poolIsSettled;

    // Ordered to optimize storage
    bool private immutable _challengeable;

    constructor() {
        _challengeable = false;
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

        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId);

        string memory _porterBond = _params.referenceAsset;
        IBond _bond = IBond(stringToAddress(_porterBond));

        uint256 _amountUnpaid = _bond.amountUnpaid();
        uint256 _SCALING = uint256(
            10**(18 - IERC20Metadata(_bond.paymentToken()).decimals())
        );

        // Forward final value to DIVA contract. Allocates the fee as part of that process.
        _diva.setFinalReferenceValue(
            _poolId,
            _amountUnpaid * _SCALING, // formatted value (18 decimals)
            _challengeable
        );

        // Get the current fee claim allocated to this contract address (msg.sender)
        uint256 feeClaim = _diva.getClaims(
            _params.collateralToken,
            address(this)
        );

        // Transfer fee claim to the first reporter who is calling the function
        _diva.transferFeeClaim(msg.sender, _params.collateralToken, feeClaim);

        // Set poolIsSettles as True
        poolIsSettled[_poolId] = true;
    }

    function createContingentPool(
        address _divaDiamond,
        PorterPoolParams calldata _porterPoolParams
    ) external override nonReentrant returns (uint256) {
        address _porterBond = _porterPoolParams.referenceAsset;
        IBond _bond = IBond(_porterBond);
        uint256 gracePeriodEnd = _bond.gracePeriodEnd();

        IDIVA.PoolParams memory _poolParams;
        _poolParams.referenceAsset = addressToString(_porterBond);
        _poolParams.expiryTime = uint96(gracePeriodEnd);
        _poolParams.floor = _porterPoolParams.floor;
        _poolParams.inflection = _porterPoolParams.inflection;
        _poolParams.cap = _porterPoolParams.cap;
        _poolParams.gradient = _porterPoolParams.gradient;
        _poolParams.collateralAmount = _porterPoolParams.collateralAmount;
        _poolParams.collateralToken = _porterPoolParams.collateralToken;
        _poolParams.dataProvider = _porterPoolParams.dataProvider;
        _poolParams.capacity = _porterPoolParams.capacity;

        IDIVA _diva = IDIVA(_divaDiamond);
        uint256 _poolId = _diva.createContingentPool(_poolParams);

        return _poolId;
    }

    function challengeable() external view override returns (bool) {
        return _challengeable;
    }

    /**
     * @notice Function to convert address to string.
     */
    function addressToString(address _addr)
        public
        pure
        returns (string memory)
    {
        bytes32 _bytes = bytes32(uint256(uint160(_addr)));
        bytes memory _hex = "0123456789abcdef";

        bytes memory _string = new bytes(51);
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
    function stringToAddress(string memory _a) public pure returns (address) {
        bytes memory tmp = bytes(_a);
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
