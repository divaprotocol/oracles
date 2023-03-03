// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAPorterModule {
    // Argument for `createContingentPool` function inside DIVAPorterModule contract.
    // Note that `expiryTime` is automatically set to the end of the grace period,
    // `floor` to zero, `cap` to the total bond supply and `dataProvider` to `this` inside
    // the DIVAPorterModule's `createContingentPool` function.
    // Further note that `referenceAsset` is an address rather than a string.
    struct PorterPoolParams {
        address referenceAsset;
        uint256 inflection;
        uint256 gradient;
        uint256 collateralAmount;
        address collateralToken;
        uint256 capacity;
        address longRecipient;
        address shortRecipient;
        address permissionedERC721Token;
    }

    /**
     * @dev Function to set the final reference value for a given `poolId`.
     * @param _divaDiamond Address of the diva smart contract. Used as argument
     * rather than a hard-coded constant to avoid redeploying the oracle contracts
     * when a new version of DIVA Protocol is released.
     * @param _poolId The id of the pool.
     */
    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId)
        external;

    /**
     * @notice Function to create contingent pool. Note that as opposed to DIVA Protocol,
     * expiryTime is automatically set to the end of the grace period. Further note that
     * referenceAsset is an address rather than a string.
     * @dev Position token supply equals `collateralAmount` (minimum 1e6).
     * Position tokens have the same amount of decimals as the collateral token.
     * Only ERC20 tokens with 6 <= decimals <= 18 are accepted as collateral.
     * Tokens with flexible supply like Ampleforth should not be used. When
     * interest/yield bearing tokens are considered, only use tokens with a
     * constant balance mechanism such as Compound's cToken or the wrapped
     * version of Lido's staked ETH (wstETH).
     * ETH is not supported as collateral in v1. It has to be wrapped into WETH
       before deposit.
     * @param _divaDiamond Address of the diva smart contract. Used as argument
     * rather than a hard-coded constant to avoid redeploying the oracle contracts
     * when a new version of DIVA Protocol is released.
     * @param _porterPoolParams Struct containing the pool specification:
     * - referenceAsset: The address of bond contract.
     * - inflection: Value of underlying at which the long token will payout
         out `gradient` and the short token `1-gradient`.
     * - gradient: Long token payout at inflection. The short token payout at
         inflection is `1-gradient`.
     * - collateralAmount: Collateral amount to be deposited into the pool to
         back the position tokens.
     * - collateralToken: ERC20 collateral token address.
     * - capacity: The maximum collateral amount that the pool can accept.
     * - longRecipient: Address that shall receive the long token.
     * - shortRecipient: Address that shall receive the short token.
     * - permissionedERC721Token: Address of ERC721 token that is allowed to transfer the
     *   position token. Zero address if position token is supposed to be permissionless.
     * @return poolId
     */
    function createContingentPool(
        address _divaDiamond,
        PorterPoolParams calldata _porterPoolParams
    ) external returns (uint256);

    /**
     * @dev Function to update `_bondFactoryAddress`. Only callable by contract owner.
     * @param _newBondFactoryAddress New Bond Factory Address
     */
    function setBondFactoryAddress(address _newBondFactoryAddress) external;

    /**
     * @dev Returns whether the oracle's data feed is challengeable or not.
     * Will return false in that implementation.
     */
    function getChallengeable() external view returns (bool);

    /**
     * @dev Returns Bond Factory address
     */
    function getBondFactoryAddress() external view returns (address);
}
