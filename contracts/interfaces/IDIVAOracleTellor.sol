// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAOracleTellor {
    // Thrown in the internal `_claimReward` function used in `claimReward`, 
    // `setFinalReferenceValue` and their respective batch versions if
    // rewards are claimed before a pool was confirmed.
    error NotConfirmedPool();

    // Thrown in `addTip` if user tries to add a tip for an already confirmed
    // pool.
    error AlreadyConfirmedPool();

    // Thrown in `updateExcessFeeRecipient` or constructor if the zero address
    // is passed as excess fee recipient address.
    error ZeroExcessFeeRecipient();

    // Thrown in `setFinalReferenceValue` if there is no data reported after
    // the expiry time for the specified pool.
    error NoOracleSubmissionAfterExpiryTime();

    // Thrown in `setFinalReferenceValue` if user tries to call the function
    // before the minimum period undisputed period has passed.
    error MinPeriodUndisputedNotPassed();

    // Thrown in constructor if zero address is provided as ownershipContract.
    error ZeroOwnershipContractAddress();

    // Thrown in governance related functions including `updateExcessFeeRecipient`
    // `updateMaxFeeAmountUSD`, `revokePendingExcessFeeRecipientUpdate`,
    // and `revokePendingMaxFeeAmountUSDUpdate` and `msg.sender` is not contract owner.
    error NotContractOwner(address _user, address _contractOwner);

    // Thrown in `updateExcessFeeRecipient` if there is already a pending
    // excess fee recipient address update.
    error PendingExcessFeeRecipientUpdate(
        uint256 _timestampBlock,
        uint256 _startTimeExcessFeeRecipient
    );

    // Thrown in `updateMaxFeeAmountUSD` if there is already a pending max USD
    // fee amount update.
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
     * @notice Emitted when the reward is claimed via the in `claimReward`
     * function.
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
     * @notice Emitted when the final reference value is set via the
     * `setFinalReferenceValue` function.
     * @param poolId The Id of the pool.
     * @param finalValue Tellor value expressed as an integer with 18 decimals.
     * @param expiryTime Pool expiry time as a unix timestamp in seconds.
     * @param timestamp Tellor value timestamp.
     */
    event FinalReferenceValueSet(
        uint256 indexed poolId,
        uint256 finalValue,
        uint256 expiryTime,
        uint256 timestamp
    );

    /**
     * @notice Emitted when the excess fee recipient is updated via
     * the `updateExcessFeeRecipient` function.
     * @param from Address that initiated the change (contract owner).
     * @param excessFeeRecipient New excess fee recipient address.
     * @param startTimeExcessFeeRecipient Timestamp in seconds since epoch at
     * which the new excess fee recipient will be activated.
     */
    event ExcessFeeRecipientUpdated(
        address indexed from,
        address indexed excessFeeRecipient,
        uint256 startTimeExcessFeeRecipient
    );

    /**
     * @notice Emitted when the max USD fee amount is updated via the
     * `updateMaxFeeAmountUSD` function.
     * @param from Address that initiated the change (contract owner).
     * @param maxFeeAmountUSD New max USD fee amount expressed as an
     * integer with 18 decimals.
     * @param startTimeMaxFeeAmountUSD Timestamp in seconds since epoch at
     * which the new max USD fee amount will be activated.
     */
    event MaxFeeAmountUSDUpdated(
        address indexed from,
        uint256 maxFeeAmountUSD,
        uint256 startTimeMaxFeeAmountUSD
    );

    /**
     * @notice Emitted when a pending excess fee recipient update is revoked
     * via the `revokePendingExcessFeeRecipientUpdate` function.
     * @param revokedBy Address that initiated the revocation.
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
     * @notice Emitted when a pending max USD fee amount update is revoked
     * via the `revokePendingMaxFeeAmountUSDUpdate` function.
     * @param revokedBy Address that initiated the revocation.
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

    // Struct for `batchAddTip` function input.
    struct ArgsBatchAddTip {
        uint256 poolId;
        uint256 amount;
        address tippingToken;
    }
    
    // Struct for `batchClaimReward` function input.
    struct ArgsBatchClaimReward {
        uint256 poolId;
        address[] tippingTokens;
        bool claimDIVAReward;
    }

    // @todo add batch functions to function overview in docs
    // Struct for `batchSetFinalReferenceValue` function input.
    struct ArgsBatchSetFinalReferenceValue {
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
     * @param _poolId The Id of the pool.
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
     * @notice Batch version of `addTip`.
     * @param _argsBatchAddTip Struct array containing poolIds, amounts
     * and tipping tokens.
     */
    function batchAddTip(
        ArgsBatchAddTip[] calldata _argsBatchAddTip
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
     * @notice Batch version of `claimReward`.
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
     * @param _poolId The Id of the pool.
     * @param _tippingTokens Array of tipping tokens to claim.
     * @param _claimDIVAReward Flag indicating whether to claim the DIVA reward.
     */
    function setFinalReferenceValue(
        uint256 _poolId,
        address[] calldata _tippingTokens,
        bool _claimDIVAReward
    ) external;

    /**
     * @notice Batch version of `setFinalReferenceValue`.
     * @param _argsBatchSetFinalReferenceValue Struct array containing poolIds, tipping
     * tokens, and `claimDIVAReward` flag.
     */
    function batchSetFinalReferenceValue(
        ArgsBatchSetFinalReferenceValue[] calldata _argsBatchSetFinalReferenceValue
    ) external;

    /**
     * @notice Function to update the excess fee recipient address.
     * @dev Activation is restricted to the contract owner and subject
     * to a 3-day delay.
     *
     * Reverts if:
     * - `msg.sender` is not contract owner.
     * - provided address equals zero address.
     * - there is already a pending excess fee recipient address update.
     * @param _newExcessFeeRecipient New excess fee recipient address.
     */
    function updateExcessFeeRecipient(address _newExcessFeeRecipient) external;

    /**
     * @notice Function to update the maximum amount of DIVA reward that
     * a reporter can receive, denominated in USD.
     * @dev Activation is restricted to the contract owner and subject
     * to a 3-day delay.
     *
     * Reverts if:
     * - `msg.sender` is not contract owner.
     * - there is already a pending amount update.
     * @param _newMaxFeeAmountUSD New amount expressed as an integer with
     * 18 decimals.
     */
    function updateMaxFeeAmountUSD(uint256 _newMaxFeeAmountUSD) external;

    /**
     * @notice Function to revoke a pending excess fee recipient update
     * and restore the previous one.
     * @dev Reverts if:
     * - `msg.sender` is not contract owner.
     * - new excess fee recipient is already active.
     */
    function revokePendingExcessFeeRecipientUpdate() external;

    /**
     * @notice Function to revoke a pending max USD fee amount update
     * and restore the previous one. Only callable by contract owner.
     * @dev Reverts if:
     * - `msg.sender` is not contract owner.
     * - new amount is already active.
     */
    function revokePendingMaxFeeAmountUSDUpdate() external;

    /**
     * @notice Function to return whether the oracle's data feed is challengeable
     * or not. Will return `false` in that implementation.
     */
    function getChallengeable() external view returns (bool);

    /**
     * @notice Function to return the excess fee recipient info.
     * @dev The initial excess fee recipient is set when the contract is deployed.
     * The previous excess fee recipient is set to the zero address initially.
     * @return previousExcessFeeRecipient Previous excess fee recipient address.
     * @return excessFeeRecipient Latest update of the excess fee recipient address.
     * @return startTimeExcessFeeRecipient Timestamp in seconds since epoch at which
     * `excessFeeRecipient` is activated.
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
     * @notice Function to return the minimum period (in seconds) a reported
     * value has to remain undisputed in order to be considered valid
     * (12 hours = 43'200 seconds).
     */
    function getMinPeriodUndisputed() external pure returns (uint32);

    /**
     * @notice Function to return the max USD fee amount info.
     * @dev The initial value is set when the contract is deployed.
     * The previous value is set to zero initially.
     * @return previousMaxFeeAmountUSD Previous value.
     * @return maxFeeAmountUSD Latest update of the value.
     * @return startTimeMaxFeeAmountUSD Timestamp in seconds since epoch at which
     * `maxFeeAmountUSD` is activated.
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
     * @notice Function to return the DIVA contract address that the oracle
     * is linked to.
     * @dev The address is set at contract deployment.
     */
    function getDIVAAddress() external view returns (address);

    /**
     * @notice Function to return the array of tipping amounts for the given
     * struct array of poolIds and tipping tokens.
     * @param _argsGetTipAmounts Struct array containing poolIds and tipping
     * tokens.
     */
    function getTipAmounts(ArgsGetTipAmounts[] calldata _argsGetTipAmounts)
        external
        view
        returns (uint256[][] memory);

    /**
     * @notice Function to return the list of reporter addresses that are entitled
     * to receive rewards for the provided poolIds.
     * @dev If a value has been reported to the Tellor contract but hasn't been 
     * pulled into the DIVA contract via the `setFinalReferenceValue` function yet,
     * the function returns the zero address.
     * @param _poolIds Array of poolIds.
     */
    function getReporters(uint256[] calldata _poolIds)
        external
        view
        returns (address[] memory);

    /**
     * @notice Function to return an array of tipping tokens for the given struct
     * array of poolIds, along with start and end indices to manage the return
     * size of the array.
     * @param _argsGetTippingTokens Struct array containing poolId,
     * start index and end index.
     */
    function getTippingTokens(
        ArgsGetTippingTokens[] calldata _argsGetTippingTokens
    ) external view returns (address[][] memory);

    /**
     * @notice Function to return the number of tipping tokens for the given
     * poolIds.
     * @param _poolIds Array of poolIds.
     */
    function getTippingTokensLengthForPoolIds(uint256[] calldata _poolIds)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Function to return an array of poolIds that a reporter is
     * eligible to claim rewards for. It takes a struct array of reporter
     * addresses, as well as the start and end indices to manage the return
     * size of the array.
     * @param _argsGetPoolIdsForReporters Struct array containing reporter
     * address, start index and end index.
     */
    function getPoolIdsForReporters(
        ArgsGetPoolIdsForReporters[] calldata _argsGetPoolIdsForReporters
    ) external view returns (uint256[][] memory);

    /**
     * @notice Function to return the number of poolIds a given list of
     * reporter addresses are eligible to claim rewards for.
     * @param _reporters Array of reporter addresses.
     */
    function getPoolIdsLengthForReporters(address[] calldata _reporters)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Returns the DIVA ownership contract address that stores
     * the contract owner.
     */
    function getOwnershipContract() external view returns (address);

    /**
     * @notice Returns the activation delay in seconds (3 days = 259'200 seconds).
     */
    function getActivationDelay() external pure returns (uint256);

    /**
     * @notice Function to return the query Id for a given poolId.
     * @param _poolId The Id of the pool.
     */
    function getQueryId(uint256 _poolId) external view returns (bytes32);
}
