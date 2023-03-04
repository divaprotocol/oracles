# TODO

- Create video guide for manual reporting

# Tellor adapter for DIVA Protocol v1 - Documentation

This documentation outlines the functionality of the Tellor adapter for [DIVA Protocol v1](https://github.com/divaprotocol/diva-contracts).

## Table of contents

1.  [System overview](#system-overview)
2.  [Function overview](#function-overview)
3.  [Core functions](#core-functions)
4.  [Getter functions](#getter-functions)
5.  [Setter functions](#setter-functions)
6.  [Events](#events)
7.  [Errors](#errors)

# System overview

Derivative contracts created on DIVA Protocol require one data input following expiration. The Tellor adapter offers DIVA Protocol users a decentralized oracle solution for outcome reporting.

The key benefits of using the Tellor adapter for outcome reporting include:
- No single point of failure as outcome reporting is decentralized and permissionless.
- No interruption in the reporting process following disputes, eliminating the need for additional requests.
- Option to add tips for additional reporting incentives.

These advantages provide users with a high level of confidence in correct settlement. The following sections provide and overview of the Tellor protocol, how the adapter works, and how it can be used.

Please refer to the ["Risks and Mitigants"](#risks-and-mitigants) section for a comprehensive understanding of potential risks involved in using the Tellor adapter.

>**Terminology:** As funds backing the derivative contracts are held in so-called "contingent pools", the terms "derivative" and "contingent pool" (or simply "pool") are used interchangeably.

## What is Tellor protocol

Tellor is a decentralized oracle protocol that allows smart contracts on EVM chains to securely and reliably access data from off-chain sources, including data from other chains. It uses a decentralized network of stakers to provide this data, and incentivizes them with the Tellor token (TRB) to maintain the integrity of the network.

## How Tellor protocol works

To participate in the Tellor protocol as a reporter, users must stake TRB tokens. The amount of TRB required for one stake is equal to the minimum of $1'500 or 100 TRB. This allows a reporter to submit one value every 12 hours. If a user wishes to submit more values during the same period, they must stake additional TRB tokens in proportion to the number of values they wish to submit. For example, if a user wants to submit two values every 12 hours, they must stake twice the amount of TRB required for one stake.

Assuming that the value of TRB is at least $15 (corresponding to 100 TRB required for one stake), the reporting process is as follows:
* Reporters submit values to a specific key, also known as queryId. Only one value can be reported per queryId and block.
* If a reported value is deemed incorrect, it can be disputed for a maximum of 12 hours from the time of reporting. Disputers pay a dispute fee starting at 10 TRB, which doubles up to a maximum of 100 TRB with each round of dispute for a given queryId.
* If a value gets disputed, it is removed from the key-value mapping and enters Tellor's [dispute resolution process](#disputes), which takes at least 2 days. The reporting process continues uninterrupted, allowing other reporters to submit valid values.

To ensure the reliability of reported data, only data reports that have remained undisputed for a specified duration (up to 12 hours) should be considered valid. The Tellor adapter selects a maximum duration of 12 hours and utilizes the earliest value that satisfies this criterion as the settlement value, ignoring any subsequent values that also meet the condition.

### Disputes

Any party can challenge data submissions of any reporters when a value is placed on-chain. A challenger must submit a dispute fee to each challenge. Once a challenge is submitted, the potentially malicious reporter who submitted the value is placed in a locked state for the duration of the vote. For the next two days, TRB holders vote on the validity of the reported value. All TRB holders have an incentive to maintain an honest oracle and can vote on the dispute. For more information, refer to the official [Tellor docs](https://docs.tellor.io/tellor/disputing-data/introduction).

## How the Tellor adapter works

The end-to-end usage of the Tellor adapter is outlined below:
1. **Pool creation:** A user creates a contingent pool on DIVA Protocol, assigning the Tellor adapter contract address as the data provider. This step constitutes a request to report the outcome of the underlying event/metric at the specified expiry time after expiration.
2. **Monitoring:** Tellor reporters monitor expired pools requiring reporting by running special software, known as "Tellor clients". There are two available implementations, one by the [DIVA team](https://github.com/divaprotocol/diva-monorepo/tree/main/packages/diva-oracle) which is focused on reporting for DIVA pools and one by the [Tellor team](https://github.com/tellor-io/telliot-feeds) which is generic reporter not necessarily focused on DIVA. If you're planning to build your own reporter software, please refer to the [README](https://github.com/divaprotocol/oracles/blob/main/README.md) for guidance.
3. **Reporting to Tellor Protocol:** If a pool expires, reporters submit their values to the Tellor smart contract. Valid submissions must be made during the 7-day submission period (subject to change with a minimum of 3 days), starting at the time of pool expiration.
4. **Reporting to DIVA Protocol:** The first value submitted to the Tellor Protocol that remains undisputed for over 12h will be considered the final one. This value is submitted to DIVA Protocol by calling the [`setFinalReferenceValue`](#setfinalreferencevalue) function on the Tellor adapter contract. This sets the final reference value status inside the DIVA smart contract to "Confirmed" and determines the payouts for each counterparty involved in the derivative contract. No further submissions to DIVA Protocol are permitted thereafter. Disputed values will be disregarded and are handled in a separate process on the Tellor side.

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
- The maximum reward paid per pool for a reporter is capped at $10, with the remaining reward going to the DIVA owner. This measure was implemented to prevent "dispute wars" where disputing valid submissions becomes a profitable strategy to receive an outsized reward. 
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

## Relevant addresses

| Name                       |                                                                             |                                                                                                                                                                                                                    |
| :------------------------- | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ethereum**                                                               |
| **Polygon**                                                               |
| **Gnosis**                                                               |
| **Arbitrum**                                                               |
| **Goerli**                                                               |
| Tellor adapter contract    | `0x9959f7f8eFa6B77069e817c1Af97094A9CC830FD`                                | Contract that connects the Tellor system with DIVA Protocol. To be used as the data provider address when creating a pool                                                                                          |
| TRB token                  | `0x51c59c6cAd28ce3693977F2feB4CfAebec30d8a2`                                | Token that needs to be staked in order to be able to report values to the Tellor system. One stake corresponds to 100 TRB allows and allows to report one value every 12 hours.                                    |
| Tellor system              | `0xB3B662644F8d3138df63D2F43068ea621e2981f9`                                | Tellor contract where values are reported to and TRB staked.                                                                                                                                                       |
| Tellor governance contract | `0x02803dcFD7Cb32E97320CFe7449BFb45b6C931b8`                                | Implements the `beginDispute` function to initiate a dispute.                                                                                                                                                      |
| DIVA smart contract        | `0x659f8bF63Dce2548eB4D9b4BfF6883dddFde4848`                                | The DIVA smart contract address that the Tellor adapter contract points to. Selecting the Tellor adapter contract as the oracle for any other version of the DIVA smart contract will result in failure to report. |
| DIVA subgraph              | https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new-2 | Subgraph containing all pool related information.                                                                                                                                                                  |

Note that depositing a stake or or disputing a value requires prior approval for the TRB token for the corresponding contract to transfer the token.

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
1. **Generate queryId:**
   - Go to https://querybuilder.tellor.io/custom
   - Choose Custom option
   - Put `DIVAProtocol` as type
   - Choose `uint256` as arg type and put the pool Id there
   - Choose `address` as arg type and put the DIVA contract adddress there (`0x659f8bF63Dce2548eB4D9b4BfF6883dddFde4848`)
   - Choose `uint256` as arg type and put the chainId there (`5` for Goerli, `1` for Ethereum mainnet, etc.)
   - Click Generate ID
   - Query Data and Query Id will be necessary for the next step
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
| [`getQueryId`](#getqueryid)                                                                     | Function to return the query id for a given poolId.                                                                               |
| **Batch functions**                                                                             |
| [`batchClaimReward`](#batchclaimreward)                                                       | Batch version of `claimReward`.                                                                                                     |

# Core functions

DIVAOracleTellor implements the following core functions.

## addTip

Function to tip a pool. Tips can be added in any ERC20 token until the final value has been submitted and confirmed in DIVA Protocol by successfully calling the [`setFinalReferenceValue`](#setfinalreferencevalue) function. Tips can be claimed via the [`claimReward`](#claimreward) function after final value confirmation.

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
    uint256 _poolId,        // The id of the pool
    uint256 _amount,        // The amount to tip expressed as an integer with tipping token decimals
    address _tippingToken   // Tipping token address
)
    external;
```

>**Note:** DIVA Protocol also has an `addTip` function, but it only allows tipping with the collateral token of the pool. When a tip is added through this function, it is credited to the data provider along with the settlement fees (combined referred to as DIVA reward) once the final value is confirmed.

## claimReward

Function to claim tips and/or DIVA rewards. Users can specify which tips to claim from the Tellor adapter contract using the `_tippingTokens` array, and can indicate whether they want to claim the DIVA reward by setting the `_claimDIVAReward` parameter to `true`. Users can obtain the tipping tokens associated with a pool by calling the [`getTippingTokens`](#gettippingtokens) function.

It's important to note that rewards can only be claimed after the final value has been submitted and confirmed in the DIVA Protocol by successfully calling the [`setFinalReferenceValue`](#setfinalreferencevalue) function. This function can be triggered by anyone to transfer the rewards to the eligible reporter.

The function executes the following steps in the following order:
* Check whether the caller has provided any tipping tokens in the `_tippingTokens` array. If tipping tokens are provided, the function will proceed with the following steps. If not, the function will skip these steps.
   * Retrieve the tip amount for the pool in the specified tipping token.
   * Set the tip amount to zero to prevent multiple payouts in case the same tipping token is provided multiple times.
   * Transfer the tip from the Tellor adapter contract to the eligible reporter stored in the `_poolIdToReporter` mapping (set during successful execution of the [`setFinalReferenceValue`](#setfinalreferencevalue) function).
   * Emit a [`TipClaimed`](#tipclaimed) event for each tipping token claimed.
* If the `_claimDIVAReward` parameter is set to `true`, the function will trigger the claim of the DIVA reward from the DIVA smart contract:
   * Retrieve the collateral token of the pool from the pool parameters stored within the DIVA Protocol.
   * Transfer the reward to the eligible reporter via the `claimFee` function.
   * Emit a `FeeClaimed` event on successful completion of the `claimFee` function.

>**Note: ** If no tipping tokens are provided and `_claimDIVAReward` is set to `false`, the function will not execute anything, but will not revert. 

```js
function claimReward(
    uint256 _poolId,                    // The id of the pool
    address[] memory _tippingTokens,    // Array of tipping tokens to claim
    bool _claimDIVAReward               // Flag indicating whether to claim the DIVA reward
)
    external;
```

## batchClaimTips

Batch version of `claimTips`.

```js
function batchClaimTips(
    ArgsBatchInput[] calldata _argsBatchInputs // Struct array containing poolIds and tipping tokens
)
    external;
```

## setFinalReferenceValue

Function to set the final reference value for a given `_poolId`.

```js
function setFinalReferenceValue(
    uint256 _poolId // The id of the pool
)
    external;
```

## setFinalReferenceValueAndClaimTips

Function to set the final reference value and claim tips for a given `_poolId` with given tipping tokens.

```js
function setFinalReferenceValueAndClaimTips(
    uint256 _poolId,                // The id of the pool
    address[] memory _tippingTokens // Array of tipping tokens to claim tip
)
    external;
```

## setFinalReferenceValueAndClaimDIVAReward

Function to set the final reference value and claim DIVA reward for a given `_poolId` with given tipping tokens.

```js
function setFinalReferenceValueAndClaimDIVAReward(
    uint256 _poolId // The id of the pool
)
    external;
```

## setFinalReferenceValueAndClaimTipsAndDIVAReward

Function to set the final reference value and claim tips and DIVA reward for a given `_poolId` with given tipping tokens.

```js
function setFinalReferenceValueAndClaimTipsAndDIVAReward(
    uint256 _poolId,                // The id of the pool
    address[] memory _tippingTokens // Array of tipping tokens to claim tip
)
    external;
```

# Getter functions

DIVAOracleTellor implements the following getter functions.

## getChallengeable

Function to return whether the oracle's data feed is challengeable or not.

Will return `false` in that implementation.

```js
function getChallengeable()
    external
    view
    returns (bool);
```

## getExcessFeeRecipient

Function to return the excess fee recipient address.

```js
function getExcessFeeRecipient()
    external
    view
    returns (address);
```

## getMinPeriodUndisputed

Function to return the minimum period (in seconds) a reported value has to remain undisputed in order to be considered valid.

```js
function getMinPeriodUndisputed()
    external
    view
    returns (uint32);
```

## getMaxFeeAmountUSD

Function to return the max fee amount usd value with 18 decimals.

```js
function getMaxFeeAmountUSD()
    external
    view
    returns (uint256);
```

## getDIVAAddress

Function to return the DIVA address that the oracle is linked to.

```js
function getDIVAAddress()
    external
    view
    returns (address);
```

## getTipAmounts

Function to return the array of tipping amounts for the given array of `ArgsBatchInput` struct.

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

Function to return the array of reporter addresses for the given `_poolIds`.

```js
function getReporters(
    uint256[] calldata _poolIds // Array of poolIds
)
    external
    view
    returns (address[] memory);
```

> **Note:** it returns the zero address if a value has been reported to the Tellor contract but it hasn't been pulled into DIVA Protocol by calling [`setFinalReferenceValue`](#setFinalReferenceValue) (or a variant of it) yet.

## getTippingTokens

Function to return the array of tipping tokens for the given array of `ArgsGetTippingTokens` struct.

```js
function getTippingTokens(
    ArgsGetTippingTokens[] calldata _argsGetTippingTokens // Struct array containing poolId, start index and end index
)
    external
    view
    returns (address[][] memory);
```

where `ArgsGetTippingTokens` struct is defined as

```js
struct ArgsGetTippingTokens {
    uint256 poolId;
    uint256 startIndex;
    uint256 endIndex;
}
```

## getTippingTokensLengthForPoolIds

Function to return the lengths of tipping tokens for the given `_poolIds`.

```js
function getTippingTokensLengthForPoolIds(
    uint256[] calldata _poolIds // Array of poolIds
)
    external
    view
    returns (uint256[] memory);
```

## getPoolIdsForReporters

Function to return the array of poolIds reported by reporters for the given array of `ArgsGetPoolIdsForReporters` struct.

```js
function getPoolIdsForReporters(
    ArgsGetPoolIdsForReporters[] calldata _argsGetPoolIdsForReporters // Struct array containing reporter address, start index and end index
)
    external
    view
    returns (uint256[][] memory);
```

where `ArgsGetPoolIdsForReporters` struct is defined as

```js
struct ArgsGetPoolIdsForReporters {
    address reporter;
    uint256 startIndex;
    uint256 endIndex;
}
```

## getPoolIdsLengthForReporters

Function to return the lengths of poolIds reported by reporters for the given `_reporters`.

```js
function getPoolIdsLengthForReporters(
    address[] calldata _reporters // Array of reporter address
)
    external
    view
    returns (uint256[] memory);
```

## getQueryId

Function to return the query id for a given `_poolId`.

```js
function getQueryId(
    uint256 _poolId // The id of the pool
)
    external
    view
    returns (bytes32);
```

# Setter functions

The DIVAOracleTellor contract implements the below mentioned setter functions. The execution of all setter functions is reserved to the contract owner only.

## setExcessFeeRecipient

Function to update `_excessFeeRecipient`. On success, emits one [`ExcessFeeRecipientSet`](#ExcessFeeRecipientSet) event including the excess fee recipient address.

Reverts if:

- `msg.sender` is not contract owner.
- `_newExcessFeeRecipient` is zero address.

```js
function setExcessFeeRecipient(
    address _newExcessFeeRecipient // New `_excessFeeRecipient`
)
    external;
```

To keep an excess fee recipient parameter unchanged, simply pass the current value as function parameter.

## setMinPeriodUndisputed

Function to update `_minPeriodUndisputed` with minimum value of 1 hour (3600 seconds) and maximum value of 18 hours (64800 seconds). On success, emits one [`MinPeriodUndisputedSet`](#MinPeriodUndisputedSet) event including the undisputed minimum period value.

Reverts if:

- `msg.sender` is not contract owner.
- `_newMinPeriodUndisputed` is smaller than 3600.
- `_newMinPeriodUndisputed` is bigger than 64800.

```js
function setMinPeriodUndisputed(
    uint32 _newMinPeriodUndisputed // New `_minPeriodUndisputed` in seconds
)
    external;
```

To keep a undisputed minimum period parameter unchanged, simply pass the current value as function parameter.

## setMaxFeeAmountUSD

Function to update `_maxFeeAmountUSD`. On success, emits one [`MaxFeeAmountUSDSet`](#MaxFeeAmountUSDSet) event including the max fee amount usd value.

Reverts if:

- `msg.sender` is not contract owner.

```js
function setMaxFeeAmountUSD(
    uint256 _newMaxFeeAmountUSD // New amount expressed as an integer with 18 decimals
)
    external;
```

To keep a max fee amount usd parameter unchanged, simply pass the current value as function parameter.

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

Emitted when the tip is claimed.

```
event TipClaimed(
    uint256 poolId,         // The Id of an existing derivatives pool
    address recipient,      // Address of the tip recipient
    address tippingToken,   // Address of tipping token
    uint256 amount          // Claimed tipping token amount
);
```

## FinalReferenceValueSet

Emitted when the final reference value is set.

```
event FinalReferenceValueSet(
    uint256 indexed poolId, // The Id of an existing derivatives pool
    uint256 finalValue,     // Tellor value (converted into 18 decimals)
    uint256 expiryTime,     // Unix timestamp in seconds of pool expiry date
    uint256 timestamp       // Tellor value timestamp
);
```

## ExcessFeeRecipientSet

Emitted when the excess fee recipient is set.

```
event ExcessFeeRecipientSet(
    address indexed from,               // Address that initiated the change (contract owner)
    address indexed excessFeeRecipient  // New excess fee recipient address
);
```

## MinPeriodUndisputedSet

Emitted when the `_minPeriodUndisputed` is set.

```
event MinPeriodUndisputedSet(
    address indexed from,       // Address that initiated the change (contract owner)
    uint32 minPeriodUndisputed  // New `_minPeriodUndisputed`
);
```

## MaxFeeAmountUSDSet

Emitted when the max fee amount usd value is set.

```
event MaxFeeAmountUSDSet(
    address indexed from,   // Address that initiated the change (contract owner)
    uint256 maxFeeAmountUSD // New max fee amount usd value
);
```

# Errors

The following errors may be emitted during execution:

| Error name                            | Function                                                                                                                                                 | Description                                                                                                                                     |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NotConfirmedPool()`                  | `claimTips` / `batchClaimTips` / `claimDIVAReward` / `batchClaimDIVAReward` / `claimTipsAndDIVAReward` / `batchClaimTipsAndDIVAReward`                               | Thrown if user tries to claim fees/tips for a pool that was not yet confirmed                                                                   |
| `AlreadyConfirmedPool()`              | `addTip`                                                                                                                                                 | Thrown if user tries to add a tip for an already confirmed pool                                                                                 |
| `ZeroExcessFeeRecipient()`            | `setExcessFeeRecipient`                                                                                                                                  | Thrown if the zero address is passed as input into `setExcessFeeRecipient`                                                                      |
| `OutOfRange()`                        | `setMinPeriodUndisputed`                                                                                                                                 | Thrown if `_minPeriodUndisputed` passed into `setMinPeriodUndisputed` is not within the expected range (min 1h, max 18h)                        |
| `NoOracleSubmissionAfterExpiryTime()` | `setFinalReferenceValue` / `setFinalReferenceValueAndClaimTips`/ `setFinalReferenceValueAndClaimDIVAReward`/ `setFinalReferenceValueAndClaimTipsAndDIVAReward` | Thrown when user calls `setFinalReferenceValue` (or a variant of it) but there is no data reported after the expiry time of the underlying pool |
| `MinPeriodUndisputedNotPassed()`      | `setFinalReferenceValue` / `setFinalReferenceValueAndClaimTips`/ `setFinalReferenceValueAndClaimDIVAReward`/ `setFinalReferenceValueAndClaimTipsAndDIVAReward` | Thrown if user tries to call `setFinalReferenceValue` (or a variant of it) before the minimum period undisputed period has passed               |





[openzeppelin-reentrancy-guard]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/security/ReentrancyGuard.sol