# How to get started

Scripts:

1. `yarn install` to install dependencies
1. `yarn compile` to compile contracts
1. `yarn hardhat test` to run tests (includes compilation of contracts)

If you have `node` version 17 or higher installed, you may need to downgrade it to 16.13.0, for instance, to make it work.

1. `node --version` to check the node version
2. `nvm use 16.13.0` to downgrade the node version

If you don't have `nvm` installed yet, check out their [repo](https://github.com/nvm-sh/nvm).

# Table of Contents

1.  [DIVA Oracle Tellor](#diva-oracle-tellor)
1.  [DIVA Porter module](#diva-porter-module)

# DIVA Oracle Tellor

## How to run test

`yarn hardhat test test/DIVAOracleTellor.test.js` to run the tests in `test/DIVAOracleTellor.test.js`

## DIVA oracle data specifications

| Last updated on | Key changes                                                                                                                                                                                                                                                                    | Updated by   |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| 28 March 2022   | Renamings and re-orderings as per [smart contract release notes](https://github.com/divaprotocol/diva-contracts/releases/tag/v0.9.0); ABIs updated; `createdAt` field added in subgraph to indicate time of pool creation; whitelist and DIVA smart contract addresses updated | @Walodja1987 |
| 9 February 2022 | Additional information added                                                                                                                                                                                                                                                   | @Walodja1987 |

### Table of DIVA oracle

1.  [Intro](##intro)
1.  [DIVA queries](##diva-queries)
    1.  [DIVA smart contract](##diva-smart-contract)
    1.  [DIVA subgraph](##diva-subgraph)
1.  [Submit final reference value](##submit-final-reference-value)
1.  [Challenges](##challenges)
1.  [Settlement fees](##settlement-fees)
    1.  [Get fee claim](##get-fee-claim)
    1.  [Claim fees](##claim-fees)
    1.  [Transfer fee claim](##transfer-fee-claim)
1.  [Whitelist queries](##whitelist-queries)
    1.  [Whitelist smart contract](##whitelist-smart-contract)
    1.  [Whitelist subgraph](##whitelist-subgraph)
1.  [DIVA protocol addresses](##diva-protocol-addresses)

## Intro

[DIVA Protocol](https://github.com/divaprotocol/diva-contracts) is a smart contract that allows its users to create derivative contracts with a pre-defined expiration time on virtually any metric. To determine the payoffs of the long and short side of the contract, one oracle input is required following contract expiration. In DIVA Protocol, the data provider is represented by an Ethereum address and set at the time of product creation. 

This document describes how data providers can access the relevant data and interact with the DIVA Protocol to submit values. This document provides general information that is applicable to all types of oracles. Oracle specific information is available in the `/docs` directory.

Refer to the [DIVA Protocol github](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#settlement-process) to learn more about the settlement process.

## Function overview
This overview covers the DIVA smart contract functions that are most relevant for data providers. All other functions can be found in the official [DIVA documentation](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md). 

TODO


## Data request
The creation event of a derivative contract (also referred to as a "contingent pool" or simply "pool") constitutes a request to a data provider to provide a data point at a pre-defined future point in time. It's the data provider's responsibility to set up the required listeners and notification services to not miss the reporting window.

The recommended way to monitor pools is using the DIVA subgraph, which captures both data stored inside the DIVA smart contract as well as data emitted as part of events. The DIVA subgraph is available on the following networks:
* Goerli: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new
* Polygon: n/a
* Mainnet: n/a
* Arbitrum: n/a

Pool information can also be obtained via the `getPoolParameters` smart contract function. However, the returned information is limited to data stored inside the DIVA smart contract and does not include event data. That's why this approach is not described in detail in this document. For more information, refer to the official [DIVA documentation](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md).

### DIVA subgraph

Below provides an example DIVA subgraph query including the most relevant fields for data providers. The full list of available fields can be found in the [DIVA subgraph](https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new).

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
        collateralToken {
          id
          name
          symbol
          decimals
        }
        collateralBalanceGross
        settlementFee
        challengedBy
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
| :----------------- | :------ | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`   | Id of the contingent pool / derivative contract; incrementally increasing integer starting at 1.    
| `referenceAsset`   | The metric or event for which reporting is required (e.g., BTC/USD, ETH/USD, etc).     
| `expiryTime`       | The contract expiration time and the "as of time" the reference asset value has to be reported of; expressed as a unix timestamp in seconds since epoch (UTC). |
| `dataProvider`     |  Ethereum account (EOA or smart contract) that will report the final reference value.                                                                            
| `finalReferenceValue`     | Current reference asset value stored in the DIVA smart contract for the corresponding pool, expressed as an integer with 18 decimals. Set to 0 at pool creation.                                        |
| `statusFinalReferenceValue`     | Status of final reference value (Open, Submitted, Challenged, Confirmed). "Open" at pool creation.                                       |
| `collateralToken.id`     | Address of the ERC20 collateral token.                                       |
| `collateralToken.name`     |  Name of `collateralToken`.                                       |
| `collateralToken.symbol`     |  Symbol of `collateralToken`.                                       |
| `collateralToken.decimals`     |  Number of decimals of `collateralToken`.                                       |
| `collateralBalanceGross`     |  Total collateral added to the pool during its lifetime. Used as the basis to estimate fee rewards.                                       |
| `settlementFee`     | Fee that goes to the data provider when users remove liquidity / redeem, in % of the collateral amount being removed/redeemed; expressed as an integer with 18 decimals (e.g., 500000000000000 = 0.05%).                                       |
| `challenges.challengedBy`     |  Address that submitted a challenge for the submitted value. Only relevant if the possibility to challenge was enabled by the data provider in the first place.                                       |
| `challenges.proposedFinalReferenceValue`     |  Final value proposed by challenger; expressed as an integer with 18 decimals. IMPORTANT: Those values DO NOT overwrite `finalReferenceValue`. Only relevant if the possibility to challenge was enabled by the data provider in the first place.                                       |
| `submissionPeriod`     | Submission period in seconds applicable to the corresponding pool.                                       |
| `challengePeriod`     | Challenge period in seconds applicable to the corresponding pool.                                       |
| `reviewPeriod`     | Review period in seconds applicable to the corresponding pool.                                       |
| `createdAt`     |  Timestamp of pool creation in seconds since epoch (UTC).                                       |
| `createdBy`     |  Address that created the pool.                                       |

**Comments:**
* If the possibility to challenge is enabled by the data provider, the data provider needs to monitor all challenges using `statusFinalReferenceValue: "Challenged"` as the query condition. As challenges may be valid, data providers SHOULD NOT automatically report when a challenge occurs but rather handle them manually. Challenges are typically enabled when a centralized party acts as the oracle. Challenges are disabled for decentralized oracles like Tellor which have their own dispute resolution mechanisms.
* By default, the subgraph query will return a maximum of 1000 entries. To ensure that all pools are captured, we recommend implementing a loop using `id_gt` as is described [here](https://thegraph.com/docs/en/querying/graphql-api/#example-using-and-2).
* Make sure that the timezone of the `expiryTime` and your off-chain data source are in sync.
* The settlement fee as well as the settlement related periods (`submissionPeriod`, `challengePeriod` and `reviewPeriod`) are pool specific and should be read from the subgraph data.


## Data submission

Data is submitted to the DIVA smart contract by calling the `setFinalReferenceValue` function. This function is callable only by the data provider assigned to the specific pool being reported during the 7d submission window following pool expiration. If a value is challenged, the data provider has a 5d review window starting at the time of the first challenge to re-submit a value calling the same function. 

Once a value has been submitted, `statusFinalReferenceValue` switches from `0` (Open) to `1` (Submitted) or `3` (Confirmed) depending on whether the [challenge mechanism](##optional-challenge-mechanism) was activated or not. The data provider cannot submit a second value unless the status changes to `2` (Challenged) which is only possible when DIVA's challenge mechanism was activated. Once the value reaches "Confirmed" stage, the value is considered final and no changes can be made anymore. Refer to the official [DIVA documentation](https://github.com/divaprotocol/diva-contracts/blob/main/DOCUMENTATION.md#set-final-reference-value) for details.

```js
function setFinalReferenceValue(
    uint256 _poolId,                // The pool Id for which the final value is being submitted
    uint256 _finalReferenceValue,   // Proposed final value by the data provider expressed as an integer with 18 decimals (e.g., 18500000000000000000 for 18.5)
    bool _allowChallenge            // Flag indicating whether the challenge functionality should be enabled (1) or not (0)
)
    external;
```

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

The `setFinalReferenceValue` function can be either called directly or wrapped into another smart contract (as done in the case of Tellor).

>**Note:** DIVA Protocol does not accept negative values. If the underlying metric can go negative, it is recommended to apply a shift or normalization to render it positive.


## Challenges

DIVA integrates an optional dispute/challenge mechanism which can be activated by setting the`_allowChallenge` parameter to `true` when a data provider calls the `setFinalReferenceValue` function. This is particularly useful when manual oracles such as a human reporters are used. To avoid surprises for users, data providers are encouraged to wrap the `setFinalReferenceValue` function into a separate smart contract and hard-code the `_allowChallenge` value so that pool creators know the data provider's challenge policy at the time of pool creation.

Each position token holder of a pool can submit a challenge including a value that they deem correct. This value is not stored inside the DIVA smart contract but emitted as part of the `StatusChanged` event and indexed in the DIVA subgraph. Data providers should leverage this information as part of their review process in case of a challenge.

## Settlement fees

Data providers are rewarded with a settlement fee of 0.05% of the total (gross) collateral that was deposited into the pool over time (fee parameter is updateable by DIVA governance). The fee is retained within the DIVA smart contract when users withdraw collateral from the pool (via remove liquidity or redeem) and can be claimed by the corresponding data provider at any point in time. The data provider can also transfer the fee claim to another recipient using the `transferFeeClaim` function. This is particularly useful when the `setFinalReferenceValue` function is wrapped into a smart contract.

### Get fee claim

The claimable fee amount can be obtained by calling the following function:

```js
function getClaim(
    address _collateralToken,       // Address of the token in which the fee is denominated
    address _recipient              // Address of the fee claim recipient
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
        "type": "address"
      }
    ],
    "name": "getClaim",
    "outputs": [{
      "internalType": "uint256",
      "name": "",
      "type": "uint256"
    }],
    "stateMutability": "view",
    "type": "function"
  }
```

### Claim fees

The settlement fee is paid in collateral token and can be claimed by the entitled data provider by calling the following function:

```js
function claimFee(
    address _collateralToken,   // Collateral token address
    address _recipient          // Recipient address
) external;
```

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_collateralToken",
      "type": "address"
    }
  ],
  "name": "claimFees",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}
```




### Transfer fee claim

By default, the account reporting the final vlaue is entitled to claim the fee. If the data provider is a smart contract, the smart contract will be entitled to claim that fee. Additional logic needs to be implemented within such contracts to transfer the fee payment by using the following function:

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

Batch version of `transferFeeClaim` to transfer multiple fee claims to multiple recipient addresses in one single transaction.

```js
function batchTransferFeeClaim(
    ArgsBatchTransferFeeClaim[] calldata _argsBatchTransferFeeClaim
)
    external;
```

where `ArgsBatchTransferFeeClaim` struct is defined as

```js
struct ArgsBatchTransferFeeClaim {
    address recipient;          // Address of fee claim recipient
    address collateralToken;    // Collateral token address
    uint256 amount;             // Amount (expressed as an integer with collateral token decimals) to transfer to recipient
}
```

ABI:
```json
{
  "inputs": [
    {
      "components": [
        { "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "collateralToken",
          "type": "address"
        },
        { "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "internalType": "struct IClaim.ArgsBatchTransferFeeClaim[]",
      "name": "_argsBatchTransferFeeClaim",
      "type": "tuple[]"
    }
  ],
  "name": "batchTransferFeeClaim",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
  }
```

All fee claims are stored in the subgraph inside the `FeeRecipient` entity. Example subgraph query to get the fees claims for a given data provider address (user lower case for the address in the where condition):

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

## Whitelist queries

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
* Arbitrum: n/a

## DIVA protocol addresses

* Goerli: 0x2d941518E0876Fb6042bfCdB403427DC5620b2EC
* Polygon: n/a
* Mainnet: n/a
* Arbitrum: n/a


