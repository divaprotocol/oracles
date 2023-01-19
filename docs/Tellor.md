# TODO

- Create video guide for manual reporting

# Tellor adapter for DIVA Protocol v1 - Documentation

This documentation outlines the functionality of the Tellor adapter for DIVA Protocol v1.

## Table of contents

1.  [System overview](#system-overview)
2.  [Function overview](#function-overview)
3.  [Getter functions](#getter-functions)
4.  [Setter functions](#setter-functions)

# System overview

Derivative contracts (also referred to as "contingent pools" or simply "pools") created on DIVA Protocol require one data input following expiration. The Tellor adapter offers users of DIVA Protocol a decentralized oracle solution for outcome reporting.

The key benefits of using the Tellor integration are highlighted below:

- No single point of failure as anyone can report the outcome in a permissionless way
- Disputes do not interrupt the reporting process meaning that reporters can continue to report values without the need for an additional request
- The Tellor adapter offers the possibility to add tips to create additional incentivizes for reporting

Those advantages give users a high confidence that pools will settle correctly. Refer to the [risks](#risks-and-mitigants) section to understand the risks involved.

## How it works

1. **Pool creation:** A user creates a contingent pool on DIVA Protocol and sets the Tellor adapter contract address as the data provider. The creation of a pool constitutes a request to the assigned data provider to report the outcome of the underlying event/metric at a future point in time.
2. **Monitoring:** Tellor reporters are monitoring expired pools that require reporting by running special software (so-called "DIVA Tellor clients"). There are two implementations available, one developed by the [DIVA team](https://github.com/divaprotocol/diva-monorepo/tree/main/packages/diva-oracle) and one by the [Tellor team](https://github.com/tellor-io/telliot-feeds). If you plan to build your own reporter software, check out the [README](https://github.com/divaprotocol/oracles/blob/main/README.md) for guidance.
3. **Reporting to Tellor Protocol:** If a pool expired, reporters submit their values to the Tellor smart contract. Only values that are submitted during the submission period, which starts at the time of pool expiration and lasts for 7 days (subject to change), are considered valid submissions.
4. **Reporting to DIVA Protocol:** The first value submitted to the Tellor Protocol that remains undisputed for more than 12h will be considered the final one and is submitted to DIVA Protocol by calling the `setFinalReferenceValue` function on the Tellor adapter contract. This will set the status of the final reference value to "Confirmed" and determine the payouts for each counterparty involved in the derivative contract. No further submissions to DIVA Protocol are possible afterwards.

**Comments:**

- Values submitted to Tellor Protocol prior to pool expiration or for pools that have already been confirmed will be ignored. To save gas, it is recommended to check the timestamps of the Tellor submissions and the status of the final reference value prior to calling the `setFinalReferenceValue` function on the Tellor adapter contract.
- Values submitted to the Tellor Protocol may be disputed. Refer to [Tellor disputes](#tellor-disputes) section for details.

## Reporting frequency

Tellor reporters are required to stake 100 TRB (also referred to as 1 stake) to be able to report one value every 12 hours. 2 stakes allow to report one value every 6 hours, etc.

## Fees

Reporters receive two types of rewards:

### Settlement fee

- DIVA Protocol pays a 0.05% fee to the assigned data provider. As the assigned reporter in the DIVA Tellor integration is the Tellor adapter contract, the fee is transferred to the actual reporter when the `setFinalReferenceValue` function inside the Tellor adapter contract is called. Reporters can calculate the settlement fee reward by multiplying the gross collateral that was deposited into the pool during its lifetime (`collateralBalanceGross` field in subgraph) by 0.05%. The fee is paid in collateral token. The settlement fee is retained inside the DIVA smart contract until it is claimed by the recipient. This can be done via the `claimFee` function in the DIVA smart contract directly or via the `claimDIVAFee` function in the Tellor adapter contract.
- The maximum fee for $10 to reporter. The remainder goes to the Tellor treasury. This logic was implemented to prevent "dispute wars" to receive the reward

### Tips

- Anyone can add tips in any ERC20 token to incentivize reporting. Multiple tips in multiple ERC20 tokens are possible. The reporter can choose which ones to claim. The tip is retained inside the Tellor adapter contract until it is claimed by the recipient. This can be done via the `claimTips` function in the Tellor adapter contract.

Notes:

- To calculate the split, the reporters are also submitted the USD value of the collateral token.
- Only the first reporter whose reported value remained undisputed for at least 12h receives a reward. It is recommended to check existing value submission before spending gas on submitted a value.

## Cost reward calculations

- `submitValue`: 160k gas
- `setFinalReferenceValue`: 250k gas

At 100 Gwei/gas, the gas fee is 41m Gwei (0.041 ETH, 0.041 MATIC, etc.).

## Relevant addresses

Relevant addresses on Goerli:

| Name                       |                                                                             |                                                                                                                                                                                                                    |
| :------------------------- | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tellor adapter contract    | `0x9959f7f8eFa6B77069e817c1Af97094A9CC830FD`                                | Contract that connects the Tellor system with DIVA Protocol. To be used as the data provider address when creating a pool                                                                                          |
| TRB token                  | `0x51c59c6cAd28ce3693977F2feB4CfAebec30d8a2`                                | Token that needs to be staked in order to be able to report values to the Tellor system. One stake corresponds to 100 TRB allows and allows to report one value every 12 hours.                                    |
| Tellor system              | `0xB3B662644F8d3138df63D2F43068ea621e2981f9`                                | Tellor contract where values are reported to and TRB staked.                                                                                                                                                       |
| Tellor governance contract | `0x02803dcFD7Cb32E97320CFe7449BFb45b6C931b8`                                | Implements the `beginDispute` function to initiate a dispute.                                                                                                                                                      |
| DIVA smart contract        | `0x659f8bF63Dce2548eB4D9b4BfF6883dddFde4848`                                | The DIVA smart contract address that the Tellor adapter contract points to. Selecting the Tellor adapter contract as the oracle for any other version of the DIVA smart contract will result in failure to report. |
| DIVA subgraph              | https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new-2 | Subgraph containing all pool related information.                                                                                                                                                                  |

Note that depositing a stake or or disputing a value requires prior approval for the TRB token for the corresponding contract to transfer the token.

## Supported data feeds

The Tellor client implementations for DIVA Protocol support any data feed. BTC/USD and ETH/USD prices are pulled automatically. Any other data would have to be submitted manually by the provided scripts.

## Tellor Disputes

- Disputed values will be disregarded and are handled in a separate process managed by Tellor.

## DIVA Disputes

The Tellor adapter deactivates the possibility to challenge within DIVA Protocol as the Tellor system comes with an embedded dispute mechanism. That is, the value that is reported to DIVA Protocol via the Tellor adapter is considered the final one.

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
1. **DIVA submission:** On [Etherscan](https://goerli.etherscan.io/address/0x9959f7f8eFa6B77069e817c1Af97094A9CC830FD#code), call the `setFinalReferenceValue` function on the DIVA Tellor adapter contract (`0x9959f7f8eFa6B77069e817c1Af97094A9CC830FD`) using the pool Id as input.

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
| [`addTip`](#addTip)                                                                             | Function to run a single tip.                                                                                                        |
| [`claimTips`](#claimTips)                                                                       | Function to claim tips.                                                                                                              |
| [`claimDIVAFee`](#claimDIVAFee)                                                                 | Function to claim fee from DIVA.                                                                                                     |
| [`claimTipsAndDIVAFee`](#claimTipsAndDIVAFee)                                                   | Function to claim tips from DIVAOracleTellor and claim fee from DIVA.                                                                |
| [`setFinalReferenceValue`](#setFinalReferenceValue)                                             | Function to set the final reference value for a given `_poolId`.                                                                     |
| [`setFinalReferenceValueAndClaimTips`](#setFinalReferenceValueAndClaimTips)                     | Function to set the final reference value and claim tips for a given `_poolId` with given tipping tokens.                            |
| [`setFinalReferenceValueAndClaimDIVAFee`](#setFinalReferenceValueAndClaimDIVAFee)               | Function to set the final reference value and claim DIVA fee for a given `_poolId` with given tipping tokens.                        |
| [`setFinalReferenceValueAndClaimTipsAndDIVAFee`](#setFinalReferenceValueAndClaimTipsAndDIVAFee) | Function to set the final reference value and claim tips and DIVA fee for a given `_poolId` with given tipping tokens.               |
| **Getter functions**                                                                            |                                                                                                                                      |
| [`getChallengeable`](#getChallengeable)                                                         | Function to return whether the oracle's data feed is challengeable or not.                                                           |
| [`getExcessFeeRecipient`](#getExcessFeeRecipient)                                               | Function to return the excess fee recipient address.                                                                                 |
| [`getMinPeriodUndisputed`](#getMinPeriodUndisputed)                                             | Function to return the minimum period (in seconds) a reported value has to remain undisputed in order to be considered valid.        |
| [`getMaxFeeAmountUSD`](#getMaxFeeAmountUSD)                                                     | Function to return the max fee amount usd value with 18 decimals.                                                                    |
| [`getDIVAAddress`](#getDIVAAddress)                                                             | Function to return the DIVA address that the oracle is linked to.                                                                    |
| [`getTipAmounts`](#getTipAmounts)                                                               | Function to return the array of tipping amounts for the given array of `ArgsBatchInput` struct.                                      |
| [`getReporters`](#getReporters)                                                                 | Function to return the array of reporter addresses for the given `_poolIds`.                                                         |
| [`getTippingTokens`](#getTippingTokens)                                                         | Function to return the array of tipping tokens for the given array of `ArgsGetTippingTokens` struct.                                 |
| [`getTippingTokensLengthForPoolIds`](#getTippingTokensLengthForPoolIds)                         | Function to return the lengths of tipping tokens for the given `_poolIds`.                                                           |
| [`getPoolIdsForReporters`](#getPoolIdsForReporters)                                             | Function to return the array of pool ids reported by reporters for the given array of `ArgsGetPoolIdsForReporters` struct.           |
| [`getPoolIdsLengthForReporters`](#getPoolIdsLengthForReporters)                                 | Function to return the lengths of pool ids reported by reporters for the given `_reporters`.                                         |
| [`getQueryId`](#getQueryId)                                                                     | Function to return the query id for a given `_poolId`.                                                                               |
| **Setter functions** (execution is reserved for contract owner only)                            |                                                                                                                                      |
| [`setExcessFeeRecipient`](#setExcessFeeRecipient)                                               | Function to update `_excessFeeRecipient`.                                                                                            |     |
| [`setMinPeriodUndisputed`](#setMinPeriodUndisputed)                                             | Function to update `_minPeriodUndisputed` with minimum value of 1 hour (3600 seconds) and maximum value of 18 hours (64800 seconds). |
| [`setMaxFeeAmountUSD`](#setMaxFeeAmountUSD)                                                     | Function to update `_maxFeeAmountUSD`.                                                                                               |
| **Batch functions**                                                                             |
| [`batchClaimTips`](#batchClaimTips)                                                             | Batch version of `claimTips`.                                                                                                        |
| [`batchClaimDIVAFee`](#batchClaimDIVAFee)                                                       | Batch version of `claimDIVAFee`.                                                                                                     |
| [`batchClaimTipsAndDIVAFee`](#batchClaimTipsAndDIVAFee)                                         | Batch version of `claimTipsAndDIVAFee`.                                                                                              |

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
    ArgsBatchInput[] calldata _argsBatchInputs
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
    uint256[] calldata _poolIds
)
    external
    view
    returns (address[] memory);
```

> **Note:** it returns the zero address if a value has been reported to the Tellor contract but it hasn't been pulled into DIVA Protocol by calling any one of [`setFinalReferenceValue`](#setFinalReferenceValue), [`setFinalReferenceValueAndClaimTips`](#setFinalReferenceValueAndClaimTips), [`setFinalReferenceValueAndClaimDIVAFee`](#setFinalReferenceValueAndClaimDIVAFee) or [`setFinalReferenceValueAndClaimTipsAndDIVAFee`](#setFinalReferenceValueAndClaimTipsAndDIVAFee) yet.

## getTippingTokens

Function to return the array of tipping tokens for the given array of `ArgsGetTippingTokens` struct.

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
    uint256 poolId;
    uint256 startIndex;
    uint256 endIndex;
}
```

## getTippingTokensLengthForPoolIds

Function to return the lengths of tipping tokens for the given `_poolIds`.

```js
function getTippingTokensLengthForPoolIds(
    uint256[] calldata _poolIds
)
    external
    view
    returns (uint256[] memory);
```

## getPoolIdsForReporters

Function to return the array of pool ids reported by reporters for the given array of `ArgsGetPoolIdsForReporters` struct.

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
    address reporter;
    uint256 startIndex;
    uint256 endIndex;
}
```

## getPoolIdsLengthForReporters

Function to return the lengths of pool ids reported by reporters for the given `_reporters`.

```js
function getPoolIdsLengthForReporters(
    address[] calldata _reporters
)
    external
    view
    returns (uint256[] memory);
```

## getQueryId

Function to return the query id for a given `_poolId`.

```js
function getQueryId(
    uint256 _poolId
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
    address _newExcessFeeRecipient
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
    uint32 _newMinPeriodUndisputed
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
    uint256 _newMaxFeeAmountUSD
)
    external;
```

To keep a max fee amount usd parameter unchanged, simply pass the current value as function parameter.
