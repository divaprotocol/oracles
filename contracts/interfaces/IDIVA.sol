// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

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
        uint96 redemptionFee;
        uint96 settlementFee;
        Status statusFinalReferenceValue;
        string referenceAsset;
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
    function getClaims(address _collateralToken, address _recipient) external view returns (uint256);
}
