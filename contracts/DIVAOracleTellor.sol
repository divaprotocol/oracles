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
    // TODO: Remove Feed stuff
    // Use multiple tipping tokens

    // Ordered to optimize storage
    mapping(uint256 => mapping(address => uint256)) public tips; // mapping poolId to tips
    mapping(uint256 => address[]) public tippingTokens; // mapping poolId to tipping tokens
    mapping(uint256 => PoolDetail) public poolsDetail; // mapping poolId to pool detail

    uint256 private _maxFeeAmountUSD; // expressed as an integer with 18 decimals
    address private _excessFeeRecipient;
    uint32 private _minPeriodUndisputed;
    bool private immutable _challengeable;

    constructor(
        address payable tellorAddress_,
        address excessFeeRecipient_,
        uint32 minPeriodUndisputed_,
        uint256 maxFeeAmountUSD_
    ) UsingTellor(tellorAddress_) {
        _challengeable = false;
        _excessFeeRecipient = excessFeeRecipient_;
        _minPeriodUndisputed = minPeriodUndisputed_;
        _maxFeeAmountUSD = maxFeeAmountUSD_;
    }

    function tip(
        uint256 _poolId,
        uint256 _amount,
        address _tippingToken
    ) external override {
        if (tips[_poolId][_tippingToken] == 0) {
            tippingTokens[_poolId].push(_tippingToken);
        }
        tips[_poolId][_tippingToken] += _amount;
        require(
            IERC20(_tippingToken).transferFrom(
                msg.sender,
                address(this),
                _amount
            ),
            "ERC20: transfer amount exceeds balance"
        );
        emit TipAdded(_poolId, _tippingToken, _amount, msg.sender);
    }

    function claimFees(address _divaDiamond, uint256 _poolId)
        external
        override
    {
        require(
            poolsDetail[_poolId].tellorReporter != address(0),
            "DIVAOracleTellor: cannot claim fees for this pool"
        );
        _claimFees(_divaDiamond, _poolId);
    }

    function setFinalReferenceValue(
        address _divaDiamond,
        uint256 _poolId,
        bool _withClaimFees
    ) external override nonReentrant {
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId); // updated the Pool struct based on the latest contracts

        // Get queryId from poolId
        bytes32 _queryId = getQueryId(_poolId);

        // Find first oracle submission
        uint256 _timestampRetrieved = getTimestampbyQueryIdandIndex(
            _queryId,
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
                _queryId,
                _params.expiryTime
            );

            // Increment index to get the first data point after `_expiryTime`
            _index++;

            // Get timestamp of first data point after `_expiryTime`
            _timestampRetrieved = getTimestampbyQueryIdandIndex(
                _queryId,
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
            _queryId,
            _timestampRetrieved
        );

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

        // Forward final value to DIVA contract. Allocates the fee as part of that process.
        _diva.setFinalReferenceValue(
            _poolId,
            _formattedFinalReferenceValue,
            _challengeable
        );

        PoolDetail storage _poolDetails = poolsDetail[_poolId];
        _poolDetails.tellorReporter = _reporter;
        _poolDetails
            .formattedCollateralToUSDRate = _formattedCollateralToUSDRate;
        _poolDetails.rewardClaimed = false;

        // ADD claimTips function somewhere here
        if (_withClaimFees) {
            _claimFees(_divaDiamond, _poolId);
        }

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

    function getExcessFeeRecipient() external view override returns (address) {
        return _excessFeeRecipient;
    }

    function getMinPeriodUndisputed() external view override returns (uint32) {
        return _minPeriodUndisputed;
    }

    /**
     * @dev Getter function to read if a reward has been claimed
     * @param _poolId id of reported data
     * @return bool rewardClaimed
     */
    function getRewardClaimedStatus(uint256 _poolId)
        external
        view
        returns (bool)
    {
        return poolsDetail[_poolId].rewardClaimed;
    }

    function getTippingTokensLength(uint256 _poolId)
        public
        view
        override
        returns (uint256)
    {
        return tippingTokens[_poolId].length;
    }

    // Claim fees
    function _claimFees(address _divaDiamond, uint256 _poolId) private {
        IDIVA _diva = IDIVA(_divaDiamond);
        IDIVA.Pool memory _params = _diva.getPoolParameters(_poolId); // updated the Pool struct based on the latest contracts

        uint256 _SCALING = uint256(
            10**(18 - IERC20Metadata(_params.collateralToken).decimals())
        );
        // Get the current fee claim allocated to this contract address (msg.sender)
        uint256 feeClaim = _diva.getClaims(
            _params.collateralToken,
            address(this)
        ); // denominated in collateral token; integer with collateral token decimals

        uint256 feeClaimUSD = (feeClaim * _SCALING).multiplyDecimal(
            poolsDetail[_poolId].formattedCollateralToUSDRate
        ); // denominated in USD; integer with 18 decimals
        uint256 feeToReporter;
        uint256 feeToExcessRecipient;

        if (feeClaimUSD > _maxFeeAmountUSD) {
            // if _formattedCollateralToUSDRate = 0, then feeClaimUSD = 0 in which case it will
            // go into the else part, hence division by zero is not a problem
            feeToReporter =
                _maxFeeAmountUSD.divideDecimal(
                    poolsDetail[_poolId].formattedCollateralToUSDRate
                ) /
                _SCALING; // integer with collateral token decimals
        } else {
            feeToReporter = feeClaim;
        }

        feeToExcessRecipient = feeClaim - feeToReporter; // integer with collateral token decimals

        // Transfer fee claim to reporter and excessFeeRecipient
        _diva.transferFeeClaim(
            poolsDetail[_poolId].tellorReporter,
            _params.collateralToken,
            feeToReporter
        );
        _diva.transferFeeClaim(
            _excessFeeRecipient,
            _params.collateralToken,
            feeToExcessRecipient
        );

        // Claim tip
        for (uint256 _i = 0; _i < getTippingTokensLength(_poolId); _i++) {
            address _tippingToken = tippingTokens[_poolId][_i];
            require(
                IERC20(_tippingToken).transferFrom(
                    address(this),
                    poolsDetail[_poolId].tellorReporter,
                    tips[_poolId][_tippingToken]
                ),
                "ERC20: transfer amount exceeds balance"
            );
        }

        // Set rewardClaimed
        poolsDetail[_poolId].rewardClaimed = true;

        emit FeesClaimed(_poolId, poolsDetail[_poolId].tellorReporter);
    }

    // Get quesry id from poolId
    function getQueryId(uint256 _poolId) private pure returns (bytes32) {
        // Construct Tellor queryID (http://querybuilder.tellor.io/divaprotocolpolygon)
        return
            keccak256(abi.encode("DIVAProtocolPolygon", abi.encode(_poolId)));
    }

    /**
     * @dev Getter function for poolIds with current tips
     */
    // TODO
    // QUESTION: need this function?
    // function getTippedPoolIds() external view returns (uint256[] memory) {
    //     // return poolIdsWithFunding;
    // }
}
