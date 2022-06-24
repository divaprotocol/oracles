// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IBond {
    /**
        @notice The amount of paymentTokens required to fully pay the contract.
        @return paymentTokens The number of paymentTokens unpaid.
    */
    function amountUnpaid() external view returns (uint256 paymentTokens);

    /**
        @notice A date set at Bond creation when the Bond will mature.
        @return The maturity date as a timestamp.
    */
    function maturity() external view returns (uint256);

    /**
        @notice Gets the external balance of the ERC20 paymentToken.
        @return paymentTokens The number of paymentTokens in the contract.
    */
    function paymentBalance() external view returns (uint256 paymentTokens);

    /**
        @notice One week after the maturity date. Bond collateral can be 
            redeemed after this date.
        @return gracePeriodEndTimestamp The grace period end date as 
            a timestamp. This is always one week after the maturity date
    */
    function gracePeriodEnd()
        external
        view
        returns (uint256 gracePeriodEndTimestamp);

    /**
        @notice This is the token the borrower deposits into the contract and
            what the Bond holders will receive when redeemed.
        @return The address of the token.
    */
    function paymentToken() external view returns (address);
}
