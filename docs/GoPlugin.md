# Goplugin adapter for DIVA Protocol v1 - Documentation

This documentation outlines the functionality of the Tellor adapter for [DIVA Protocol v1][diva-protocol-docs].

## Table of contents

1. [Introduction](#introduction)

2. [Terminology](#terminology)

3. [System overview](#system-overview) \
   3.1 [Contract addresses and subgraphs](#contract-addresses-and-subgraphs) \
   3.2 [Ownership and privileges](#ownership-and-privileges) \
   3.3 [Upgradeability](#upgradeability)

4. [Goplugin contract](#tellor-contract) \
   4.1 [What is GoPlugin network](#what-is-goplugin-network) \
   4.2 [How GoPlugin network works](#how-goplugin-network-works) \

5. [GoPlugin adapter contract](#goplugin-adapter-contract) \
   5.1 [How to use the GoPlugin adapter](#how-to-use-the-tellor-adapter) \
   5.2 [Supported data feeds](#supported-data-feeds) \
   5.3 [Reporting software](#reporting-software) \
   5.4 [Reporting rewards](#reporting-rewards) \
   5.5 [Reporting costs](#reporting-costs) \
   5.6 [Function overview](#function-overview) \
   5.7 [Core functions](#core-functions) \
   5.8 [Getter functions](#getter-functions) \
   5.9 [Reentrancy protection](#reentrancy-protection) \
   5.10 [Events](#events) \
   5.11 [Errors](#errors) \
   5.12 [Risks and mitigants](#risks-and-mitigants)

6. [Links](#links)

# TODO

* Add `showPrice()` example in test script
* Add batch versions (in a separate PR)

# Introduction

# How to use it

* Assign the data feed contract address as the reference asset in DIVA Protocol.
* Assign the `GoPlugin` adapter contract address as the data provider.

# How it works

## PLI Funding
* Each data request costs 0.1 PLI (`1e17` in integer terms) and has to be paid upfront by funding the corresponding GoPlugin data feed contract (for instance, 0x1dE804CAd726E505F0AF221dDAd1BA7Ca1742B3F for XDC/USDT on Apothem testnet).
* The data feed contract must be funded with at least 1 PLI (`1e18` in integer terms) by the data requester.
* In the case of the `DIVAGoplugin` adapter, the requesting contract is the `DIVAGoplugin` contract. As a result, the `DIVAGoplugin` contract has to be funded with sufficient PLI in order to work. This happens automatically when calling [`requestFinalReferenceValue`](#requestfinalreferencevalue) in case of insufficient balance. Alternatively, any user can fund the `DIVAGoplugin` contract with PLI via a direct transfer transaction and with that sponsor data requests.
* If the `DIVAGoplugin` contract has a zero balance at the start, the very first user that calls [`requestFinalReferenceValue`](#requestfinalreferencevalue) will have to fund the minimum amount of 1 PLI. Any subsequent call will only transfer the standard fee amount of 0.1 PLI. Caller of [`requestFinalReferenceValue`](#requestfinalreferencevalue) must approve the corresponding PLI amount before.


## Requesting a final value
* After approving PLI to the `DIVAGoplugin` contract, anyone can call the [`requestFinalReferenceValue`](#requestfinalreferencevalue) to request the final value.
* A unique `requestId` is generated. It takes a maximum of 20 seconds until the value is reported by the Goplugin network.

## Submitting the final value to DIVA Protocol
* After a value has been submitted, anyone can trigger the [`setFinalReferenceValue`](#setfinalreferencevalue) to push the value reported and attached to the corresponding `requestId` to DIVA Protocol, which then determines the payouts for LONG and SHORT position token holder.


## requestFinalReferenceValue

Function to request a data point from the GoPlugin network for a given pool.



The function executes the following steps in the following order:
1. Check that the pool expired (i.e. `block.timestamp >= expiryTime`)
1. Check that no value has been requested for the provided `_poolId` yet.
1. Store timestamp of request which is used as a check to avoid multiple requests for the same pool.
1. Cast reference asset string into address. 
1. Check that the `GoPlugin` adapter contract has funded the data feed contract with at least 1 PLI (`1e18` in integer terms). If that is not the case, it checks the `GoPlugin` adapter's PLI balance and if insufficient draws the missing part from the user, approves the PLI token to be transferred to the data feed contract and deposits it. **QUESTION: is the approve really needed here?**
1. Send data request and map the `requestId` to the provided `poolId`.
1. Emit a [`FinalReferenceValueRequested`](#finalreferencevaluerequested) and return the `requestId` on success.

>**Note:** the value reported by the GoPlugin network has 4 decimals (e.g., 10'000 for 1) and it needs to be converted to 18 decimals expected by DIVA Protocol.

The function reverts under the following conditions:
- Pool is not yet expired.
- A final value has already been requested for the pool.
- Caller has insufficient PLI balance or allowance set.


```js
function requestFinalReferenceValue(
    uint256 _poolId
) external returns (bytes32);
```

## setFinalReferenceValue

The function executes the following steps in the following order:
1. ... 
1. ...

The function reverts under the following conditions:
- ...
- ...

```js
function setFinalReferenceValue(uint256 _poolId) external;
```

## Reentrancy protection

All state-modifying functions, including their batch versions, implement [openzeppelin's `nonReentrant` modifier][openzeppelin-reentrancy-guard] to protect against reentrancy attacks, with the exception of governance related functions.

# Events

## FinalReferenceValueRequested
...


# Links
* [GoPlugin website][goplugin-website]
* [DIVA Protocol documentation][diva-protocol-docs]

[openzeppelin-reentrancy-guard]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/security/ReentrancyGuard.sol
[diva-protocol-docs]: https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md
[goplugin-website]: https://www.goplugin.co/
[goplugin-adapter-contract]: https://github.com/divaprotocol/oracles/blob/update-documentation/contracts/DIVAGoplugin.sol