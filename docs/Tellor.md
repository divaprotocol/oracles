# Tellor adapter for DIVA Protocol v1 - Documentation

This documentation outlines the functionality of the Tellor adapter for [DIVA Protocol v1](https://github.com/divaprotocol/diva-contracts).

## Table of contents

1. [Introduction](#introduction)
2. [System overview](#system-overview)  \
   2.1 [Tellor contract](#tellor-contract)
2. [Function overview](#function-overview)
3. [Core functions](#core-functions)
4. [Getter functions](#getter-functions)
5. [Setter functions](#setter-functions)
6. [Events](#events)
7. [Errors](#errors)

# Introduction

Derivative contracts created on DIVA Protocol require one data input following expiration. The Tellor adapter offers DIVA Protocol users a decentralized oracle solution for outcome reporting.

The key benefits of using the Tellor adapter for outcome reporting include:
- No single point of failure as outcome reporting is decentralized and permissionless.
- No interruption in the reporting process following disputes, eliminating the need for additional requests.
- Option to add tips for additional reporting incentives.

These advantages provide users with a high level of confidence in correct settlement. The following sections provide an overview of the Tellor protocol, how the adapter works, and how it can be used.

Please refer to the ["Risks and Mitigants"](#risks-and-mitigants) section for a comprehensive understanding of potential risks involved in using the Tellor adapter.

>**Terminology:** As funds backing the derivative contracts are held in so-called "contingent pools", the terms "derivative" and "contingent pool" (or simply "pool") are used interchangeably.

# System overview

The DIVA Tellor integration is an interplay between three smart contracts:

* **Tellor contract:** A key-value store where anyone can submit values to.
* **DIVA contract:** The DIVA smart contract that expects outcome reporting for expired pools.
* **Tellor adapter contract:** The contract that pulls the value from Tellor contract and passes it on to the DIVA contract for settlement.

The interplay is visualized below. For the sake of simplicity, the reward claim process has been omitted from the illustration.

![Tellor-v2 drawio (1)](https://user-images.githubusercontent.com/37043174/223348671-6072d550-ad07-4dff-aafa-99b7d048c53e.png)

This documentation will describe the process of reporting values to the Tellor contract and pushing them into DIVA Protocol via the Tellor adapter. To learn more about DIVA Protocol and the settlement process, please refer to their official [DIVA Protocol documentation][diva-protocol-docs].

## Contract addresses

Relevant contract addresses and subgraph urls are summarized below, grouped by network:

| Name                       |                                                                             |                        
| :------------------------- | :-------------------------------------------------------------------------- | 
| Tellor contract              | Address of the contract where values are reported to and TRB is staked.                                | 
| Tellor adapter contract    | Address of the contract that connects the Tellor contract with the DIVA contract and is used as data provider when creating a pool.                                |
| DIVA contract    | Address of the DIVA contract.                                |
| TRB token                  | Address of the TRB token needs to be staked in order to be able to report values to the Tellor contract.                                | 
| Tellor governance contract | Address of the contract that handles Tellor disputes.                                | 
| DIVA subgraph              | Subgraph url containing DIVA pool related information. |   

### Ethereum
| Name                       |                                                                             |                        
| :------------------------- | :-------------------------------------------------------------------------- | 
| Tellor contract              | `tbd`                                | 
| Tellor adapter contract    | `tbd`                                |
| DIVA contract    | `tbd`                                |
| TRB token                  | `tbd`                                | 
| Tellor governance contract | `tbd`                                | 
| DIVA subgraph              | tbd |   


### Polygon
| Name                       |                                                                             |                        
| :------------------------- | :-------------------------------------------------------------------------- | 
| Tellor contract              | `tbd`                                | 
| Tellor adapter contract    | `tbd`                                |
| DIVA contract    | `tbd`                                |
| TRB token                  | `tbd`                                | 
| Tellor governance contract | `tbd`                                | 
| DIVA subgraph              | tbd |   

### Gnosis
| Name                       |                                                                             |                        
| :------------------------- | :-------------------------------------------------------------------------- | 
| Tellor contract              | `tbd`                                | 
| Tellor adapter contract    | `tbd`                                |
| DIVA contract    | `tbd`                                |
| TRB token                  | `tbd`                                | 
| Tellor governance contract | `tbd`                                | 
| DIVA subgraph              | tbd |   

### Arbitrum
| Name                       |                                                                             |                        
| :------------------------- | :-------------------------------------------------------------------------- | 
| Tellor contract              | `tbd`                                | 
| Tellor adapter contract    | `tbd`                                |
| DIVA contract    | `tbd`                                |
| TRB token                  | `tbd`                                | 
| Tellor governance contract | `tbd`                                | 
| DIVA subgraph              | tbd |   

### Goerli
| Name                       |                                                                             |                        
| :------------------------- | :-------------------------------------------------------------------------- | 
| Tellor contract              | `tbd`                                | 
| Tellor adapter contract    | `tbd`                                |
| DIVA contract    | `tbd`                                |
| TRB token                  | `tbd`                                | 
| Tellor governance contract | `tbd`                                | 
| DIVA subgraph              | tbd |   

<!-- 
Note that depositing a stake or or disputing a value requires prior approval for the TRB token for the corresponding contract to transfer the token. -->

## Ownership and privileges

The Tellor adapter contract implements an owner which is inherited from the DIVA Ownership contract, which is the same contract that DIVA Protocol inherits their owner from. The owner is authorized to update the maximum amount of DIVA rewards that a reporter can receive, denominated in USD, as well as the recipient of any excess fee. 

The update process is the same as in DIVA Protocol. The owner initiates an update of the relevant value, which only becomes effective after a pre-defined delay. In the Tellor adapter contract, this delay is fixed at 3 days and cannot be modified. However, during this delay period, the contract owner has the ability to cancel the update if needed.

## Upgradeability

The Tellor adapter contract is not upgradeable.



# Tellor contract

The Tellor contract is where reporters submit their values to be used in DIVA Protocol. In this section, we will provide an overview of the Tellor protocol is and explain how users can report values to the Tellor contract.

<!-- All the details about submitting DIVA related values to the Tellor contract are outlined in the [Tellor documentation][tellor-docs]. The easiest and safest way to obtain the right `queryId` for submitting values to Tellor is by using the [`getQueryDataAndId`](#getquerydataandid) inside the Tellor adapter contract. -->

## What is Tellor protocol

Tellor is a decentralized oracle protocol that allows smart contracts on EVM chains to securely and reliably access data from off-chain sources, including data from other chains. It uses a decentralized network of stakers to provide this data, and incentivizes them with the Tellor token (TRB) to maintain the integrity of the network.

## How Tellor protocol works

To participate in the Tellor protocol as a reporter, users must stake TRB tokens. The amount of TRB required for one stake is equal to the minimum of $1'500 or 100 TRB. This allows a reporter to submit one value every 12 hours. If a user wishes to submit more values during the same period, they must stake additional TRB tokens in proportion to the number of values they wish to submit. For example, if a user wants to submit two values every 12 hours, they must stake twice the amount of TRB required for one stake.

Assuming that the value of TRB is at least $15 (corresponding to 100 TRB required for one stake), the reporting process is as follows:
* Reporters submit values to a specific key, also known as queryId. Only one value can be reported per queryId and block.
* If a reported value is deemed incorrect, it can be disputed for a maximum of 12 hours from the time of reporting. Disputers pay a dispute fee starting at 10 TRB, which doubles up to a maximum of 100 TRB with each round of dispute for a given queryId.
* If a value gets disputed, it is removed from the key-value mapping and enters Tellor's [dispute resolution process](#disputes), which takes at least 2 days. The reporting process continues uninterrupted, allowing other reporters to submit valid values.

To ensure the reliability of reported data, only data reports that have remained undisputed for a specified duration (up to 12 hours) should be considered valid. The Tellor adapter selects a maximum duration of 12 hours and utilizes the earliest value that satisfies this criterion as the settlement value, ignoring any subsequent values that also meet the condition.

## Disputes

Any party can challenge data submissions of any reporters when a value is placed on-chain. A challenger must submit a dispute fee to each challenge. Once a challenge is submitted, the potentially malicious reporter who submitted the value is placed in a locked state for the duration of the vote. For the next two days, TRB holders vote on the validity of the reported value. All TRB holders have an incentive to maintain an honest oracle and can vote on the dispute. For more information, refer to the official [Tellor docs](https://docs.tellor.io/tellor/disputing-data/introduction).








# Tellor adapter contract

The Tellor adapter contract serves as a bridge that retrieves values reported to the Tellor contract and forwards them to the DIVA Protocol for settlement. In this section, we will provide an overview how the Tellor adapter works and how to use it.

## How to use the Tellor adapter

Using the Tellor adapter for outcome reporting in DIVA Protocol is as simple as assigning its network specific [contract address](#contract-addresses) as the data provider when creating a pool in DIVA Protocol.

The process after assigning the Tellor adapter as the data provider is outlined below:
1. **Monitoring:** Tellor reporters monitor expired pools requiring reporting by running special software, known as "Tellor clients". There are two available implementations, one developed by the [DIVA team](https://github.com/divaprotocol/diva-monorepo/tree/main/packages/diva-oracle) which is designed to report for DIVA pools exclusively and one by the [Tellor team](https://github.com/tellor-io/telliot-feeds) which is generic reporter not necessarily focused on DIVA. If you're planning to build your own reporter software, please refer to the [README](https://github.com/divaprotocol/oracles/blob/main/README.md) for guidance.
1. **Reporting to Tellor Protocol:** If a pool expires, reporters submit their values to the Tellor contract. Valid submissions must be made during the 7-day submission period (subject to change with a minimum of 3 days), starting at the time of pool expiration. Note that due to the dispute period of 12 hours, the effective submission period is shorter by that amount of time.
1. **Reporting to DIVA Protocol:** The first value submitted to the Tellor Protocol that remains undisputed for over 12h will be considered the final one. This value is submitted to DIVA Protocol by calling the [`setFinalReferenceValue`](#setfinalreferencevalue) function on the Tellor adapter contract. This sets the final reference value status inside the DIVA smart contract to "Confirmed" and determines the payouts for each counterparty involved in the derivative contract. No further submissions to DIVA Protocol are permitted thereafter. Disputed values will be disregarded and are handled in a separate process on the Tellor side.

>**Note:** Submissions to Tellor Protocol made before pool expiration or for already confirmed pools will not be considered. To reduce gas costs, it is recommended to verify the timestamps of the Tellor submissions and the status of the final reference value before calling the [`setFinalReferenceValue`](#setfinalreferencevalue) function on the Tellor adapter contract.

## Reporting incentives

Reporters in the DIVA Protocol-Tellor integration are incentivized to report outcomes through two mechanisms:
* Settlement fees
* Tips

### Settlement fees

- DIVA Protocol pays a settlement fee (initially, 0.05% of the gross collateral deposited into the pool over time) to the data provider, which in this case is the Tellor adapter contract. The fee is transferred to the actual reporter via DIVA Protocol's [`transferFeeClaim`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#transferfeeclaim) function when the [`setFinalReferenceValue`](#setfinalreferencevalue) function in the Tellor adapter contract is called.
- To obtain the applicable settlement fee for a pool, reporters can call DIVA Protocol's [`getPoolParameters()`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getpoolparameters) and pass the returned `indexFees` parameter to the [`getFees`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getfees) function.
- Reporters can calculate their fee reward by multiplying the gross collateral deposited into the pool during its lifetime (found in the `collateralBalanceGross` field in the subgraph) with the corresponding fee rate.
- The fee is paid in the pool's collateral token and is retained in the DIVA smart contract until claimed by the recipient through the [`claimFee`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#transferfeeclaim) function in the DIVA smart contract directly or via the [`claimReward`](#claimreward) convenience function in the Tellor adapter contract.
- The maximum reward paid per pool for a reporter is capped at USD 10, with the remaining reward going to the DIVA owner. This measure was implemented to prevent "dispute wars" where disputing valid submissions becomes a profitable strategy to receive an outsized reward. 
- For additional information, refer to the [DIVA Protocol docs](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md).

### Tips

- Anyone can incentivize reporting by adding tips in any ERC20 token. Multiple tips in different ERC20 tokens are allowed, and reporters can choose which tips to claim. Tips is retained in the Tellor adapter contract until claimed by the recipient through the [`claimTips`](#claimtips) function.
- DIVA Protocol also offers the possibility to tip via the `addTip` function, but the tipping token is restricted to the collateral token of the pool.

Notes:

- To calculate the split, the reporters also submit the USD value of the collateral token.
- Only the first reporter whose reported value remains undisputed for at least 12h will receive a reward. It is recommended to check existing value submission before spending gas on submitted a new one.

## Reporting Costs

Reporting involves calling two functions which combined costs c. 410k gas.

- `submitValue` (on Tellor contract): 160k gas
- `setFinalReferenceValue` (on Tellor adapter contract): 250k gas

At 100 Gwei/gas, the gas fee is 41m Gwei (0.041 ETH, 0.041 MATIC, etc.).

## Supported data feeds

The Tellor protocol has the capability to handle any type of data. This universality extends to the Tellor adapter, which can be utilized with any data feed. To ensure high coverage by reporters, it's suggested to check with the Tellor community which data feeds are well-established and which may need extra support and communication.

## DIVA Disputes

The Tellor adapter deactivates the possibility to challenge within DIVA Protocol as the Tellor system comes with its own dispute mechanism. In other words, the value that is reported to DIVA Protocol via the Tellor adapter is immediately confirmed and considered the final one.

# Risks and mitigants

| Risks                                                                                                                                                | Mitigants                                                                                                           |
| :--------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| No value is reported because the cost of reporting exceeds the expected fee reward (e.g., if gas price is high or fee reward is small).              | Add tips as additional incentive to report or report yourself.                                                      |
| No value is reported because the data point is not publicly available.                                                                               | Choose publicly available and verifiable data as underlyings.                                                       |
| Inaccurate value submitted to Tellor Protocol remains undisputed for more than 12h and pushed into DIVA Protocol resulting in inaccurate settlement. | Choose underlyings that are monitored and reported by many reporters.                                               |
| Bug in Tellor adapter contract.                                                                                                                      | Both the Tellor Protocol as well as the Tellor adapter contract have been audited to reduce the likelihood of bugs. |

## How to manually report a value

**NOTE:** All links and addresses refer to Goerli. will be updated at mainnet launch.

Position token holders that are in the money have a natural incentive to report the outcome. Follow the steps described below or watch our [video guide](www.google.com) to learn how to manually report a value in the event that no one else is reporting, using Goerli network as an example.

1. **Get TRB token:** Get 100 TRB which is the minimum stake to report once every 12 hours.
1. **Approve transfer for stake deposit:** On [Etherscan](https://goerli.etherscan.io/address/0x51c59c6cAd28ce3693977F2feB4CfAebec30d8a2#writeProxyContract), call the `approve` function on the TRB contract with the following inputs:
   - `_spender`: `0xB3B662644F8d3138df63D2F43068ea621e2981f9` (Tellor contract)
   - `_amount`: `100000000000000000000` (integer representation of 100 using 18 decimals)
1. **Deposit stake:** On [Etherscan](https://goerli.etherscan.io/address/0xB3B662644F8d3138df63D2F43068ea621e2981f9#writeContract), call the `depositStake` function with the following input:
   - `_amount`: `100000000000000000000`
1. **Get data:** Obtain the underlying value as well as the USD value of the prevailing at the time of expiration from the data source of your choice. Use 0 if no USD value of the collateral asset is available.
1. **Convert decimal numbers to integers:** Convert data values represented as decimals into integers with 18 decimals, i.e. 100 -> `100000000000000000000`, 0.5 -> `500000000000000000`, etc.
1. **Get query data and Id:**
   - Query [`getQueryDataAndId`](#getquerydataandid) inside the Tellor adapter contract to receive the queryData and queryId
1. **Tellor submission:** On [Etherscan](https://goerli.etherscan.io/address/0xB3B662644F8d3138df63D2F43068ea621e2981f9#writeContract), call the `submitValue` function with the followig inputs:
   - `_queryId`: Query Id from the step above
   - `_value`: **TODO**
   - `_nonce`: **TODO**
   - `_queryData`: Query Data from the step before
1. **DIVA submission:** On [Etherscan](https://goerli.etherscan.io/address/0x9959f7f8eFa6B77069e817c1Af97094A9CC830FD#code), call the `setFinalReferenceValue` (or a variant of it) function on the DIVA Tellor adapter contract (`0x9959f7f8eFa6B77069e817c1Af97094A9CC830FD`) using the pool Id as input.

For help, reach out to the [DIVA discord](https://discord.com/invite/DE5b8ZeJjK) or the [Tellor discord](https://discord.com/invite/n7drGjh).

## How to add a tip manually

1. On [Etherscan](https://goerli.etherscan.io/address/0x9959f7f8eFa6B77069e817c1Af97094A9CC830FD#code), call the `addTip` function with the following inputs:
   - `_poolId`: the pool Id that the tip should apply to
   - `_amount`: tipping amount expressed as an integer (e.g., 100000000 for 100 USDC on Polygon which has 6 decimals; 100000000000000000000 for a token with 18 decimals)
   - `_tippingToken`: address of the tipping token (e.g., `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` for USDC on Polygon)

# Function overview

| Function                                                                                        | Description                                                                                                                          |     |
| :---------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | --- |
| **Core functions**                                                                              |                                                                                                                                      |
| [`addTip`](#addtip)                                                                             | Function to tip a pool.                                                                                                        |
| [`claimReward`](#claimreward)                                                                 | Function to claim tips and/or DIVA reward.                                                                                                     |
| [`setFinalReferenceValue`](#setfinalreferencevalue)                                             | Function to set the final reference value for a given `_poolId` and optionally clam tips and settlement fee in the same call.                                                                     |
| **Governance functions** (execution is reserved for DIVA owner only)                      |                                                                                                                                                             |
| [`updateExcessFeeRecipient`](#updateexcessfeerecipient)                                             | Function to update the excess fee recipient address.                                                                     |
| [`updateMaxFeeAmountUSD`](#updatemaxfeeamountusd)                                             | Function to update the maximum USD fee amount that goes to the reporter.                                                                     |
| [`revokePendingMaxFeeAmountUSDUpdate`](#revokependingmaxfeeamountusdupdate)                                             | Function to revoke a pending maximum USD fee amount update and restore the previous one.                                                                     |
| [`revokePendingExcessFeeRecipientUpdate`](#revokependingexcessfeerecipientupdate)                                             | Function to revoke a pending excess fee recipient address update and restore the previous one.                                                                     |
| **Getter functions**                                                                            |                                                                                                                                      |
| [`getChallengeable`](#getchallengeable)                                                         | Function to return whether the oracle's data feed is challengeable or not.                                                           |
| [`getExcessFeeRecipientInfo`](#getexcessfeerecipientinfo)                                               | Function to return the latest update of the excess fee recipient address, including the activation time and the previous value.                                                                                 |
| [`getMaxFeeAmountUSDInfo`](#getmaxfeeamountusdinfo)                                                     | Function to return the latest update of the max USD fee amount, including the activation time and the previous value.                                                                    |
| [`getMinPeriodUndisputed`](#getminperiodundisputed)                                             | Function to return the minimum period (in seconds) a reported value has to remain undisputed in order to be considered valid.        |
| [`getTippingTokens`](#gettippingtokens)                                                         | Function to return the array of tipping tokens for a given set of poolIds.                                 |
| [`getTippingTokensLengthForPoolIds`](#gettippingtokenslengthforpoolids)                         | Function to return the number of tipping tokens for the given set of poolIds.                                                           |
| [`getTipAmounts`](#gettipamounts)                                                               | Function to return the tipping amounts for a given set of poolIds and tipping tokens.                                      |
| [`getDIVAAddress`](#getdivaaddress)                                                             | Function to return the DIVA address that the oracle is linked to.                                                                    |
| [`getReporters`](#getreporters)                                                                 | Function to return the array of reporter addresses for the given `_poolIds`.                                                         |
| [`getPoolIdsForReporters`](#getpoolidsforreporters)                                             | Function to return the array of poolIds reported by reporters for a given set of reporter addresses.           |
| [`getPoolIdsLengthForReporters`](#getpoolidslengthforreporters)                                 | Function to return the number of poolIds reported by a reporter for a given set of reporters. Includes useful information for populating the argument for `getPoolIdsForReporters`.                                        |
| [`getOwnershipContract`](#getownershipcontract)                                                                         | Function to return the address of the ownership contract that stores the owner variable. Call the `getOwner` function on the returned contract address to obtain the DIVA owner.                                                                                                |
| [`getActivationDelay`](#getactivationdelay)                                                                 | Function to return the activation delay (in seconds) for governance related updates.                                                         |
| [`getQueryDataAndId`](#getquerydataandid)                                                                     | Function to return the query data and Id for a given poolId.                                                                               |
| **Batch functions**                                                                             |
| [`batchClaimReward`](#batchclaimreward)                                                       | Batch version of `claimReward` function.                                                                                                     |
| [`batchAddTip`](#batchaddtip)                                                       | Batch version of `addTip` function.                                                                                                     |
| [`batchSetFinalReferenceValue`](#batchsetfinalreferencevalue)                                                       | Batch version of `setFinalReferenceValue` function.                                                                                                     |

# Core functions

The Tellor adapter implements the following core functions.

## addTip

Function to tip a pool. Tips can be added in any ERC20 token until the final value has been submitted and confirmed in DIVA Protocol by successfully calling the [`setFinalReferenceValue`](#setfinalreferencevalue) function. Tips can be claimed via the [`claimReward`](#claimreward) function after final value confirmation. Refer to [`batchAddTip`](#batchaddtip) for the batch version of the function.

The function executes the following steps in the following order:
* Confirm that the final value hasn't been submitted to DIVA Protocol yet, in which case `_poolIdToReporter` would resolve to the zero address.
* Add a new entry in the `_poolIdToTippingTokens` array if the specified `_tippingToken` does not yet exist for the specified pool.
* Update balance before doing a potentially unsafe `safeTransferFrom` call. Requires prior user approval to succeed.
* Transfer tipping token from `msg.sender` to this contract.
* Emit a [`TipAdded`](#tipadded) event on success.

The function reverts under the following conditions:
* The final value has already been submitted and confirmed in DIVA Protocol.
* The `msg.sender` has set insufficient allowance for the `_tippingToken`.

```js
function addTip(
    uint256 _poolId,        // The Id of the pool
    uint256 _amount,        // The amount to tip expressed as an integer with tipping token decimals
    address _tippingToken   // Tipping token address
)
    external;
```

>**Note:** DIVA Protocol also has an `addTip` function, but it only allows tipping with the collateral token of the pool. When a tip is added through this function, it is credited to the data provider along with the settlement fees (combined referred to as DIVA reward) once the final value is confirmed.

## batchAddTip

Batch version of [`addTip`](#addtip).

```js
function batchAddTip(
    ArgsBatchAddTip[] calldata _argsBatchAddTip
)
    external;
```

where `ArgsBatchAddTip` is given by

```
struct ArgsBatchAddTip {
    uint256 poolId;         // The Id of the pool
    uint256 amount;         // The amount to tip expressed as an integer with tipping token decimals
    address tippingToken;   // Tipping token address
}
```

## claimReward

Function to claim tips and/or DIVA rewards. Users can specify which tips to claim from the Tellor adapter contract using the `_tippingTokens` array, and can indicate whether they want to claim the DIVA reward by setting the `_claimDIVAReward` parameter to `true`. Users can obtain the tipping tokens associated with a pool by calling the [`getTippingTokens`](#gettippingtokens) function.

It's important to note that rewards can only be claimed after the final value has been submitted and confirmed in the DIVA Protocol by successfully calling the [`setFinalReferenceValue`](#setfinalreferencevalue) function. This function can be triggered by anyone to transfer the rewards to the eligible reporter.

The function executes the following steps in the following order:
* Check that pool has already been confirmed.
* Check whether the caller has provided any tipping tokens in the `_tippingTokens` array. If tipping tokens are provided, the function will proceed with the following steps. If not, the function will skip these steps.
   * Retrieve the tip amount for the pool in the specified tipping token.
   * Set the tip amount to zero to prevent multiple payouts in case the same tipping token is provided multiple times.
   * Transfer the tip from the Tellor adapter contract to the eligible reporter stored in the `_poolIdToReporter` mapping (set during successful execution of the [`setFinalReferenceValue`](#setfinalreferencevalue) function).
   * Emit a [`TipClaimed`](#tipclaimed) event for each tipping token claimed.
* If the `_claimDIVAReward` parameter is set to `true`, the function will trigger the claim of the DIVA reward from the DIVA smart contract:
   * Retrieve the collateral token of the pool from the pool parameters stored within the DIVA smart contract.
   * Transfer the reward to the eligible reporter via the `claimFee` function.
   * Emit a `FeeClaimed` event on successful completion of the `claimFee` function.

>**Note: ** If no tipping tokens are provided and `_claimDIVAReward` is set to `false`, the function will not execute anything, but will not revert. Further note, that the DIVA reward can also be claimed directly from the DIVA smart contract by calling the `claimFee` function.

```js
function claimReward(
    uint256 _poolId,                    // The Id of the pool
    address[] memory _tippingTokens,    // Array of tipping tokens to claim
    bool _claimDIVAReward               // Flag indicating whether to claim the DIVA reward
)
    external;
```

## batchClaimReward

Batch version of [`claimReward`](#claimreward).

```js
function batchClaimReward(
    ArgsBatchClaimReward[] calldata _argsBatchClaimReward
)
    external;
```

where `ArgsBatchClaimReward` is given by

```
struct ArgsBatchClaimReward {
    uint256 poolId;             // The Id of the pool
    address[] tippingTokens;    // Array of tipping tokens to claim
    bool claimDIVAReward;       // Flag indicating whether to claim the DIVA reward
}
```

## setFinalReferenceValue

Function to set the final reference value for a given `_poolId`. It retrieves the first value that was submitted to the Tellor contract after the pool expiration and remained undisputed for at least 12 hours, and passes it on to the DIVA smart contract for settlement. The address of the reporter who submitted the final reference value to the Tellor smart contract will be stored within the `_poolIdToReporter` mapping and will be eligible to claim the reward. 

The caller, which can be anyone, can trigger the claim of the rewards in the same call by specifying which tips to claim from the Tellor adapter contract using the `_tippingTokens` array and/or by indicating whether to claim the DIVA reward by setting the `_claimDIVAReward` parameter to `true`. The tipping tokens associated with a pool can be obtained via the [`getTippingTokens`](#gettippingtokens) function. Any reward that is not claimed during this function call can be claimed later using the [`claimReward`](#claimreward) function.

If no tipping tokens are provided and `_claimDIVAReward` is set to `false`, the function will not claim any rewards and users can claim them separately via the [`claimReward`](#claimreward) function.

Note that the DIVA reward, which includes the settlement fee and any tip added via DIVA's `addTip` function (not to be confused with the [`addTip`](#addtip) function inside the Tellor adapter), is capped at USD 10. The remaining reward goes to the excess fee recipient address [set](#updateexcessfeerecipient) by the DIVA owner. This measure was implemented to prevent "dispute wars" where disputing valid submissions becomes a profitable strategy to receive an outsized reward. Note that tips added via the [`addTip`](#addtip) function to the Tellor adapter contract are not affected by this cap.

>**Important:** The function `setFinalReferenceValue` should be called within submission window of the pool. This window is restricted by the DIVA smart contract to a range of 3 to 15 days and can be retrieved via DIVA's `getSettlementPeriods` function by passing the `indexSettlementPeriods` obtained via `getPoolParameters`.

The function executes the following steps in the following order:
* Load the pool parameters from the DIVA smart contract.
* Get the queryId for the specified `poolId` to look up the reported value inside the Tellor contract.
* Retrieve the submitted values, which include the final reference value and the USD value of the collateral token. Latter is used to calculate the equivalent of the USD 10 reward cap in collateral token.
* Confirm that the value pair has been submitted after pool expiration and remained undisputed for at least 12 hours. Note that disputed values will be removed from the key-value store and not returned during the `getDataAfter` call.
* Decode the submitted values.
* Retrieve the reporter address and store it as the eligible address to claim the reward inside the `_poolIdToReporter` mapping.
* Add an entry to `_reporterToPoolIds` array to allow reporters to retrieve the pools that they are eligible for via [`getPoolIdsForReporters`](#getpoolidsforreporters).
* Pass on the final reference value to the DIVA smart contract to determine the payouts. Note that DIVA's challenge feature is disabled and the first value successfully submitted will be confirmed, allowing position token holders to start claiming their payouts.
* Calculate the USD equivalent of the collateral token, and then credit the eligible reporter with their respective amount, up to a maximum of USD 10. Any excess reward beyond USD 10 will be credited to the excess fee recipient. Please note that DIVA rewards are not claimed in this step, but rather re-allocated from the contract to the eligible reporter, as the contract acts as the data provider in the pool. DIVA rewards are claimed in the same function call if the `_claimDIVAReward` parameter is set to `true` or laster using the [`claimReward`](#claimreward) function. 
* Emit a [`FinalReferenceValueSet`](#finalreferencevalueset) event on success.
* If `_tippingTokens` are provided and/or the `_claimDIVAReward` parameter is set to `true`, proceed with the same steps as outlined in [`claimReward`](#claimreward).

The function reverts under the following conditions:
* No value has been reported after pool expiration. In this case `getDataAfter` returns `timestampRetrieved = 0`. Reverts with a `NoOracleSubmissionAfterExpiryTime` error.
* A value has been submitted but the minimum dispute period of 12 hours hasn't passed yet. Reverts with a `MinPeriodUndisputedNotPassed` error.
* Triggered outside of the submission window for the pool.

```js
function setFinalReferenceValue(
    uint256 _poolId,                    // The Id of the pool
    address[] calldata _tippingTokens,  // Array of tipping tokens to claim
    bool _claimDIVAReward               // Flag indicating whether to claim the DIVA reward
)
    external;
```

## batchSetFinalReferenceValue

Batch version of [`setFinalReferenceValue`](#setfinalreferencevalue).

```js
function batchSetFinalReferenceValue(
    ArgsBatchSetFinalReferenceValue[] calldata _argsBatchSetFinalReferenceValue
)
    external;
```

where `ArgsBatchSetFinalReferenceValue` is given by

```
struct ArgsBatchSetFinalReferenceValue {
    uint256 poolId;             // The Id of the pool
    address[] tippingTokens;    // Array of tipping tokens to claim
    bool claimDIVAReward;       // Flag indicating whether to claim the DIVA reward
}
```

# Governance functions

The execution of the following functions is reserved to the contract owner only.

## updateExcessFeeRecipient

Function to update the excess fee recipient address. Activation is restricted to the contract owner and subject to a 3-day delay. On success, emits a [`ExcessFeeRecipientUpdated`](#excessfeerecipientupdated) event including the new excess fee recipient address as well as its activation time. A pending update can be revoked by the contract owner using the [`revokePendingExcessFeeRecipientUpdate`](#revokependingexcessfeerecipientupdate). The previous excess fee recipient address as well as the current one can be obtained via the [`getExcessFeeRecipientInfo`](#getexcessfeerecipientinfo) function.

Reverts if:
* `msg.sender` is not contract owner.
* provided address equals zero address.
* there is already a pending excess fee recipient address update.

```js
function updateExcessFeeRecipient(
    address _newExcessFeeRecipient  // New excess fee recipient address
)
    external;
```

## updateMaxFeeAmountUSD

Function to update the maximum amount of DIVA reward that a reporter can receive, denominated in USD. Activation is restricted to the contract owner and subject to a 3-day delay. On success, emits a [`MaxFeeAmountUSDUpdated`](#maxfeeamountusdupdated) event including the new excess fee recipient address as well as its activation time. A pending update can be revoked by the contract owner using the [`revokePendingMaxFeeAmountUSDUpdate`](#revokependingmaxfeeamountusdupdate). The previous amount as well as the current one can be obtained via the [`getMaxFeeAmountUSDInfo`](#getmaxfeeamountusdinfo) function.

Reverts if:
* `msg.sender` is not contract owner.
* there is already a pending amount update.

```js
function updateMaxFeeAmountUSD(
    uint256 _newMaxFeeAmountUSD  // New amount expressed as an integer with 18 decimals
)
    external;
```

## revokePendingExcessFeeRecipientUpdate

Function to revoke a pending excess fee recipient update and restore the previous one. On success, emits a [`PendingExcessFeeRecipientUpdateRevoked`](#pendingexcessfeerecipientupdaterevoked) event including the revoked and restored excess fee recipient address. 

Reverts if:
* `msg.sender` is not contract owner.
* New excess fee recipient is already active (i.e. `block.timestamp >= startTime`).

```js
function revokePendingExcessFeeRecipientUpdate() external;
```

## revokePendingMaxFeeAmountUSDUpdate

Function to revoke a pending max USD fee amount update and restore the previous one. On success, emits a [`PendingMaxFeeAmountUSDUpdateRevoked`](#pendingmaxfeeamountusdupdaterevoked) event including the revoked and restored amount. 

Reverts if:
* `msg.sender` is not contract owner.
* New amount is already active (i.e. `block.timestamp >= startTime`).

```js
function revokePendingMaxFeeAmountUSDUpdate() external;
```

# Getter functions

DIVAOracleTellor implements the following getter functions.

## getChallengeable

Function to return whether the oracle's data feed is challengeable or not. Will return `false` in that implementation.

```js
function getChallengeable()
    external
    view
    returns (bool);
```

## getExcessFeeRecipientInfo

Function to return the excess fee recipient info. The initial excess fee recipient is set when the contract is deployed. The previous excess fee recipient is set to the zero address initially.

```js
 function getExcessFeeRecipientInfo()
    external
    view
    returns (
        address previousExcessFeeRecipient, // Previous excess fee recipient address.
        address excessFeeRecipient,         // Latest update of the excess fee recipient address.
        uint256 startTimeExcessFeeRecipient // Timestamp in seconds since epoch at which `excessFeeRecipient` is activated.
    );
```

## getMinPeriodUndisputed

Function to return the minimum period (in seconds) a reported value has to remain undisputed in order to be considered valid (12 hours = 43'200 seconds).

```js
function getMinPeriodUndisputed()
    external
    view
    returns (uint32);
```

## getMaxFeeAmountUSDInfo

Function to return the max USD fee amount info. The initial value is set when the contract is deployed. The previous value is set to zero initially.

```js
function getMaxFeeAmountUSDInfo()
    external
    view
    returns (
        uint256 previousMaxFeeAmountUSD,    // Previous value
        uint256 maxFeeAmountUSD,            // Latest update of the value
        uint256 startTimeMaxFeeAmountUSD    // Timestamp in seconds since epoch at which `maxFeeAmountUSD` is activated
    );
```

## getDIVAAddress

Function to return the DIVA contract address that the oracle is linked to. The address is set in the constructor at contract deployment.

```js
function getDIVAAddress()
    external
    view
    returns (address);
```

## getTipAmounts

Function to return the array of tipping amounts for the given struct array of poolIds and tipping tokens.

```js
function getTipAmounts(
    ArgsBatchInput[] calldata _argsBatchInputs // Struct array containing poolIds and tipping tokens
)
    external
    view
    returns (uint256[][] memory);
```

where `ArgsBatchInput` struct is defined as

```js
struct ArgsBatchInput {
    uint256 poolId;
    address[] tippingTokens;
}
```

## getReporters

Function to return the list of reporter addresses that are entitled to receive rewards for the provided poolIds. If a value has been reported to the Tellor contract but hasn't been pulled into the DIVA contract via the [`setFinalReferenceValue`](#setfinalreferencevalue) function yet, the function returns the zero address.

```js
function getReporters(
    uint256[] calldata _poolIds // Array of poolIds
)
    external
    view
    returns (address[] memory);
```

## getTippingTokens

Function to return an array of tipping tokens for the given struct array of poolIds, along with start and end indices to manage the return size of the array. It can be helpful when calling [`claimReward`](#claimreward) or [`setFinalReferenceValue`](#setfinalreferencevalue).

```js
function getTippingTokens(
    ArgsGetTippingTokens[] calldata _argsGetTippingTokens
)
    external
    view
    returns (address[][] memory);
```

where `ArgsGetTippingTokens` struct is defined as

```js
struct ArgsGetTippingTokens {
    uint256 poolId;         // The Id of the pool
    uint256 startIndex;     // Start index within the `_poolIdToTippingTokens` mapping array
    uint256 endIndex;       // End index within the `_poolIdToTippingTokens` mapping array
}
```

## getTippingTokensLengthForPoolIds

Function to return the number of tipping tokens for the given poolIds. It can be helpful when calling [`getTippingTokens`](#gettippingtokens).

```js
function getTippingTokensLengthForPoolIds(
    uint256[] calldata _poolIds // Array of poolIds
)
    external
    view
    returns (uint256[] memory);
```

## getPoolIdsForReporters

Function to return an array of poolIds that a reporter is eligible to claim rewards for. It takes a struct array of reporter addresses, as well as the start and end indices to manage the return size of the array. it can be helpful when calling [`claimReward`](#claimreward) or its batch version.

```js
function getPoolIdsForReporters(
    ArgsGetPoolIdsForReporters[] calldata _argsGetPoolIdsForReporters
)
    external
    view
    returns (uint256[][] memory);
```

where `ArgsGetPoolIdsForReporters` struct is defined as

```js
struct ArgsGetPoolIdsForReporters {
    address reporter;   // Reporter address
    uint256 startIndex; // Start index within the `_reporterToPoolIds` mapping array
    uint256 endIndex;   // End index within the `_reporterToPoolIds` mapping array
}
```

## getPoolIdsLengthForReporters

Function to return the number of poolIds a given list of reporter addresses are eligible to claim rewards for. It can be helpful when calling [`getPoolIdsForReporters`](#getpoolidsforreporters).

```js
function getPoolIdsLengthForReporters(
    address[] calldata _reporters // Array of reporter address
)
    external
    view
    returns (uint256[] memory);
```

## getOwnershipContract

Function to return the DIVA ownership contract address that stores the contract owner.

```js
function getOwnershipContract()
    external
    view
    returns (address);
```

## getActivationDelay

Function to return the activation delay in seconds (3 days = 259'200 seconds).

```js
function getActivationDelay()
    external
    pure
    returns (uint256);
```

## getQueryDataAndId

Function to return the query data and Id for a given poolId. This is used as as inputs for submitting values to the Tellor contract. Read more about it in the [Tellor docs][tellor-docs].

```js
function getQueryDataAndId(
    uint256 _poolId // The Id of the pool
)
    external
    view
    returns (bytes memory, bytes32);
```

## Reentrancy protection

All state-modifying functions, including their batch versions, implement [openzeppelin's `nonReentrant` modifier][openzeppelin-reentrancy-guard] to protect against reentrancy attacks, with the exception of governance related functions.

# Events

## TipAdded

Emitted when a tip is added via the [`addTip`](#addtip) function.

```
event TipAdded(
    uint256 poolId,         // The Id of the tipped pool
    address tippingToken,   // Tipping token address
    uint256 amount,         // Tipping token amount expressed as an integer with tipping token decimals
    address tipper          // Tipper address
);
```

## TipClaimed

Emitted when the reward is claimed via the [`claimReward`](#claimreward) function.

```
event TipClaimed(
    uint256 poolId,         // The Id of the pool
    address recipient,      // Address of the tip recipient
    address tippingToken,   // Tipping token address
    uint256 amount          // Claimed amount expressed as an integer with tipping token decimals
);
```

## FinalReferenceValueSet

Emitted when the final reference value is set via the [`setFinalReferenceValue`](#setfinalreferencevalue) function.

```
event FinalReferenceValueSet(
    uint256 indexed poolId, // The Id of the pool
    uint256 finalValue,     // Tellor value expressed as an integer with 18 decimals
    uint256 expiryTime,     // Pool expiry time as a unix timestamp in seconds
    uint256 timestamp       // Tellor value timestamp
);
```

## ExcessFeeRecipientUpdated

Emitted when the excess fee recipient is updated via the [`updateExcessFeeRecipient`](#updateexcessfeerecipient) function.

```
event ExcessFeeRecipientUpdated(
    address indexed from,                   // Address that initiated the change (contract owner)
    address indexed excessFeeRecipient,     // New excess fee recipient address
    uint256 startTimeExcessFeeRecipient     // Timestamp in seconds since epoch at which the new excess fee recipient will be activated
);
```

## MaxFeeAmountUSDUpdated

Emitted when the max USD fee amount is updated via the [`updateMaxFeeAmountUSD`](#updatemaxfeeamountusd) function.

```
event MaxFeeAmountUSDUpdated(
    address indexed from,               // Address that initiated the change (contract owner)
    uint256 maxFeeAmountUSD,            // New max USD fee amount expressed as an integer with 18 decimals
    uint256 startTimeMaxFeeAmountUSD    // Timestamp in seconds since epoch at which the new max USD fee amount will be activated
);
```

## PendingExcessFeeRecipientUpdateRevoked

Emitted when a pending excess fee recipient update is revoked via the [`revokePendingExcessFeeRecipientUpdate`](#revokependingexcessfeerecipientupdate) function.

```
event PendingExcessFeeRecipientUpdateRevoked(
    address indexed revokedBy,                  // Address that initiated the revocation
    address indexed revokedExcessFeeRecipient,  // Pending excess fee recipient that was revoked
    address indexed restoredExcessFeeRecipient  // Previous excess fee recipient that was restored
);
```

## PendingMaxFeeAmountUSDUpdateRevoked

Emitted when a pending max USD fee amount update is revoked via the [`revokePendingMaxFeeAmountUSDUpdate`](#revokependingmaxfeeamountusdupdate) function.

```
event PendingMaxFeeAmountUSDUpdateRevoked(
    address indexed revokedBy,          // Address that initiated the revocation
    uint256 revokedMaxFeeAmountUSD,     // Pending max USD fee amount that was revoked
    uint256 restoredMaxFeeAmountUSD     // Previous max USD fee amount that was restored
);
```

# Errors

The following errors may be emitted during execution of the functions, including their batch versions.

| Error name                            | Function                                                                                                                                                 | Description                                                                                                                                     |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NotConfirmedPool()`                  | `claimReward` / `setFinalReferenceValue`| Thrown if rewards are claimed before a pool was confirmed.                                                                   |
| `AlreadyConfirmedPool()`              | `addTip`                                                                                                                                                 | Thrown if user tries to add a tip for an already confirmed pool                                                                                 |
| `ZeroExcessFeeRecipient()`            | `updateExcessFeeRecipient` / constructor                                                                                                                                  | Thrown if the zero address is passed as excess fee recipient address.                                                                      |
| `NoOracleSubmissionAfterExpiryTime()` | `setFinalReferenceValue` | Thrown if there is no data reported after the expiry time for the underlying pool. |
| `MinPeriodUndisputedNotPassed()`      | `setFinalReferenceValue` | Thrown if user tries to call `setFinalReferenceValue` before the minimum period undisputed period has passed.               |
| `ZeroOwnershipContractAddress()`      | constructor | Thrown in constructor if zero address is provided as ownershipContract.               |
| `NotContractOwner(address _user, address _contractOwner)`      | `updateExcessFeeRecipient` / `updateMaxFeeAmountUSD` / `revokePendingExcessFeeRecipientUpdate` / `revokePendingMaxFeeAmountUSDUpdate` | Thrown in constructor if zero address is provided as ownershipContract.               |
| `PendingExcessFeeRecipientUpdate(uint256 _timestampBlock, uint256 _startTimeExcessFeeRecipient)`      | `updateExcessFeeRecipient` | Thrown if there is already a pending excess fee recipient address update.               |
| `PendingMaxFeeAmountUSDUpdate(uint256 _timestampBlock, uint256 _startTimeMaxFeeAmountUSD)`      | `updateMaxFeeAmountUSD` | Thrown if there is already a pending max USD fee amount update.               |
| `ExcessFeeRecipientAlreadyActive(uint256 _timestampBlock, uint256 _startTimeExcessFeeRecipient)`      | `revokePendingExcessFeeRecipientUpdate` | Thrown if the excess fee recipient update to be revoked is already active.               |
| `MaxFeeAmountUSDAlreadyActive(uint256 _timestampBlock, uint256 _startTimeMaxFeeAmountUSD)`      | `revokePendingMaxFeeAmountUSDUpdate` | Thrown if the max USD fee amount update to be revoked is already active.               |


# Links
* [Tellor protocol website][tellor-protocol]
* [Tellor documentation regarding DIVA Protocol query type][tellor-docs]
* [DIVA Protocol documentation][diva-protocol-docs]

[openzeppelin-reentrancy-guard]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/security/ReentrancyGuard.sol
[diva-protocol-docs]: https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md
[tellor-docs]: https://github.com/tellor-io/dataSpecs/blob/main/types/DIVAProtocol.md
[tellor-protocol]: https://tellor.io/