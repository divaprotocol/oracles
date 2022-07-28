// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAOracleTellor {
    // Struct for pool detail
    struct PoolDetail {
        address tellorReporter;
        uint256 formattedCollateralToUSDRate;
        bool rewardClaimed;
    }

    /**
     * @notice Emitted when the tip is added.
     * @param poolId The Id of an existing derivatives pool
     * @param tippingToken Address of tipping token
     * @param amount Tipping token amount
     * @param tipper Address of user who adds the tip
     */
    event TipAdded(
        uint256 poolId,
        address tippingToken,
        uint256 amount,
        address tipper
    );

    /**
     * @notice Emitted when the fees are claimed.
     * @param poolId The Id of an existing derivatives pool
     * @param tellorReporter Address of Tellor reporter
     */
    event FeesClaimed(uint256 poolId, address tellorReporter);

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
     * @param _withClaimFees The flag whether to claim the fees or not.
     */
    function setFinalReferenceValue(
        address _divaDiamond,
        uint256 _poolId,
        bool _withClaimFees
    ) external;

    /**
     * @dev Function to run a single tip
     * @param _poolId The unique identifier of the pool.
     * @param _amount amount to tip
     * @param _tippingToken tipping token address
     */
    function tip(
        uint256 _poolId,
        uint256 _amount,
        address _tippingToken
    ) external;

    /**
     * @dev Function to claim fees
     * @param _divaDiamond Address of the diva smart contract. Used as argument
     * @param _poolId The unique identifier of the pool.
     */
    function claimFees(address _divaDiamond, uint256 _poolId) external;

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

    /**
     * @dev Returns the reward claimed status with poolId
     * @param _poolId The unique identifier of the pool.
     */
    function getRewardClaimedStatus(uint256 _poolId)
        external
        view
        returns (bool);

    /**
     * @dev Returns the length of tipping tokens with the poolId
     * @param _poolId The unique identifier of the pool.
     */
    function getTippingTokensLength(uint256 _poolId)
        external
        view
        returns (uint256);
}
