// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../interfaces/IBond.sol";
import "../interfaces/IBondFactory.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./MockBond.sol";

contract MockBondFactory is IBondFactory, Ownable {
    mapping(address => bool) public isBond;

    function createBond(
        string memory name,
        string memory symbol,
        address paymentToken
    ) external onlyOwner returns (address bondAddress) {
        MockBond _bond = new MockBond(name, symbol, paymentToken);
        bondAddress = address(_bond);
        isBond[bondAddress] = true;

        emit BondCreated(bondAddress);
    }
}
