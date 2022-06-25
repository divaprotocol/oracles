// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @title Shortened version of the interface including required functions only
 */
interface IDIVA {
    // Settlement status
    enum Status {
        Open,
        Submitted,
        Challenged,
        Confirmed
    }

    // Collection of pool related parameters
    struct Pool {
        uint256 floor;
        uint256 inflection;
        uint256 cap;
        uint256 gradient;
        uint256 collateralBalance;
        uint256 finalReferenceValue;
        uint256 capacity;
        uint256 statusTimestamp;
        address shortToken;
        uint96 payoutShort;
        address longToken;                  
        uint96 payoutLong;
        address collateralToken;
        uint96 expiryTime;
        address dataProvider;
        uint96 protocolFee;
        uint96 settlementFee;
        Status statusFinalReferenceValue;
        string referenceAsset;
    }

    // Argument for `createContingentPool` function
    struct PoolParams {
        string referenceAsset;
        uint96 expiryTime;
        uint256 floor;
        uint256 inflection;
        uint256 cap;
        uint256 gradient;
        uint256 collateralAmount;
        address collateralToken;
        address dataProvider;
        uint256 capacity;
    }

    /**
     * @dev Throws if called by any account other than the `dataProvider`
     * specified in the contract parameters. Current implementation allows
     * for positive final values only. For negative metrices, choose the
     * negated or shifted version as your reference asset (e.g., -LIBOR).
     * @param _poolId The pool Id for which the settlement value is submitted
     * @param _finalReferenceValue Proposed settlement value by the data
     * feed provider
     * @param _allowChallenge Toggle to enable/disable the challenge
     * functionality. If 0, then the submitted reference value will
     * immediately go into confirmed status, a challenge will not be possible.
     * This parameter was introduced to allow automated oracles (e.g.,
     * Tellor, Uniswap v3, Chainlink) to settle without dispute.
     */
    function setFinalReferenceValue(
        uint256 _poolId,
        uint256 _finalReferenceValue,
        bool _allowChallenge
    ) external;

    /**
     * @notice Function to transfer fee claims to another account. To be
     * called by oracle contract after a user has triggered the reference
     * value feed and settlement fees were assigned
     * @dev `msg.sender` has to have a fee claim allocation in order to initiate
     * the transfer
     * @param _recipient Recipient address of the fee claim
     * @param _collateralToken Collateral token address
     * @param _amount Amount expressed in collateral token to transfer to
     * recipient
     */
    function transferFeeClaim(
        address _recipient,
        address _collateralToken,
        uint256 _amount
    ) external;

    /**
     * @notice Function to issue long and the short position tokens to
     * `msg.sender` upon collateral deposit. Provided collateral is kept inside
     * the contract until position tokens are redeemed by calling
     * `redeemPositionToken` or `removeLiquidity`.
     * @dev Position token supply equals `collateralAmount` (minimum 1e6).
     * Position tokens have the same amount of decimals as the collateral token.
     * Only ERC20 tokens with 6 <= decimals <= 18 are accepted as collateral.
     * Tokens with flexible supply like Ampleforth should not be used. When
     * interest/yield bearing tokens are considered, only use tokens with a
     * constant balance mechanism such as Compound's cToken or the wrapped
     * version of Lido's staked ETH (wstETH).
     * ETH is not supported as collateral in v1. It has to be wrapped into WETH
       before deposit.
     * @param _poolParams Struct containing the pool specification:
     * - referenceAsset: The name of the reference asset (e.g., Tesla-USD or
         ETHGasPrice-GWEI).
     * - expiryTime: Expiration time of the position tokens expressed as a unix
         timestamp in seconds.
     * - floor: Value of underlying at or below which the short token will pay
         out the max amount and the long token zero.
     * - inflection: Value of underlying at which the long token will payout
         out `gradient` and the short token `1-gradient`.
     * - cap: Value of underlying at or above which the long token will pay
         out the max amount and short token zero.
     * - gradient: Long token payout at inflection. The short token payout at
         inflection is `1-gradient`.
     * - collateralAmount: Collateral amount to be deposited into the pool to
         back the position tokens.
     * - collateralToken: ERC20 collateral token address.
     * - dataProvider: Address that is supposed to report the final value of
         the reference asset.
     * - capacity: The maximum collateral amount that the pool can accept.
     * @return poolId
     */
    function createContingentPool(PoolParams calldata _poolParams)
        external
        returns (uint256);

    /**
     * @notice Returns the pool parameters for a given pool Id
     * @param _poolId Id of the pool
     * @return Pool struct
     */
    function getPoolParameters(uint256 _poolId)
        external
        view
        returns (Pool memory);

    /**
     * @dev Returns the claims by collateral tokens for a given account
     * @param _recipient Account address
     * @param _collateralToken Collateral token address
     * @return Array of Claim structs
     */
    function getClaims(address _collateralToken, address _recipient)
        external
        view
        returns (uint256);
}
