// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAOracleTellor {
    // Thrown in `onlyConfirmedPool` modifier if user tries to claim fees/tips
    // for a pool that was not yet confirmed.
    error NotConfirmedPool();

    // Thrown in `addTip` if user tries to add a tip for an already confirmed
    // pool.
    error AlreadyConfirmedPool();

    // Thrown in `updateExcessFeeRecipient` or constructor if the zero address
    // is passed as excess fee recipient address.
    error ZeroExcessFeeRecipient();

    // Thrown in `setFinalReferenceValue` if there is no data reported after
    // the expiry time of the underlying pool.
    error NoOracleSubmissionAfterExpiryTime();

    // Thrown in `setFinalReferenceValue` if user tries to call the function
    // before the minimum period undisputed period has passed.
    error MinPeriodUndisputedNotPassed();

    // Thrown in constructor if zero address is provided as ownershipContract.
    error ZeroOwnershipContractAddress();

    // Thrown `onlyOwner` modifier if `msg.sender` is not contract owner.
    error NotContractOwner(address _user, address _contractOwner);

    // Thrown in `updateExcessFeeRecipient` if there is already a pending
    // excess fee recipient update.
    error PendingExcessFeeRecipientUpdate(
        uint256 _timestampBlock,
        uint256 _startTimeExcessFeeRecipient
    );

    // Thrown in `updateMaxFeeAmountUSD` if there is already a pending max USD
    // fee amount USD update.
    error PendingMaxFeeAmountUSDUpdate(
        uint256 _timestampBlock,
        uint256 _startTimeMaxFeeAmountUSD
    );

    // Thrown in `revokePendingExcessFeeRecipientUpdate` if the excess fee
    // recipient update to be revoked is already active.
    error ExcessFeeRecipientAlreadyActive(
        uint256 _timestampBlock,
        uint256 _startTimeExcessFeeRecipient
    );

    // Thrown in `revokePendingMaxFeeAmountUSDUpdate` if the max USD fee amount
    // update to be revoked is already active.
    error MaxFeeAmountUSDAlreadyActive(
        uint256 _timestampBlock,
        uint256 _startTimeMaxFeeAmountUSD
    );

    /**
     * @notice Emitted when a tip is added via the `addTip` function.
     * @param poolId The Id of the tipped pool.
     * @param tippingToken Tipping token address.
     * @param amount Tipping token amount expressed as an integer with
     * tipping token decimals.
     * @param tipper Tipper address.
     */
    event TipAdded(
        uint256 poolId,
        address tippingToken,
        uint256 amount,
        address tipper
    );

    /**
     * @notice Emitted in `claimReward` when the reward is claimed.
     * @param poolId The Id of the pool.
     * @param recipient Address of the tip recipient.
     * @param tippingToken Tipping token address.
     * @param amount Claimed amount expressed as an integer with tipping
     * token decimals.
     */
    event TipClaimed(
        uint256 poolId,
        address recipient,
        address tippingToken,
        uint256 amount
    );

    /**
     * @notice Emitted when the final reference value is set.
     * @param poolId The Id of an existing derivatives pool.
     * @param finalValue Tellor value (converted into 18 decimals).
     * @param expiryTime Unix timestamp in seconds of pool expiry date.
     * @param timestamp Tellor value timestamp.
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
     * @notice Emitted when the max USD fee amount is set.
     * @param from The address that initiated the change (contract owner).
     * @param maxFeeAmountUSD New max USD fee amount.
     * @param startTimeMaxFeeAmountUSD Timestamp in seconds since epoch at
     * which the new max USD fee amount will be activated.
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
     * @notice Emitted when a pending max USD fee amount update is revoked.
     * @param revokedBy The address that initiated the revocation.
     * @param revokedMaxFeeAmountUSD Pending max USD fee amount that was
     * revoked.
     * @param restoredMaxFeeAmountUSD Previous max USD fee amount that was
     * restored.
     */
    event PendingMaxFeeAmountUSDUpdateRevoked(
        address indexed revokedBy,
        uint256 revokedMaxFeeAmountUSD,
        uint256 restoredMaxFeeAmountUSD
    );

    // Struct for `batchClaim` function input.
    struct ArgsBatchClaimReward {
        uint256 poolId;
        address[] tippingTokens;
        bool claimDIVAReward;
    }

    // Struct for `getTipAmounts` function input.
    struct ArgsGetTipAmounts {
        uint256 poolId;
        address[] tippingTokens;
    }

    // Struct for `getTippingTokens` function input.
    struct ArgsGetTippingTokens {
        uint256 poolId;
        uint256 startIndex;
        uint256 endIndex;
    }

    // Struct for `getPoolIdsForReporters` function input.
    struct ArgsGetPoolIdsForReporters {
        address reporter;
        uint256 startIndex;
        uint256 endIndex;
    }

    /**
     * @notice Function to tip a pool. Tips can be added in any
     * ERC20 token until the final value has been submitted and
     * confirmed in DIVA Protocol by successfully calling the
     * `setFinalReferenceValue` function. Tips can e claimed via the
     * `claimReward` function after final value confirmation.
     * @dev Function will revert if `msg.sender` has insufficient
     * allowance.
     * @param _poolId The id of the pool.
     * @param _amount The amount to tip expressed as an integer
     * with tipping token decimals.
     * @param _tippingToken Tipping token address.
     */
    function addTip(
        uint256 _poolId,
        uint256 _amount,
        address _tippingToken
    ) external;

    /**
     * @notice Function to claim tips and/or DIVA reward.
     * @dev Claiming rewards is only possible after the final value has been
     * submitted and confirmed in DIVA Protocol by successfully calling
     * the `setFinalReferenceValue` function. Anyone can trigger this
     * function to transfer the rewards to the eligible reporter.
     * 
     * If no tipping tokens are provided and `_claimDIVAReward` is
     * set to `false`, the function will not execute anything, but will
     * not revert.
     * @param _poolId The Id of the pool.
     * @param _tippingTokens Array of tipping tokens to claim.
     * @param _claimDIVAReward Flag indicating whether to claim the
     * DIVA reward.
     */
    function claimReward(
        uint256 _poolId,
        address[] memory _tippingTokens,
        bool _claimDIVAReward
    ) external;

    /**
     * @dev Batch version of `claimReward`.
     * @param _argsBatchClaimReward Struct array containing poolIds, tipping
     * tokens, and `claimDIVAReward` flag.
     */
    function batchClaimReward(
        ArgsBatchClaimReward[] calldata _argsBatchClaimReward
    ) external;

    /**
     * @notice Function to set the final reference value for a given `_poolId`.
     * The first value that was submitted to the Tellor contract after the pool
     * expiration and remained undisputed for at least 12 hours will be passed
     * on to the DIVA smart contract for settlement.
     * @dev Function must be triggered within the submission window of the pool.
     * @param _poolId The id of the pool.
     * @param _tippingTokens Array of tipping tokens to claim.
     * @param _claimDIVAReward Flag indicating whether to claim the DIVA reward.
     */
    function setFinalReferenceValue(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAReward
    ) external;

    /**
     * @dev Function to update `_excessFeeRecipient`. Only callable
     * by contract owner.
     * @param _newExcessFeeRecipient New `_excessFeeRecipient`.
     */
    function updateExcessFeeRecipient(address _newExcessFeeRecipient) external;

    /**
     * @dev Function to update `_maxFeeAmountUSD`. Only callable by contract owner.
     * @param _newMaxFeeAmountUSD New amount expressed as an integer with
     * 18 decimals.
     */
    function updateMaxFeeAmountUSD(uint256 _newMaxFeeAmountUSD) external;

    /**
     * @dev Function to revoke a pending excess fee recipient update
     * and restore the previous one. Only callable by contract owner.
     */
    function revokePendingExcessFeeRecipientUpdate() external;

    /**
     * @dev Function to revoke a pending max USD fee amount update
     * and restore the previous one. Only callable by contract owner.
     */
    function revokePendingMaxFeeAmountUSDUpdate() external;

    /**
     * @dev Function to return whether the oracle's data feed is challengeable
     * or not.
     * Will return `false` in that implementation.
     */
    function getChallengeable() external view returns (bool);

    /**
     * @dev Function to return the excess fee recipient info.
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
     * @dev Function to return the minimum period (in seconds) a reported
     * value has to remain undisputed in order to be considered valid.
     */
    function getMinPeriodUndisputed() external pure returns (uint32);

    /**
     * @dev Function to return the max USD fee amount info.
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
     * @dev Function to return the DIVA address that the oracle is linked to.
     */
    function getDIVAAddress() external view returns (address);

    /**
     * @dev Function to return the array of tipping amounts for the given
     * array of `ArgsGetTipAmounts` struct.
     * @param _argsGetTipAmounts Struct array containing poolIds and tipping
     * tokens.
     */
    function getTipAmounts(ArgsGetTipAmounts[] calldata _argsGetTipAmounts)
        external
        view
        returns (uint256[][] memory);

    /**
     * @dev Function to return the list of reporter addresses that are entitled
     * to receive the fees/tips for the provided poolIds. Note that it returns
     * the zero address if a value has been reported to the Tellor contract
     * but it hasn't been pulled into DIVA Protocol by calling
     * `setFinalReferenceValue` yet.
     * @param _poolIds Array of poolIds.
     */
    function getReporters(uint256[] calldata _poolIds)
        external
        view
        returns (address[] memory);

    /**
     * @dev Function to return the array of tipping tokens for the given array
     * of `ArgsGetTippingTokens` struct.
     * @param _argsGetTippingTokens Struct array containing poolId,
     * start index and end index
     */
    function getTippingTokens(
        ArgsGetTippingTokens[] calldata _argsGetTippingTokens
    ) external view returns (address[][] memory);

    /**
     * @dev Function to return the lengths of tipping tokens for the given
     * `_poolIds`.
     * @param _poolIds Array of poolIds.
     */
    function getTippingTokensLengthForPoolIds(uint256[] calldata _poolIds)
        external
        view
        returns (uint256[] memory);

    /**
     * @dev Function to return the array of poolIds reported by reporters for
     * the given array of `ArgsGetPoolIdsForReporters` struct.
     * @param _argsGetPoolIdsForReporters Struct array containing reporter
     * address, start index and end index.
     */
    function getPoolIdsForReporters(
        ArgsGetPoolIdsForReporters[] calldata _argsGetPoolIdsForReporters
    ) external view returns (uint256[][] memory);

    /**
     * @dev Function to return the lengths of poolIds reported by reporters
     * for the given `_reporters`.
     * @param _reporters Array of reporter address.
     */
    function getPoolIdsLengthForReporters(address[] calldata _reporters)
        external
        view
        returns (uint256[] memory);

    /**
     * @dev Returns the DIVA ownership contract address.
     */
    function getOwnershipContract() external view returns (address);

    /**
     * @dev Returns the activation delay in seconds.
     */
    function getActivationDelay() external pure returns (uint256);

    /**
     * @dev Function to return the query id for a given `_poolId`.
     * @param _poolId The id of the pool.
     */
    function getQueryId(uint256 _poolId) external view returns (bytes32);
}
