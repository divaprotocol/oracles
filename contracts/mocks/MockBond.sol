// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../interfaces/IBond.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract MockBond is IBond, Ownable, ERC20 {
    /**
        @notice A period of time after maturity in which bond redemption is
            disallowed for non fully paid bonds. This restriction is lifted 
            once the grace period has ended. The issuer has the ability to
            pay during this time to fully pay the bond. 
    */
    uint256 internal constant GRACE_PERIOD = 10 minutes; // 7 days in real Porter Bond

    uint256 public maturity;
    address public paymentToken;

    constructor(
        string memory bondName,
        string memory bondSymbol,
        address _paymentToken
    ) ERC20(bondName, bondSymbol) {
        maturity = block.timestamp; // provided when create Bond in real Porter Bond
        paymentToken = _paymentToken;
    }

    function gracePeriodEnd()
        public
        view
        override
        returns (uint256 gracePeriodEndTimestamp)
    {
        gracePeriodEndTimestamp = maturity + GRACE_PERIOD;
    }

    function paymentBalance()
        public
        view
        override
        returns (uint256 paymentTokens)
    {
        paymentTokens = IERC20Metadata(paymentToken).balanceOf(address(this));
    }

    function amountUnpaid()
        public
        view
        override
        returns (uint256 paymentTokens)
    {
        uint256 bondSupply = totalSupply();
        uint256 _paymentBalance = paymentBalance();

        if (bondSupply <= _paymentBalance) {
            return 0;
        }

        paymentTokens = bondSupply - _paymentBalance;
    }
}
