// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAOracleTellor {
    // Thrown in `onlyConfirmedPool` modifier if user tries to claim fees/tips
    // for a pool that was not yet confirmed
    error NotConfirmedPool();

    // Thrown in `addTip` if user tries to add a tip for an already confirmed
    // pool
    error AlreadyConfirmedPool();

    // Thrown in `updateExcessFeeRecipient` or constructor if the zero address
    // is passed as input into `setExcessFeeRecipient`
    error ZeroExcessFeeRecipient();

    // Thrown in `setMinPeriodUndisputed` if `_minPeriodUndisputed` passed
    // into `setMinPeriodUndisputed` is not within the expected range
    // (min 1h, max 18h)
    error OutOfRange();

    // Thrown in `setFinalReferenceValue` if there is no data reported after
    // the expiry time of the underlying pool
    error NoOracleSubmissionAfterExpiryTime();

    // Thrown in `setFinalReferenceValue` if user tries to call the function
    // before the minimum period undisputed period has passed
    error MinPeriodUndisputedNotPassed();

    // Thrown in constructor if zero address is provided as ownershipContract
    error ZeroOwnershipContractAddress();

    // Thrown `onlyOwner` modifier if `msg.sender` is not contract owner
    error NotContractOwner(address _user, address _contractOwner);

    // Thrown in `updateExcessFeeRecipient` if there is already a pending
    // excess fee recipient update
    error PendingExcessFeeRecipientUpdate(
        uint256 _timestampBlock,
        uint256 _startTimeExcessFeeRecipient
    );

    // Thrown in `updateMaxFeeAmountUSD` if there is already a pending max fee
    // amount USD update
    error PendingMaxFeeAmountUSDUpdate(
        uint256 _timestampBlock,
        uint256 _startTimeMaxFeeAmountUSD
    );

    // Thrown in `revokePendingExcessFeeRecipientUpdate` if the excess fee
    // recipient update to be revoked is already active
    error ExcessFeeRecipientAlreadyActive(
        uint256 _timestampBlock,
        uint256 _startTimeExcessFeeRecipient
    );

    // Thrown in `revokePendingMaxFeeAmountUSDUpdate` if the max fee amount USD
    // update to be revoked is already active
    error MaxFeeAmountUSDAlreadyActive(
        uint256 _timestampBlock,
        uint256 _startTimeMaxFeeAmountUSD
    );

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

    /**
     * @notice Emitted when the excess fee recipient is set.
     * @param from The address that initiated the change (contract owner).
     * @param excessFeeRecipient New excess fee recipient.
     * @param startTimeExcessFeeRecipient Timestamp in seconds since epoch at
     * which the new excess fee recipient will be activated.
     */
    event ExcessFeeRecipientUpdated(
        address indexed from,
        address indexed excessFeeRecipient,
        uint256 startTimeExcessFeeRecipient
    );

    /**
     * @notice Emitted when the max fee amount USD is set.
     * @param from The address that initiated the change (contract owner).
     * @param maxFeeAmountUSD New max fee amount USD.
     * @param startTimeMaxFeeAmountUSD Timestamp in seconds since epoch at
     * which the new max fee amount USD will be activated.
     */
    event MaxFeeAmountUSDUpdated(
        address indexed from,
        uint256 maxFeeAmountUSD,
        uint256 startTimeMaxFeeAmountUSD
    );

    /**
     * @notice Emitted when a pending excess fee recipient update is revoked.
     * @param revokedBy The address that initiated the revocation.
     * @param revokedExcessFeeRecipient Pending excess fee recipient that was
     * revoked.
     * @param restoredExcessFeeRecipient Previous excess fee recipient that was
     * restored.
     */
    event PendingExcessFeeRecipientUpdateRevoked(
        address indexed revokedBy,
        address indexed revokedExcessFeeRecipient,
        address indexed restoredExcessFeeRecipient
    );

    /**
     * @notice Emitted when a pending max fee amount USD update is revoked.
     * @param revokedBy The address that initiated the revocation.
     * @param revokedMaxFeeAmountUSD Pending max fee amount USD that was
     * revoked.
     * @param restoredMaxFeeAmountUSD Previous max fee amount USD that was
     * restored.
     */
    event PendingMaxFeeAmountUSDUpdateRevoked(
        address indexed revokedBy,
        uint256 revokedMaxFeeAmountUSD,
        uint256 restoredMaxFeeAmountUSD
    );

    // Struct for `batchClaim` function input
    struct ArgsBatchClaimReward {
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
     * @dev Function to claim tips and/or DIVA fee
     * @param _poolId The unique identifier of the pool.
     * @param _tippingTokens Array of tipping tokens to claim tip.
     * @param _claimDIVAFee Flag showing whether to claim DIVA fee.
     */
    function claimReward(
        uint256 _poolId,
        address[] memory _tippingTokens,
        bool _claimDIVAFee
    ) external;

    /**
     * @dev Batch version of `claimReward`
     * @param _argsBatchClaimReward Struct array containing pool ids, tipping
     * tokens, and `claimDIVAFee` flag
     */
    function batchClaimReward(
        ArgsBatchClaimReward[] calldata _argsBatchClaimReward
    ) external;

    /**
     * @dev Function to set the final reference value for a given `_poolId`.
     * @param _poolId The unique identifier of the pool.
     * @param _tippingTokens Array of tipping tokens to claim tip.
     * @param _claimDIVAFee Flag showing whether to claim DIVA fee.
     */
    function setFinalReferenceValue(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAFee
    ) external;

    /**
     * @dev Function to update `_excessFeeRecipient`.
     * Only callable by contract owner.
     * @param _newExcessFeeRecipient New `_excessFeeRecipient`.
     */
    function updateExcessFeeRecipient(address _newExcessFeeRecipient) external;

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
    function updateMaxFeeAmountUSD(uint256 _newMaxFeeAmountUSD) external;

    /**
     * @dev Function to revoke a pending excess fee recipient update
     * and restore the previous one.
     * Only callable by contract owner.
     */
    function revokePendingExcessFeeRecipientUpdate() external;

    /**
     * @dev Function to revoke a pending max fee amount USD update
     * and restore the previous one.
     * Only callable by contract owner.
     */
    function revokePendingMaxFeeAmountUSDUpdate() external;

    /**
     * @dev Returns whether the oracle's data feed is challengeable or not.
     * Will return false in that implementation.
     */
    function challengeable() external view returns (bool);

    /**
     * @dev Returns the excess fee recipient info
     */
    function getExcessFeeRecipientInfo()
        external
        view
        returns (
            address previousExcessFeeRecipient,
            address excessFeeRecipient,
            uint256 startTimeExcessFeeRecipient
        );

    /**
     * @dev Returns the minimum period (in seconds) a reported value has
     * to remain undisputed in order to be considered valid
     */
    function getMinPeriodUndisputed() external view returns (uint32);

    /**
     * @dev Returns the max fee amount USD info
     */
    function getMaxFeeAmountUSDInfo()
        external
        view
        returns (
            uint256 previousMaxFeeAmountUSD,
            uint256 maxFeeAmountUSD,
            uint256 startTimeMaxFeeAmountUSD
        );

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

    /**
     * @dev Returns the ownership contract address
     */
    function getOwnershipContract() external view returns (address);

    /**
     * @dev Returns the activation delay constant value
     */
    function getActivationDelay() external view returns (uint256);
}
