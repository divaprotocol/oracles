// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IBondFactory {
    /**
        @notice Emitted when a new bond is created.
        @param newBond The address of the newly deployed bond.
    */
    event BondCreated(address newBond);

    /**
        @notice Creates a new Bond. The calculated ratios are rounded down.
        @param name Passed into the ERC20 token to define the name.
        @param symbol Passed into the ERC20 token to define the symbol.
        @param paymentToken The ERC20 token address the Bond is redeemable for.
        @return bondAddress The address of the newly created Bond.
    */
    function createBond(
        string memory name,
        string memory symbol,
        address paymentToken
    ) external returns (address bondAddress);

    /**
        @notice Returns whether or not the given address key is a bond created
            by this Bond factory.
        @dev This mapping is used to check if a bond was issued by this contract
            on-chain. For example, if we want to make a new contract that
            accepts any issued Bonds and exchanges them for new Bonds, the
            exchange contract would need a way to know that the Bonds are owned
            by this contract.
    */
    function isBond(address) external view returns (bool);
}
