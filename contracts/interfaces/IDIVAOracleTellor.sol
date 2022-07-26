// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAOracleTellor {
    // Structs
    struct FeedDetails {
        uint256 reward; // amount paid for each eligible data submission
        uint256 balance; // account remaining balance
        uint256 startTime; // time of first payment window
        uint256 interval; // time between pay periods
        uint256 window; // amount of time data can be submitted per interval
        uint256 priceThreshold; //change in price necessitating an update 100 = 1%
        uint256 feedsWithFundingIndex; // index plus one of dataFeedID in feedsWithFunding array (0 if not in array)
    }

    struct Feed {
        FeedDetails details;
        mapping(uint256 => bool) rewardClaimed; // tracks which tips were already paid out
    }

    struct Tip {
        uint256 amount;
        uint256 timestamp;
    }

    // Events
    event NewDataFeed(
        uint256 _poolId,
        bytes32 _feedId,
        // bytes _queryData,
        address _feedCreator
    );
    event DataFeedFunded(
        bytes32 _feedId,
        uint256 _poolId,
        uint256 _amount,
        address _feedFunder
    );
    event OneTimeTipClaimed(
        uint256 _poolId,
        uint256 _amount,
        address _reporter
    );
    event TipAdded(
        uint256 _poolId,
        uint256 _amount,
        // bytes _queryData,
        address _tipper
    );
    event TipClaimed(
        bytes32 _feedId,
        uint256 _poolId,
        uint256 _amount,
        address _reporter
    );

    /**
     * @notice Emitted when the final reference value is set.
     * @param poolId The Id of an existing derivatives pool
     * @param finalValue Tellor value (converted into 18 decimals)
     * @param expiryTime Unix timestamp in seconds of pool expiry date
     * @param timestamp Tellor value timestamp
     */
    event FinalReferenceValueSet(
        uint256 indexed poolId,
        uint256 finalValue,
        uint256 expiryTime,
        uint256 timestamp
    );

    /**
     * @dev Function to set the final reference value for a given `poolId`.
     * @param _divaDiamond Address of the diva smart contract. Used as argument
     * rather than a hard-coded constant to avoid redeploying the oracle contracts
     * when a new version of DIVA Protocol is released.
     * @param _poolId The unique identifier of the pool.
     */
    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId)
        external;

    /**
     * @dev Function to update `minPeriodUndisputed` with minimum value of
     * 1 hour (3600 seconds) and maximum value of 18 hours (64800 seconds).
     * @param _newMinPeriodUndisputed New `minPeriodUndisputed` in seconds.
     */
    function setMinPeriodUndisputed(uint32 _newMinPeriodUndisputed) external;

    /**
     * @dev Function to update `_maxFeeAmountUSD`. Only callable by contract owner.
     * @param _newMaxFeeAmountUSD New amount expressed as an integer with 18 decimals.
     */
    function setMaxFeeAmountUSD(uint256 _newMaxFeeAmountUSD) external;

    /**
     * @dev Returns whether the oracle's data feed is challengeable or not.
     * Will return false in that implementation.
     */
    function challengeable() external view returns (bool);

    /**
     * @dev Returns the excess fee recipient address
     */
    function getExcessFeeRecipient() external view returns (address);

    /**
     * @dev Returns the minimum period (in seconds) a reported value has
     * to remain undisputed in order to be considered valid
     */
    function getMinPeriodUndisputed() external view returns (uint32);
}
