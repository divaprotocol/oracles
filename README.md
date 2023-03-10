# How to get started

Scripts:

1. `yarn` to install dependencies
1. `yarn c` to compile contracts
1. `yarn t` to run tests (includes compilation of contracts). Example command for executing a specific test file, here `test/DIVAOracleTellor.test.js`: `yarn hardhat test test/DIVAOracleTellor.test.js`

If your installed `node` version is 17 or higher, you may need to downgrade it to version 16.13.0, for instance, in order to ensure proper functionality. Below an example to downgrade the version using [`nvm`](https://github.com/nvm-sh/nvm):

1. `node --version` to check the node version
2. `nvm use 16.13.0` to downgrade the node version

# Table of Contents

1. [Intro](##intro)
2. [Terminology](#terminology)
3. [Settlement process in DIVA Protocol](#settlement-process-in-diva-protocol)
4. [Relevant functions](#relevant-functions)
5. [Data monitoring](#data-monitoring) \
   5.1 [DIVA subgraph](#diva-subgraph) \
   5.2 [General guidance for implementing listeners](#general-guidance-for-implementing-listeners)
6. [Data submission](#data-submission)
7. [Reporting rewards](#reporting-rewards) \
   7.1 [Query rewards from subgraph](#query-rewards-from-subgraph) \
   7.2. [Query rewards from contract](#query-rewards-from-contract) \
   7.3 [Transfer reward](#transfer-reward)

# Intro

[DIVA Protocol](https://github.com/divaprotocol/diva-contracts) is a smart contract that allows its users to create derivative contracts on virtually any metric with pre-defined expiration times. To calculate the payouts for the long and short positions of the contract, an oracle input is required following the contract's expiration. In DIVA Protocol, the responsibility of outcome reporting is assigned to an Ethereum address at the time of the derivative contract's creation, which can be any EOA or smart contract.

This repository contains a collection of smart contract-based oracle adapters that can be easily plugged into DIVA Protocol by simply providing the corresponding contract address as the data provider when creating a derivative contract. 

Audited adapters that can be used:

1. [Tellor adapter][tellor-adapter]

Other adapters currently in development:
1. [Shamba adapter][shamba-adapter] (⚠️ centralized setup)
1. [Arbor adapter][arbor-adapter] (⚠️ unaudited)
<!-- 1. [GoPlugin adapter][...] -->

>**Important:** DO NOT use unaudited adapters! Use centralized oracles at your own risk!

This document provides general information about the settlement process in DIVA Protocol and guidance for data providers how to access relevant data. Oracle adapter specific documentation is available in the `/docs` directory.

# Terminology

In this document, the following terms will be used interchangeably to refer to the same concepts:
* Derivative contract, contingent pool, and pool
* Protocol, smart contract, and contract

# Settlement process in DIVA Protocol

The goal of the settlement process in DIVA Protocol is to determine the value of the reference asset at the time of expiration and, as a result, the payoffs for short and long position tokens. The settlement process begins immediately after the pool expires and concludes when the final reference value attains "Confirmed" status, at which point position token holders can start redeeming their position tokens.

DIVA Protocol's settlement mechanism includes an optional challenge feature that allows human oracles to correct errors made in the submission of data. For smart contract-based oracles that cannot realistically re-submit data, this feature is typically disabled. As a result, the first value submitted by the oracle to DIVA Protocol determines the payouts and users can start redeeming their position tokens.

DIVA Protocol has two fallback layers:

1. **Fallback data provider:** In the event that the assigned data provider fails to submit a value during the submission window, the fallback data provider will step in. It is important to confirm with the DIVA Protocol community, under which circumstances users can expect the fallback data provider to step in.
1. **Defaut:** If the fallback data provider also fails to submit a value, the payout will default to `gradient` for the long position and `1-gradient` for the short position token, minus applicable fees. The `gradient` is one of the parameters that determines the shape of the payoff profile and is specified at the time of derivative contract creation.

For more information on DIVA's settlement process, please refer to the official [DIVA Protocol documentation](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#settlement-process).

# Relevant functions

The following overview provides a list of [DIVA Protocol functions](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#function-overview-1) that are most relevant for data providers:
| Name                       |                                                                             |                        
| :------------------------- | :-------------------------------------------------------------------------- | 
| **Value submission related functions**                                                                      |                                                                                                                                                             |
| [`setFinalReferenceValue`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#setfinalreferencevalue)                                       | Function to submit the final value of the reference asset.                                                                                                  |
| [`challengeFinalReferenceValue`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#challengefinalreferencevalue)                           | Function to challenge the final reference value submitted by the data provider. Only relevant when centralized oracles are used.                                                                             |
| **Reward related functions**                                                                      |                                                                                                                                                             |
| [`transferFeeClaim`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#transferfeeclaim)                                                   | Function to transfer a fee claim to another recipient.                                                                                                      |
| [`claimFee`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#claimfee)                                                                   | Function to claim fee.                                                                                                                                      |
| **Getter functions**                                                                      |                                                                                                                                                             |
| [`getPoolParameters`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getpoolparameters)                                                 | Function to return the pool parameters for a given pool Id.                                                                                                 |
| [`getPoolParametersByAddress`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getpoolparametersbyaddress)                               | Function to return the pool parameters for a given position token address.                                                                                  |
| [`getClaim`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getclaim)                                                                   | Function to get the fee claim for a given recipient denominated in a given collateral token.                                                                |
| [`getTip`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#gettip)                                                                   | Function to return the amout tipped in collateral token for a given pool.                                                                |
|[`getFees`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getfees)|Function to return the fees applicable for a given `_indexFees`, which is returned as part of `getPoolParameters`. The settlement fee is the relevant fee for data providers.|
|[`getSettlementPeriods`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getsettlementperiods)|Function to return the settlement periods applicable for a given `_indexSettlementPeriods`, which is returned as part of `getPoolParameters`.|
| **Batch functions**                      |                  
|[`batchSetFinalReferenceValue`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#batchsetfinalreferencevalue)|Batch version of `setFinalReferenceValue`|
|[`batchChallengeFinalReferenceValue`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#batchchallengefinalreferencevalue)|Batch version of `challengeFinalReferenceValue`|
| [`batchClaimFee`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#batchclaimfee)                                                         | Batch version of `claimFee` function.                                                                                                                       |
| [`batchTransferFeeClaim`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#batchtransferfeeclaim)                                         | Batch version of `transferFeeClaim` function.                                                                                                               |

# Data monitoring

The creation of a derivative contract, also referred to as a "contingent pool" or simply "pool", constitutes a request to a data provider to supply a data point at a predetermined future time. It is the responsibility of the data provider to set up the necessary listeners and notification services to not miss the reporting window.

For monitoring pools, we recommend using the DIVA subgraph, which captures both data stored within the DIVA smart contract and data emitted as part of events. The DIVA subgraph is available on the following networks:
* Goerli: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new
* Sepolia: n/a
* Polygon: n/a
* Mainnet: n/a
* Arbitrum: n/a

Alternatively, reporters can use DIVA's [`getPoolParameters`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getpoolparameters) function to access pool information. However, please note that the returned information is limited to the data stored within the DIVA smart contract and does not include event data.

## DIVA subgraph

Below provides an example subgraph query including the most relevant pool information for data providers. The full list of available fields can be found in [here](https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new).

```js
{ 
    pools (first: 1000, where: {
      expiryTime_gt: "1667147292",
      expiryTime_lte: "1667752092",
      statusFinalReferenceValue: "Open",
      dataProvider: "0x9f6cd21bf0f18cf7bcd1bd9af75476537d8295fb"}
      ) {
        id
        referenceAsset
        expiryTime
        dataProvider
        finalReferenceValue
        statusFinalReferenceValue
        statusTimestamp
        collateralToken {
          id
          name
          symbol
          decimals
        }
        collateralBalanceGross
        settlementFee
        challenges {
          challengedBy
          proposedFinalReferenceValue
        }
        submissionPeriod
        challengePeriod
        reviewPeriod
        createdAt
        createdBy
    }
}
```

where:

| Parameter          |  Description|
| :----------------- | :------ | 
| `id`   | Id of the contingent pool; incrementally increasing integer starting at 1.    
| `referenceAsset`   | The metric or event for which reporting is required (e.g., BTC/USD, ETH/USD, etc).     
| `expiryTime`       | Expiration time of the pool expressed as a unix timestamp in seconds since epoch (UTC). |
| `dataProvider`     | Ethereum account (EOA or smart contract) that was assigned to report the final reference value.                                                                            
| `finalReferenceValue`     | Current reference asset value stored in the DIVA smart contract for the corresponding pool, expressed as an integer with 18 decimals. Set to 0 at pool creation. Update when a value is Submitted or Confirmed. Not updated when a submission was challenged.                                        |
| `statusFinalReferenceValue`     | Status of final reference value (0 = Open, 1 = Submitted, 2 = Challenged, 3 = Confirmed). "Open" at pool creation.                                       |
| `statusTimestamp`     | Status timestamp expressed as a unix timestamp in seconds since epoch (UTC). Updated when the `statusFinalReferenceValue` changes. Equal to time of creation initially.                                       |
| `collateralToken.id`     | Address of the ERC20 token used as collateral in the pool. Payouts are denominated in that asset.                                       |
| `collateralToken.name`     |  Name of collateral token.                                       |
| `collateralToken.symbol`     |  Symbol of collateral token.                                       |
| `collateralToken.decimals`     |  Number of decimals of collateral token.                                       |
| `collateralBalanceGross`     |  Total collateral added to the pool during its lifetime. Used as the basis to estimate fee rewards.                                       |
| `settlementFee`     | Fee that goes to the data provider when users remove liquidity / redeem, in % of the collateral amount being removed/redeemed; expressed as an integer with 18 decimals (e.g., 500000000000000 = 0.05%).                                       |
| `challenges.challengedBy`     |  Address that submitted a challenge for the submitted value. Only relevant if the possibility to challenge was enabled by the data provider in the first place.                                       |
| `challenges.proposedFinalReferenceValue`     |  Final value proposed by challenger; expressed as an integer with 18 decimals. IMPORTANT: Those values DO NOT overwrite `finalReferenceValue` but are only emitted as part of the event. Only relevant if the possibility to challenge was enabled by the data provider in the first place.                                       |
| `submissionPeriod`     | Submission period in seconds applicable to the corresponding pool.                                       |
| `challengePeriod`     | Challenge period in seconds applicable to the corresponding pool.                                       |
| `reviewPeriod`     | Review period in seconds applicable to the corresponding pool.                                       |
| `createdAt`     |  Timestamp of pool creation in seconds since epoch (UTC).                                       |
| `createdBy`     |  Address that created the pool.                                       |

## General guidance for implementing listeners

### Handling challenges

If an oracle adapter enables DIVA's [challenge functionality](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#challenge), they should monitor all challenges using a separate script with `statusFinalReferenceValue: "Challenged"` as the query condition. As challenges may be valid, data providers should **handle them manually** rather than reporting them automatically on dispute. 

Challenges are typically enabled when a centralized party acts as the data provider. Challenges are disabled for decentralized oracles like [Tellor](https://tellor.io/) that come with their own dispute resolution mechanisms.

### Capturing all pools

By default, the subgraph query returns a maximum of 1000 entries. To ensure that all pools are captured by the listener, it is recommended to implement a loop using `id_gt` as is described in the [Graph Protocol docs](https://thegraph.com/docs/en/querying/graphql-api/#example-using-and-2).

### Fees and settlement periods

The settlement fee and the settlement-related periods (`submissionPeriod`, `challengePeriod` and `reviewPeriod`) are specific to each pool. The fee ranges between 0% and 1.5% and the settlement related periods can be between 3 and 15 days.

### Timezones

Ensure that the timezone of the `expiryTime` and your off-chain data source are using the same timezone (UTC).

### Fallback data source

As the subgraph is an off-chain process that reads and aggregates data emitted on the blockchain, there is a risk that it may go down for various reasons. Reporters are recommended to also implement a fallback option using DIVA's [`getPoolParameter`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#getpoolparameters) function.

### Testing

The most important thing: **Test your oracle adapter extensively before using it in production.** The DIVA Protocol team is happy to review your implementation. Please reach out in the oracles channel in their [Discord](https://discord.gg/8fAvUspmv3).

# Data submission

To submit data to the DIVA smart contract, the assigned data provider must call the [`setFinalReferenceValue`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#setfinalreferencevalue) function within the submission window.

After the data provider submits a value, the `statusFinalReferenceValue` parameter switches from "Open" (0) to either "Submitted" (1) or "Confirmed" (3), depending on whether the optional [challenge mechanism](##optional-challenge-mechanism) was activated or not. If the challenge mechanism is activated and a challenge is initiated, the status changes from "Submitted" to "Challenged" (2), and the data provider has a chance to resubmit a new value within the review window or confirm the previous one by re-submitting the previous value again or not submitting at all.

Once the value reaches "Confirmed" stage, it is considered final and no further submissions can be made. Refer to the official [DIVA Protocol documentation](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#set-final-reference-value) for more details.

The `setFinalReferenceValue` function can be either called directly or wrapped into another smart contract, as done in the [Tellor adapter][tellor-adapter], for instance.

```js
function setFinalReferenceValue(
    uint256 _poolId,                // The pool Id for which the final value is being submitted
    uint256 _finalReferenceValue,   // Proposed final value by the data provider expressed as an integer with 18 decimals (e.g., 18500000000000000000 for 18.5)
    bool _allowChallenge            // Flag indicating whether the challenge functionality should be enabled (1) or not (0)
)
    external;
```

>**Important:** The submitted value has to be represented as an **integer with 18 decimals**, e.g., `18500000000000000000` for `18.5`. Further, DIVA Protocol **does not accept negative values**. If the underlying metric can go negative, it is recommended to apply a shift or normalization to render it positive.

ABI:

```json
{
  "inputs": [
    {
      "internalType": "uint256",
      "name": "_poolId",
      "type": "uint256"
    },
    {
      "internalType": "uint256",
      "name": "_finalReferenceValue",
      "type": "uint256"
    },
    {
      "internalType": "bool",
      "name": "_allowChallenge",
      "type": "bool"
    }
  ],
  "name": "setFinalReferenceValue",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

# Reporting rewards

DIVA Protocol rewards reporters in two ways:
* **Settlement fee:** DIVA Protocol pays a settlement fee of 0.05% (updateable by DIVA owner) of the gross collateral deposited into the pool over time to the data provider in the pool's collateral token. For example, reporting for a pool that has had USDC 100k in liquidity added over its lifetime would yield a settlement fee of USDC 50.
* **Tips:** In addition to the settlement fee, users can add a tip using DIVA Protocol's [`addTip`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#addtip) function to incentivize reporting. This can be particularly useful when the gross collateral of the pool is relatively small and the settlement fee alone would not justify the [gas cost for reporting](#reporting-costs). Note that in DIVA Protocol, the tip can only be given in the collateral token of the respective pool. 

Additional incentives and tipping features can be implemented in the adapter contract. For instance, check out the [Tellor adapter][tellor-adapter] that enables users to tip using any ERC20 token.

## Query rewards from subgraph

Claimable rewards are stored inside the `FeeRecipient` entity in the DIVA subgraph. Note that settlement fees and tips are only reflected in claimable rewards when a pool moves to "Confirmed" stage. Below is an example subgraph query to retrieve the claimable amount for a given data provider address (`id`). 

>**Note:** The address in the `where` condition should be in **lowercase**.

```js
{
  feeRecipients(where: {id: "0x9adefeb576dcf52f5220709c1b267d89d5208d78"}) {
    id
    collateralTokens {
      amount
      collateralToken {
        id
        name
        symbol
        decimals
      }
    }
  }
}
```

## Query rewards from contract

To check the claimable rewards from the DIVA smart contract, reporters can use the [`getClaim`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#claimfee) function. If a pool is in "Confirmed" stage, the returned amount includes both settlement fees and tips.

If a pool has not yet been confirmed, reporters can retrieve the tips using the [`getTip`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#addtip) function. For confirmed pools, the function will return zero as the tip is already included in the claimable amount.

```js
function getClaim(
    address _collateralToken,       // Address of the token in which the fee is denominated
    address _recipient              // Address of the fee claim recipient
)
    external
    view
    returns (uint256);
```

```js
function getTip(
    uint256 _poolId     // Id of pool
)
    external
    view
    returns (uint256);
```

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_collateralToken",
      "type": "address"
    },
    { "internalType": "address",
      "name": "_recipient",
      "type": "address" }
  ],
  "name": "getClaim",
  "outputs": [{
    "internalType": "uint256",
    "name": "",
    "type": "uint256" 
  }],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [
    {
      "internalType": "uint256",
      "name": "_poolId",
      "type": "uint256"
    }
  ],
  "name": "getTip",
  "outputs": [{
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
  }],
  "stateMutability": "view",
  "type": "function"
}
```

## Transfer reward

By default, the assigned data provider is entitled to claim the reward. If the data provider is a smart contract, it may be desireable to transfer the fee claim to another recipient using the [`transferFeeClaim`](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#addtip) function:

```js
function transferFeeClaim(
    address _recipient,         // Address of fee claim recipient
    address _collateralToken,   // Collateral token address
    uint256 _amount             // Amount (expressed as an integer with collateral token decimals) to transfer to recipient
)
    external;
```

ABI:
```json
{
  "inputs": [
    { "internalType": "address",
      "name": "_recipient",
      "type": "address"
    },
    {
      "internalType": "address",
      "name": "_collateralToken",
      "type": "address"
    },
    { "internalType": "uint256",
      "name": "_amount",
      "type": "uint256"
    }
  ],
  "name": "transferFeeClaim",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
  }
```

<!-- ## Whitelist queries

**TODO Remove?**

To protect users from malicious pools, DIVA token holders maintain a whitelist of trusted data providers along with the data feeds that they can provide. Users will be able to reference those at pool creation. Data providers and data feeds are added to the whitelist through a DIVA governance vote following a thorough due diligence process.

In addition to data providers and data feeds, the whitelist contract also stores collateral tokens. Whitelisted data providers are expected to report values for pools where whitelisted collateral tokens are used. For pools with non-whitelisted collateral tokens, data providers are not expected to submit any values. This is to prevent that data providers are abused and paid in worthless tokens.

DIVA whitelist smart contract addresses:

* Goerli: 0x017aA6E15e406b85b8b1dF322e39444D819C8F43
* Polygon: n/a
* Mainnet: n/a
* Arbitrum: n/a

### Whitelist smart contract

The following getter functions can be called to retrieve whitelist information from the whitelist smart contract.

Function to get the data provider name and whitelist status:

```js
function getDataProvider(
   address _dataProvider
)
   external
   view
   returns (DataProvider memory);
```

where

```js
struct DataProvider {
    string name;                  // Data provider name
    bool publicTrigger;           // True if anyone can trigger the oracle (in case of a smart contract, for instance), false otherwise
    uint32 maxDurationInSeconds; // Max pool duration that the reporter will report to  
}
```

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_dataProvider",
      "type": "address"
    }
  ],
  "name": "getDataProvider",
  "outputs": [
    {
      "components": [
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "bool",
          "name": "publicTrigger",
          "type": "bool"
        }
      ],
      "internalType": "struct IWhitelist.DataProvider",
      "name": "",
      "type": "tuple"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
```

Function to return the data feeds for a given data provider:

```js
function getDataFeeds(
     address _dataProvider
)
     external
     view
     returns (DataFeed[] memory);
```

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_dataProvider",
      "type": "address"
    }
  ],
  "name": "getDataFeeds",
  "outputs": [
    {
      "components": [
        {
          "internalType": "string",
          "name": "referenceAsset",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "referenceAssetUnified",
          "type": "string"
        },
        {
          "internalType": "uint8",
          "name": "roundingDecimals",
          "type": "uint8"
        },
        {
          "internalType": "string",
          "name": "dataSourceLink",
          "type": "string"
        },
        {
          "internalType": "bool",
          "name": "active",
          "type": "bool"
        }
      ],
      "internalType": "struct IWhitelist.DataFeed[]",
      "name": "",
      "type": "tuple[]"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
```

This function returns an array of `DataFeed` structs:

```js
struct DataFeed {
    string referenceAsset;              // Name of the data feed provided by the data provider
    string referenceAssetUnified;       // Unified name for referenceAsset to account for different labels used for the same asset (e.g., XBT/USD, BTC-USD, BTCUSD)
    uint8 roundingDecimals;             // The rounding precision that this data feed offers
    string dataSourceLink;              // Link to the data source description
    bool active;                        // Flag indicating whether the data feed is active or not
}
```

Function to return the data feed at a given index for a given data provider:

```js
function getDataFeed(
       address _dataProvider, 
       uint256 _index
)
       external
       view
       returns (DataFeed memory);
```

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_dataProvider",
      "type": "address"
    },
    {
      "internalType": "uint256",
      "name": "_index",
      "type": "uint256"
    }
  ],
  "name": "getDataFeed",
  "outputs": [
    {
      "components": [
        {
          "internalType": "string",
          "name": "referenceAsset",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "referenceAssetUnified",
          "type": "string"
        },
        {
          "internalType": "uint8",
          "name": "roundingDecimals",
          "type": "uint8"
        },
        {
          "internalType": "string",
          "name": "dataSourceLink",
          "type": "string"
        },
        {
          "internalType": "bool",
          "name": "active",
          "type": "bool"
        }
      ],
      "internalType": "struct IWhitelist.DataFeed",
      "name": "",
      "type": "tuple"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
```

Function to return whether a given `_collateralToken` address is whitelisted or not:

```js
function getCollateralToken(
      address _collateralToken
)
      external
      view
      returns (bool);
```

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_collateralToken",
      "type": "address"
    }
  ],
  "name": "getCollateralToken",
  "outputs": [
    {
      "internalType": "bool",
      "name": "",
      "type": "bool"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
```

### Whitelist subgraph

Whitelisted data providers, data feeds and collateral tokens can also be accessed via the whitelist subgraph.

* Goerli: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-goerli
* Polygon: n/a
* Mainnet: n/a
* Arbitrum: n/a -->

[tellor-adapter]: https://github.com/divaprotocol/oracles/blob/main/contracts/DIVAOracleTellor.sol
[shamba-adapter]: https://github.com/shambadynamic/Shamba-Diva-Middleware
[arbor-adapter]: https://github.com/divaprotocol/oracles/blob/main/contracts/DIVAPorterModule.sol