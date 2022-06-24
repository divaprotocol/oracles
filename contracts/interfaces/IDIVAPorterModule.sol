// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDIVAPorterModule {
    // Argument for `createContingentPool` function
    struct PorterPoolParams {
        address referenceAsset;
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
     * @dev Function to set the final reference value for a given `poolId`.
     * @param _divaDiamond Address of the diva smart contract. Used as argument
     * rather than a hard-coded constant to avoid redeploying the oracle contracts
     * when a new version of DIVA Protocol is released.
     * @param _poolId The unique identifier of the pool.
     */
    function setFinalReferenceValue(address _divaDiamond, uint256 _poolId)
        external;

    /**
     * @notice Function to create contingent pool
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
    function challengeable() external view returns (bool);

    /**
     * @dev Returns Bond Factory address
     */
    function getBondFactoryAddress() external view returns (address);
}
