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
    ITellor public tellor; // Tellor contract address
    IERC20 public tippingToken; // TRB token address
    address public feeTo;
    uint256 public fee; // 1000 is 100%, 50 is 5%, etc.

    mapping(uint256 => mapping(bytes32 => Feed)) dataFeed; // mapping poolId to dataFeedId to details
    mapping(uint256 => bytes32[]) currentFeeds; // mapping poolId to dataFeedIds array
    mapping(uint256 => Tip[]) public tips; // mapping poolId to tips
    mapping(bytes32 => uint256) public poolIdFromDataFeedId; // mapping dataFeedId to poolId
    mapping(uint256 => uint256) public poolIdsWithFundingIndex; // mapping poolId to poolIdsWithFunding index plus one (0 if not in array)
    bytes32[] public feedsWithFunding; // array of dataFeedIds that have funding
    uint256[] public poolIdsWithFunding; // array of poolIds that have funding

    uint256 private _maxFeeAmountUSD; // expressed as an integer with 18 decimals
    address private _excessFeeRecipient;
    uint32 private _minPeriodUndisputed;
    bool private immutable _challengeable;

    constructor(
        address payable tellorAddress_,
        address excessFeeRecipient_,
        uint32 minPeriodUndisputed_,
        uint256 maxFeeAmountUSD_,
        address tippingToken_,
        address feeTo_,
        uint256 fee_
    ) UsingTellor(tellorAddress_) {
        tellor = ITellor(tellorAddress_);
        _challengeable = false;
        _excessFeeRecipient = excessFeeRecipient_;
        _minPeriodUndisputed = minPeriodUndisputed_;
        _maxFeeAmountUSD = maxFeeAmountUSD_;

        tippingToken = IERC20(tippingToken_);
        feeTo = feeTo_;
        fee = fee_;
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

    function getQueryId(uint256 _poolId) public pure returns (bytes32) {
        return
            keccak256(abi.encode("DIVAProtocolPolygon", abi.encode(_poolId)));
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
     * @dev Function to claim singular tip
     * @param _poolId id of reported data
     * @param _timestamps[] batch of timestamps array of reported data eligible for reward
     */
    function claimOneTimeTip(uint256 _poolId, uint256[] calldata _timestamps)
        external
    {
        require(tips[_poolId].length > 0, "no tips submitted for this poolId");
        uint256 _reward;
        uint256 _cumulativeReward;
        for (uint256 _i = 0; _i < _timestamps.length; _i++) {
            (_reward) = _claimOneTimeTip(_poolId, _timestamps[_i]);
            _cumulativeReward += _reward;
        }
        require(
            tippingToken.transfer(
                msg.sender,
                _cumulativeReward - ((_cumulativeReward * fee) / 1000)
            )
        );
        require(tippingToken.transfer(feeTo, (_cumulativeReward * fee) / 1000));
        if (getCurrentTip(_poolId) == 0) {
            if (poolIdsWithFundingIndex[_poolId] != 0) {
                uint256 _idx = poolIdsWithFundingIndex[_poolId] - 1;
                // Replace unfunded feed in array with last element
                poolIdsWithFunding[_idx] = poolIdsWithFunding[
                    poolIdsWithFunding.length - 1
                ];
                uint256 _poolIdLastFunded = poolIdsWithFunding[_idx];
                poolIdsWithFundingIndex[_poolIdLastFunded] = _idx + 1;
                poolIdsWithFundingIndex[_poolId] = 0;
                poolIdsWithFunding.pop();
            }
        }
        emit OneTimeTipClaimed(_poolId, _cumulativeReward, msg.sender);
    }

    /**
     * @dev Allows Tellor reporters to claim their tips in batches
     * @param _feedId unique feed identifier
     * @param _poolId ID of reported data
     * @param _timestamps[] batch of timestamps array of reported data eligible for reward
     */
    function claimTip(
        bytes32 _feedId,
        uint256 _poolId,
        uint256[] calldata _timestamps
    ) external {
        uint256 _reward;
        uint256 _cumulativeReward;
        for (uint256 _i = 0; _i < _timestamps.length; _i++) {
            _reward = _claimTip(_feedId, _poolId, _timestamps[_i]);
            require(
                tellor.getReporterByTimestamp(
                    getQueryId(_poolId),
                    _timestamps[_i]
                ) == msg.sender,
                "reporter mismatch"
            );
            _cumulativeReward += _reward;
        }
        require(
            tippingToken.transfer(
                msg.sender,
                _cumulativeReward - ((_cumulativeReward * fee) / 1000)
            )
        );
        require(tippingToken.transfer(feeTo, (_cumulativeReward * fee) / 1000));
        emit TipClaimed(_feedId, _poolId, _cumulativeReward, msg.sender);
    }

    /**
     * @dev Allows dataFeed account to be filled with tokens
     * @param _feedId unique feed identifier
     * @param _poolId identifier of reported data type associated with feed
     * @param _amount quantity of tokens to fund feed
     */
    function fundFeed(
        bytes32 _feedId,
        uint256 _poolId,
        uint256 _amount
    ) external {
        FeedDetails storage _feed = dataFeed[_poolId][_feedId].details;
        require(_feed.reward > 0, "feed not set up");
        _feed.balance += _amount;
        require(
            tippingToken.transferFrom(msg.sender, address(this), _amount),
            "ERC20: transfer amount exceeds balance"
        );
        // Add to array of feeds with funding
        if (_feed.feedsWithFundingIndex == 0 && _feed.balance > 0) {
            feedsWithFunding.push(_feedId);
            _feed.feedsWithFundingIndex = feedsWithFunding.length;
        }
        emit DataFeedFunded(_feedId, _poolId, _amount, msg.sender);
    }

    /**
     * @dev Initializes dataFeed parameters.
     * @param _poolId unique identifier of desired data feed
     * @param _reward tip amount per eligible data submission
     * @param _startTime timestamp of first autopay window
     * @param _interval amount of time between autopay windows
     * @param _window amount of time after each new interval when reports are eligible for tips
     * @param _priceThreshold amount price must change to automate update regardless of time (negated if 0, 100 = 1%)
     */
    function setupDataFeed(
        uint256 _poolId,
        uint256 _reward,
        uint256 _startTime,
        uint256 _interval,
        uint256 _window,
        uint256 _priceThreshold // bytes calldata _queryData
    ) external {
        // require(
        //     _queryId == keccak256(_queryData) || uint256(_queryId) <= 100,
        //     "id must be hash of bytes data"
        // );
        bytes32 _feedId = keccak256(
            abi.encode(
                _poolId,
                _reward,
                _startTime,
                _interval,
                _window,
                _priceThreshold
            )
        );
        FeedDetails storage _feed = dataFeed[_poolId][_feedId].details;
        require(_feed.reward == 0, "feed must not be set up already");
        require(_reward > 0, "reward must be greater than zero");
        require(
            _window < _interval,
            "window must be less than interval length"
        );
        _feed.reward = _reward;
        _feed.startTime = _startTime;
        _feed.interval = _interval;
        _feed.window = _window;
        _feed.priceThreshold = _priceThreshold;

        currentFeeds[_poolId].push(_feedId);
        poolIdFromDataFeedId[_feedId] = _poolId;
        emit NewDataFeed(_poolId, _feedId, msg.sender);
    }

    /**
     * @dev Function to run a single tip
     * @param _poolId ID of tipped data
     * @param _amount amount to tip
     */
    function tip(uint256 _poolId, uint256 _amount) external {
        // require(
        //     _queryId == keccak256(_queryData) || uint256(_queryId) <= 100,
        //     "id must be hash of bytes data"
        // );
        Tip[] storage _tips = tips[_poolId];
        if (_tips.length == 0) {
            _tips.push(Tip(_amount, block.timestamp));
        } else {
            (, , uint256 _timestampRetrieved) = getCurrentValue(
                getQueryId(_poolId)
            );
            if (_timestampRetrieved < _tips[_tips.length - 1].timestamp) {
                _tips[_tips.length - 1].timestamp = block.timestamp;
                _tips[_tips.length - 1].amount += _amount;
            } else {
                _tips.push(Tip(_amount, block.timestamp));
            }
        }
        if (
            poolIdsWithFundingIndex[_poolId] == 0 && getCurrentTip(_poolId) > 0
        ) {
            poolIdsWithFunding.push(_poolId);
            poolIdsWithFundingIndex[_poolId] = poolIdsWithFunding.length;
        }
        require(
            tippingToken.transferFrom(msg.sender, address(this), _amount),
            "ERC20: transfer amount exceeds balance"
        );
        emit TipAdded(_poolId, _amount, msg.sender);
    }

    // Getters
    /**
     * @dev Getter function to read current data feeds
     * @param _poolId id of reported data
     * @return feedIds array for queryId
     */
    function getCurrentFeeds(uint256 _poolId)
        external
        view
        returns (bytes32[] memory)
    {
        return currentFeeds[_poolId];
    }

    /**
     * @dev Getter function to current oneTime tip by queryId
     * @param _poolId id of reported data
     * @return amount of tip
     */
    function getCurrentTip(uint256 _poolId) public view returns (uint256) {
        (, , uint256 _timestampRetrieved) = getCurrentValue(
            getQueryId(_poolId)
        );
        Tip memory _lastTip = tips[_poolId][tips[_poolId].length - 1];
        if (_timestampRetrieved < _lastTip.timestamp) {
            return _lastTip.amount;
        } else {
            return 0;
        }
    }

    /**
     * @dev Getter function to read a specific dataFeed
     * @param _feedId unique feedId of parameters
     * @return FeedDetails details of specified feed
     */
    function getDataFeed(bytes32 _feedId)
        external
        view
        returns (FeedDetails memory)
    {
        return (dataFeed[poolIdFromDataFeedId[_feedId]][_feedId].details);
    }

    /**
     * @dev Getter function for currently funded feeds
     */
    function getFundedFeeds() external view returns (bytes32[] memory) {
        return feedsWithFunding;
    }

    /**
     * @dev Getter function for poolIds with current one time tips
     */
    function getFundedPoolIds() external view returns (uint256[] memory) {
        return poolIdsWithFunding;
    }

    /**
     * @dev Getter function to get number of past tips
     * @param _poolId id of reported data
     * @return count of tips available
     */
    function getPastTipCount(uint256 _poolId) external view returns (uint256) {
        return tips[_poolId].length;
    }

    /**
     * @dev Getter function for past tips
     * @param _poolId id of reported data
     * @return Tip struct (amount/timestamp) of all past tips
     */
    function getPastTips(uint256 _poolId) external view returns (Tip[] memory) {
        return tips[_poolId];
    }

    /**
     * @dev Getter function for past tips by index
     * @param _poolId id of reported data
     * @param _index uint index in the Tip array
     * @return amount/timestamp of specific tip
     */
    function getPastTipByIndex(uint256 _poolId, uint256 _index)
        external
        view
        returns (Tip memory)
    {
        return tips[_poolId][_index];
    }

    /**
     * @dev getter function to lookup query IDs from dataFeed IDs
     * @param _feedId dataFeed unique identifier
     * @return corresponding query ID
     */
    function getPoolIdFromFeedId(bytes32 _feedId)
        external
        view
        returns (uint256)
    {
        return poolIdFromDataFeedId[_feedId];
    }

    /**
     * @dev Getter function to read if a reward has been claimed
     * @param _feedId feedId of dataFeed
     * @param _poolId id of reported data
     * @param _timestamp id or reported data
     * @return bool rewardClaimed
     */
    function getRewardClaimedStatus(
        bytes32 _feedId,
        uint256 _poolId,
        uint256 _timestamp
    ) external view returns (bool) {
        return dataFeed[_poolId][_feedId].rewardClaimed[_timestamp];
    }

    // Internal functions
    /**
     * @dev Internal function to read if a reward has been claimed
     * @param _b bytes value to convert to uint256
     * @return _number uint256 converted from bytes
     */
    function _bytesToUint(bytes memory _b)
        internal
        pure
        returns (uint256 _number)
    {
        for (uint256 i = 0; i < _b.length; i++) {
            _number = _number + uint8(_b[i]);
        }
    }

    /**
     ** @dev Internal function which allows Tellor reporters to claim their one time tips
     * @param _poolId id of reported data
     * @param _timestamp timestamp of one time tip
     * @return amount of tip
     */
    function _claimOneTimeTip(uint256 _poolId, uint256 _timestamp)
        internal
        returns (uint256)
    {
        Tip[] storage _tips = tips[_poolId];
        require(
            block.timestamp - _timestamp > 12 hours,
            "buffer time has not passed"
        );
        bytes32 _queryId = getQueryId(_poolId);
        require(
            msg.sender == tellor.getReporterByTimestamp(_queryId, _timestamp),
            "message sender not reporter for given queryId and timestamp"
        );
        bytes memory _valueRetrieved = retrieveData(_queryId, _timestamp);
        require(
            keccak256(_valueRetrieved) != keccak256(bytes("")),
            "no value exists at timestamp"
        );
        uint256 _min = 0;
        uint256 _max = _tips.length;
        uint256 _mid;
        while (_max - _min > 1) {
            _mid = (_max + _min) / 2;
            if (_tips[_mid].timestamp > _timestamp) {
                _max = _mid;
            } else {
                _min = _mid;
            }
        }
        (, , uint256 _timestampBefore) = getDataBefore(_queryId, _timestamp);
        require(
            _timestampBefore < _tips[_min].timestamp,
            "tip earned by previous submission"
        );
        require(
            _timestamp > _tips[_min].timestamp,
            "timestamp not eligible for tip"
        );
        require(_tips[_min].amount > 0, "tip already claimed");
        uint256 _tipAmount = _tips[_min].amount;
        _tips[_min].amount = 0;
        return _tipAmount;
    }

    /**
     * @dev Internal function which allows Tellor reporters to claim their autopay tips
     * @param _feedId of dataFeed
     * @param _poolId id of reported data
     * @param _timestamp timestamp of reported data eligible for reward
     * @return uint256 reward amount
     */
    function _claimTip(
        bytes32 _feedId,
        uint256 _poolId,
        uint256 _timestamp
    ) internal returns (uint256) {
        Feed storage _feed = dataFeed[_poolId][_feedId];
        require(_feed.details.balance > 0, "insufficient feed balance");
        require(!_feed.rewardClaimed[_timestamp], "reward already claimed");
        require(
            block.timestamp - _timestamp > 12 hours,
            "buffer time has not passed"
        );
        require(
            block.timestamp - _timestamp < 12 weeks,
            "timestamp too old to claim tip"
        );
        bytes32 _queryId = getQueryId(_poolId);
        bytes memory _valueRetrieved = retrieveData(_queryId, _timestamp);
        require(
            keccak256(_valueRetrieved) != keccak256(bytes("")),
            "no value exists at timestamp"
        );
        uint256 _n = (_timestamp - _feed.details.startTime) /
            _feed.details.interval; // finds closest interval _n to timestamp
        uint256 _c = _feed.details.startTime + _feed.details.interval * _n; // finds timestamp _c of interval _n
        (
            ,
            bytes memory _valueRetrievedBefore,
            uint256 _timestampBefore
        ) = getDataBefore(_queryId, _timestamp);
        uint256 _priceChange = 0; //price change from last value to current value
        if (_feed.details.priceThreshold != 0) {
            uint256 _v1 = _bytesToUint(_valueRetrieved);
            uint256 _v2 = _bytesToUint(_valueRetrievedBefore);
            if (_v2 == 0) {
                _priceChange = 10000;
            } else if (_v1 >= _v2) {
                _priceChange = (10000 * (_v1 - _v2)) / _v2;
            } else {
                _priceChange = (10000 * (_v2 - _v1)) / _v2;
            }
        }
        if (_priceChange <= _feed.details.priceThreshold) {
            require(
                _timestamp - _c < _feed.details.window,
                "timestamp not within window"
            );
            require(
                _timestampBefore < _c,
                "timestamp not first report within window"
            );
        }
        uint256 _rewardAmount;
        if (_feed.details.balance > _feed.details.reward) {
            _rewardAmount = _feed.details.reward;
            _feed.details.balance -= _feed.details.reward;
        } else {
            _rewardAmount = _feed.details.balance;
            _feed.details.balance = 0;
            // Adjust currently funded feeds
            if (feedsWithFunding.length > 1) {
                uint256 _idx = _feed.details.feedsWithFundingIndex - 1;
                // Replace unfunded feed in array with last element
                feedsWithFunding[_idx] = feedsWithFunding[
                    feedsWithFunding.length - 1
                ];
                bytes32 _feedIdLastFunded = feedsWithFunding[_idx];
                uint256 _poolIdLastFunded = poolIdFromDataFeedId[
                    _feedIdLastFunded
                ];
                dataFeed[_poolIdLastFunded][_feedIdLastFunded]
                    .details
                    .feedsWithFundingIndex = _idx + 1;
            }
            feedsWithFunding.pop();
            _feed.details.feedsWithFundingIndex = 0;
        }
        _feed.rewardClaimed[_timestamp] = true;
        return _rewardAmount;
    }
}
