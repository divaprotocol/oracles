// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.19;

interface IBondFactory {
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
