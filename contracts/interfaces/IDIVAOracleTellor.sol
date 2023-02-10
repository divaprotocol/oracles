// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAOracleTellor {
    // Thrown if user tries to claim fees/tips for a pool that was not yet confirmed
    error NotConfirmedPool();

    // Thrown if user tries to add a tip for an already confirmed pool
    error AlreadyConfirmedPool();

    // Thrown if the zero address is passed as input into `setExcessFeeRecipient`
    error ZeroExcessFeeRecipient();

    // Thrown if `_minPeriodUndisputed` passed into `setMinPeriodUndisputed` is
    // not within the expected range (min 1h, max 18h)
    error OutOfRange();

    // Thrown when user calls `setFinalReferenceValue` (or a variant of it) but
    // there is no data reported after the expiry time of the underlying pool
    error NoOracleSubmissionAfterExpiryTime();

    // Thrown if user tries to call `setFinalReferenceValue` (or a variant of it)
    // before the minimum period undisputed period has passed
    error MinPeriodUndisputedNotPassed();

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
     * @notice Emitted when the tip is claimed.
     * @param poolId The Id of an existing derivatives pool
     * @param recipient Address of the tip recipient
     * @param tippingToken Address of tipping token
     * @param amount Claimed tipping token amount
     */
    event TipClaimed(
        uint256 poolId,
        address recipient,
        address tippingToken,
        uint256 amount
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

    // Struct for `batchClaim` function input
    struct ArgsBatchClaim {
        uint256 poolId;
        address[] tippingTokens;
        bool claimDIVAFee;
    }

    // Struct for `getTipAmounts` function input
    struct ArgsGetTipAmounts {
        uint256 poolId;
        address[] tippingTokens;
    }

    // Struct for `getTippingTokens` function input
    struct ArgsGetTippingTokens {
        uint256 poolId;
        uint256 startIndex;
        uint256 endIndex;
    }

    // Struct for `getPoolIdsForReporters` function input
    struct ArgsGetPoolIdsForReporters {
        address reporter;
        uint256 startIndex;
        uint256 endIndex;
    }

    /**
     * @dev Function to run a single tip
     * @param _poolId The unique identifier of the pool.
     * @param _amount amount to tip
     * @param _tippingToken tipping token address
     */
    function addTip(
        uint256 _poolId,
        uint256 _amount,
        address _tippingToken
    ) external;

    /**
     * @dev Function to claim tips
     * @param _poolId The unique identifier of the pool.
     * @param _tippingTokens Array of tipping tokens to claim tip.
     * @param claimDIVAFee_ Flag showing whether to claim DIVA fee.
     */
    function claim(
        uint256 _poolId,
        address[] memory _tippingTokens,
        bool claimDIVAFee_
    ) external;

    /**
     * @dev Batch version of `claimTips`
     * @param _argsBatchClaim Struct array containing pool ids, tipping
     * tokens, and `claimDIVAFee` flag
     */
    function batchClaim(ArgsBatchClaim[] calldata _argsBatchClaim) external;

    /**
     * @dev Function to set the final reference value for a given `_poolId`.
     * @param _poolId The unique identifier of the pool.
     * @param _tippingTokens Array of tipping tokens to claim tip.
     * @param claimDIVAFee_ Flag showing whether to claim DIVA fee.
     */
    function setFinalReferenceValue(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool claimDIVAFee_
    ) external;

    /**
     * @dev Function to update `_excessFeeRecipient`.
     * Only callable by contract owner.
     * @param _newExcessFeeRecipient New `_excessFeeRecipient`.
     */
    function setExcessFeeRecipient(address _newExcessFeeRecipient) external;

    /**
     * @dev Function to update `_minPeriodUndisputed` with minimum value of
     * 1 hour (3600 seconds) and maximum value of 18 hours (64800 seconds).
     * Only callable by contract owner.
     * @param _newMinPeriodUndisputed New `_minPeriodUndisputed` in seconds.
     */
    function setMinPeriodUndisputed(uint32 _newMinPeriodUndisputed) external;

    /**
     * @dev Function to update `_maxFeeAmountUSD`.
     * Only callable by contract owner.
     * @param _newMaxFeeAmountUSD New amount expressed as an integer with
     * 18 decimals.
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
     * @dev Returns the max fee amount usd value with 18 decimals
     */
    function getMaxFeeAmountUSD() external view returns (uint256);

    /**
     * @dev Returns the array of tippingTokens for poolIds
     * @param _argsGetTippingTokens Struct array containing pool id,
     * start index and end index.
     */
    function getTippingTokens(
        ArgsGetTippingTokens[] calldata _argsGetTippingTokens
    ) external view returns (address[][] memory);

    /**
     * @dev Returns the length of tipping tokens with the poolIds
     * @param _poolIds Array of pool ids.
     */
    function getTippingTokensLengthForPoolIds(uint256[] calldata _poolIds)
        external
        view
        returns (uint256[] memory);

    /**
     * @dev Returns the tipping amount
     * @param _argsGetTipAmounts Struct array containing pool ids
     * and tipping tokens
     */
    function getTipAmounts(ArgsGetTipAmounts[] calldata _argsGetTipAmounts)
        external
        view
        returns (uint256[][] memory);

    /**
     * @dev Returns query id
     * @param _poolId The unique identifier of the pool.
     */
    function getQueryId(uint256 _poolId) external view returns (bytes32);

    /**
     * @dev Returns the array of reporter addresses. Note that it returns
     * the zero address if a value has been reported to the Tellor contract
     * but it hasn't been pulled into DIVA Protocol by calling
     * `setFinalReferenceValue` yet.
     * @param _poolIds Array of pool id.
     */
    function getReporters(uint256[] calldata _poolIds)
        external
        view
        returns (address[] memory);

    /**
     * @dev Returns the array of poolIds reported by reporter
     * @param _argsGetPoolIdsForReporters Struct array containing reporter
     * address, start index and end index.
     */
    function getPoolIdsForReporters(
        ArgsGetPoolIdsForReporters[] calldata _argsGetPoolIdsForReporters
    ) external view returns (uint256[][] memory);

    /**
     * @dev Returns the length of pool ids for the reporters
     * @param _reporters Array of reporter address.
     */
    function getPoolIdsLengthForReporters(address[] calldata _reporters)
        external
        view
        returns (uint256[] memory);

    /**
     * @dev Returns the DIVA address that the oracle is linked to
     */
    function getDIVAAddress() external view returns (address);
}
