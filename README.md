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

## Data request
The creation event of a derivative contract constitutes a request to a data provider to provide a data point at a pre-defined future point in time. It's the data provider's responsibility to set up the required listeners and notification services to not miss the reporting window.

The recommended way to monitor derivative contracts is using the DIVA subgraph:
* Goerli: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new
* Polygon: n/a
* Mainnet: n/a
* Arbitrum: n/a
<!-- ## Example subgraph query



Pool data can be queried in two ways:

1. DIVA smart contract via the `getPoolParameters` function
1. DIVA subgraph: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new

It is recommended to use the DIVA subgraph to build listeners and notification services as it's more efficient to use and contains more data than returned by `getPoolParameters` function. -->

<!-- ### DIVA smart contract

Reporters can call the following smart contract function to receive the pool information for a given poolId:

```js
getPoolParameters(uint256 poolId)
```

where `poolId` is a unique identifier (more precisely, an integer that starts at 1 and increments by 1) that is assigned to a pool at the time of creation.

ABI:

```json
{
  "inputs": [
    { "internalType": "uint256",
      "name": "_poolId",
      "type": "uint256"
    }
  ],
  "name": "getPoolParameters",
  "outputs": [
    {
      "components": [
        { "internalType": "uint256",
          "name": "floor",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "inflection",
          "type": "uint256"
        },
        { "internalType": "uint256",
          "name": "cap",
          "type": "uint256"
        },
        { "internalType": "uint256",
          "name": "gradient",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "collateralBalance",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "finalReferenceValue",
          "type": "uint256"
        },
        { "internalType": "uint256",
          "name": "capacity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "statusTimestamp",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "shortToken",
          "type": "address"
        },
        { "internalType": "uint96",
          "name": "payoutShort",
          "type": "uint96"
        },
        { "internalType": "address",
          "name": "longToken",
          "type": "address"
        },
        { "internalType": "uint96",
          "name": "payoutLong",
          "type": "uint96"
        },
        {
          "internalType": "address",
          "name": "collateralToken",
          "type": "address"
        },
        { "internalType": "uint96",
          "name": "expiryTime",
          "type": "uint96"
        },
        {
          "internalType": "address",
          "name": "dataProvider",
          "type": "address"
        },
        {
          "internalType": "enum LibDIVAStorage.Status",
          "name": "statusFinalReferenceValue",
          "type": "uint8"
        },
        {
          "internalType": "string",
          "name": "referenceAsset",
          "type": "string"
        }
      ],
      "internalType": "struct LibDIVAStorage.Pool",
      "name": "",
      "type": "tuple"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
```

The following Pool struct is returned when `getPoolParameters` is called:

```js
struct Pool {
    uint256 floor;                       // Reference asset value at or below which the long token pays out 0 and the short token 1 (max payout) (18 decimals)
    uint256 inflection;                  // Reference asset value at which the long token pays out `gradient` and the short token `1-gradient` (18 decimals)
    uint256 cap;                         // Reference asset value at or above which the long token pays out 1 (max payout) and the short token 0 (18 decimals)
    uint256 gradient;                    // Long token payout at inflection (value between 0 and 1) (collateral token decimals)
    uint256 collateralBalance;           // Current collateral balance of pool (collateral token decimals)
    uint256 finalReferenceValue;         // Reference asset value at the time of expiration (18 decimals) - set to 0 at pool creation
    uint256 capacity;                    // Maximum collateral that the pool can accept (collateral token decimals)
    uint256 statusTimestamp;             // Timestamp of status change - set to block.timestamp at pool creation
    address shortToken;                  // Short position token address
    uint96 payoutShort;                  // Payout amount per short position token net of fees (collateral token decimals) - set to 0 at pool creation
    address longToken;                   // Long position token address
    uint256 payoutLong;                  // Payout amount per long position token net of fees (collateral token decimals) - set to 0 at pool creation
    address collateralToken;             // Address of the ERC20 collateral token
    uint96 expiryTime;                   // Expiration time of the pool (expressed as a unix timestamp in seconds)
    address dataProvider;                // Address of data provider
    Status statusFinalReferenceValue;    // Status of final reference price (0 = Open, 1 = Submitted, 2 = Challenged, 3 = Confirmed) - set to 0 at pool creation
    string referenceAsset;               // Reference asset string
}
```

Example response with values:

```js
[
  floor: BigNumber { value: "20000000000000000000" },
  inflection: BigNumber { value: "25000000000000000000" },
  cap: BigNumber { value: "30000000000000000000" },
  gradient: BigNumber { value: "500000" },
  collateralBalance: BigNumber { value: "200000000" },
  finalReferenceValue: BigNumber { value: "0" },
  capacity: BigNumber { value: "115792089237316195423570985008687907853269984665640564039457584007913129639935" },
  statusTimestamp: BigNumber { value: "1667762364" },
  shortToken: '0xEa5551DA89a835cF3B6a87280Bf3AA5d3f48E6C7',
  payoutShort: BigNumber { value: "0" },
  longToken: '0xCadb189f850F6b7Ea2fA8fedf837d8e0BD038774',
  payoutLong: BigNumber { value: "0" },
  collateralToken: '0x9A07D3F69411155f2790E5ed138b750C3Ecd28aD',
  expiryTime: BigNumber { value: "1669841160" },
  dataProvider: '0x9AdEFeb576dcF52F5220709c1B267d89d5208D78',
  statusFinalReferenceValue: 0,
  referenceAsset: 'FTT/USD'
]
``` -->

### DIVA subgraph

Example query including a subset of fields that should cover most of a data provider's needs to build a listener. The full list of fields available can be found in the [DIVA subgraph](https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new).

```js
{ 
    pools (first: 1000, where: {expiryTime_gt: "1667147292", expiryTime_lte: "1667752092", statusFinalReferenceValue: "Open", dataProvider: "0x9f6cd21bf0f18cf7bcd1bd9af75476537d8295fb"}) {
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
| `expiryTime`       | The contract expiration time and the "as of time" the reference asset value has to be reported; expressed as a unix timestamp in seconds since epoch (UTC). |
| `dataProvider`     |  Ethereum account (EOA or smart contract) that will report the final reference value.                                                                            
| `finalReferenceValue`     | Current reference asset value stored in the DIVA smart contract for the corresponding pool, expressed as an integer with 18 decimals. Set to 0 at pool creation.                                        |
| `statusFinalReferenceValue`     | Status of final reference value (Open, Submitted, Challenged, Confirmed). "Open" at pool creation.                                       |
| `collateralToken.id`     | Address of the ERC20 collateral token.                                       |
| `collateralToken.name`     |  Name of `collateralToken`.                                       |
| `collateralToken.symbol`     |  Symbol of `collateralToken`.                                       |
| `collateralToken.decimals`     |  Number of decimals of `collateralToken`.                                       |
| `settlementFee`     | Fee that goes to the data provider when users remove liquidity / redeem, in % of the collateral amount being removed/redeemed; expressed as an integer with 18 decimals (e.g., 500000000000000 = 0.05%).                                       |
| `collateralBalanceGross`     |  Total collateral added to the pool during its lifetime. Used as the basis to estimate fee rewards.                                       |
| `challenges.challengedBy`     |  Address that submitted a challenge for the submitted value. Only relevant if the possibility to challenge was enabled by the data provider in the first place.                                       |
| `challenges.proposedFinalReferenceValue`     |  Final value proposed by challenger; expressed as an integer with 18 decimals. IMPORTANT: Those values DO NOT overwrite `finalReferenceValue`. Only relevant if the possibility to challenge was enabled by the data provider in the first place.                                       |
| `createdAt`     |  Timestamp of pool creation in seconds since epoch (UTC).                                       |
| `createdBy`     |  Address that created the pool.                                       |

**Comments:**
* If the possibility to challenge is enabled by the data provider, the data provider needs to monitor all challenges using `statusFinalReferenceValue: "Challenged"` as the query condition. As challenges may be valid, data providers SHOULD NOT automatically report when a challenge occurs but rather handle them manually. Challenges are typically enabled when a centralized party acts as the oracle. Challenges are disabled for decentralized oracles like Tellor which have their own dispute resolution mechanism.
* By default, The Graph will return a maximum of 1000 entries. To ensure that all pools are captured, we recommend implementing a loop using `id_gt` as is described [here](https://thegraph.com/docs/en/querying/graphql-api/#example-using-and-2).
* Make sure that the timezone of the `expiryTime` and your off-chain data source are in sync.

### Example query
```js
{
  pool(id: 54, where: {dataProvider="dataProvider"}) {
    id
    referenceAsset
    floor
    inflection
    cap
    supplyShort
    supplyLong
    expiryTime
    collateralToken {
      id
      name
      decimals
      symbol
    }
    collateralBalanceGross
    gradient
    collateralBalance
    shortToken {
      id
      name
      symbol
      decimals
      owner
    }
    longToken {
      id
      name
      symbol
      decimals
      owner
    }
    finalReferenceValue
    statusFinalReferenceValue
    payoutLong
    payoutShort
    statusTimestamp
    dataProvider
    protocolFee
    settlementFee
    createdBy
    createdAt
    submissionPeriod
    challengePeriod
    reviewPeriod
    fallbackSubmissionPeriod
    permissionedERC721Token
    capacity
    expiryTime
    challenges {
      challengedBy
      proposedFinalReferenceValue
    }
  }
}
```






## Submit final reference value

Data providers can submit the final value to the DIVA smart contract for pools they were assigned to do so by calling the following function after `expiryDate` has passed:

```
setFinalReferenceValue(
    uint256 _poolId,
    uint256 _finalReferenceValue,
    bool _allowChallenge
)
```

where:

- `_poolId` is the id of the pool that is to be settled
- `_finalReferenceValue` is an 18 decimal integer representation of the final value (e.g., 18500000000000000000 for 18.5)
- `_allowChallenge` is a true/false flag that indicates whether the submitted value can be challenged or not

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

Once a value has been submitted, `statusFinalReferenceValue` switches from `0` (Open) to `1` (Submitted) or `3` (Confirmed) depending on whether the [dispute mechanism](##optional-dispute-mechanism) was activated or not. The data provider cannot submit a second value unless the status changes to `2` (Challenged) which is only possible when the dispute mechanism was activated. Once the value reaches Confirmed stage, the value is considered final and no changes can be made anymore.

Note that DIVA does not prevent users from creating pools with an expiry time in the past. Whitelisted data providers can but are not expected to provide any value for such pools. The time of pool creation is available in the subgraph under the `createdAt` field.

## Challenges

DIVA integrates an optional dispute/challenge mechanism which can be activated on demand (e.g., when manual oracles such as a human reporter are used). A data provider can indicate via `_allowChallenge` parameter at the time of submission whether the submitted value can be challenged or not. To avoid surprises for users, data providers can wrap the `setFinalReferenceValue` function into a separate smart contract and hard-code the `_allowChallenge` value so that pool creators already know at the time of pool creation whether a submitted value can be challenged or not.

Each position token holder of a pool can submit a challenge including a value that they deem correct. This value is not stored in the DIVA smart contract but emitted as part of the `StatusChanged` event and indexed in the subgraph. Data providers should leverage this information as part of their review process (only relevant if challenge is enabled by the data provider).

## Settlement fees

Data providers are rewarded with a settlement fee of 0.05% of the total collateral that is deposited into the pool over time (fee parameter is updateable by DIVA governance). The fee is retained within the DIVA smart contract when users withdraw collateral from the pool and can be claimed by the corresponding data provider at any point in time. The data provider can also transfer the fee claim to another recipient. This is particularly useful when the `setFinalReferenceValue` function is wrapped into a smart contract.

### Get fee claim

The claimable fee amount can be obtained by calling the following function:

```
getClaims(
    address _collateralToken,
    address _recipient
)
```

where:

- `_collateralToken` is the collateral token in which the fee was paid
- `_recipient` is the entitled data provider address

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_collateralToken",
      "type": "address"
    },
    {
      "internalType": "address",
      "name": "_recipient",
      "type": "address"
    }
  ],
  "name": "getClaims",
  "outputs": [
    {
      "internalType": "uint256",
      "name": "",
      "type": "uint256"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
```

The `_collateralToken` address can be obtained via [`getPoolParameters`](##diva-smart-contract) function or the [DIVA subgraph](##diva-subgraph).

### Claim fees

The settlement fee is paid in collateral token and can be claimed by the entitled data provider by calling the following function:

```
claimFees(address _collateralToken)
```

where `_collateralToken` is the address of the collateral token in which the fee is denominated. The collateral token address can be obtained via the [`getPoolParameters`](##diva-smart-contract) function or the [DIVA subgraph](##diva-subgraph). Note that partial claims are not possible.

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

```
transferFeeClaim(
    address _recipient,
    address _collateralToken,
    uint256 _amount
)
```

where:

- `_recipient` is the address of the new fee claim recipient
- `_collateralToken` is the address of the collateral token in which the fee is denominated
- `_amount` is the fee amount to be transferred

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_recipient",
      "type": "address"
    },
    {
      "internalType": "address",
      "name": "_collateralToken",
      "type": "address"
    },
    {
      "internalType": "uint256",
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

All fee claims are stored in the subgraph inside the `FeeRecipient` entity. Example subgraph query to get the fees claims for a given data provider address:

```json
{
	feeRecipients(where: {id: "0x9adefeb576dcf52f5220709c1b267d89d5208d78"}) {
    id
    collateralTokens {
      amount
      collateralToken {
        id
        name
        symbol
      }
    }
  }
}
```

IMPORTANT: the `id` in the `where` condition represents the address of the fee recipient and needs to be in lower case without any capital letters.

## Whitelist queries

To protect users from malicious pools, DIVA token holders maintain a whitelist of trusted data providers along with the data feeds that they can provide. Users will be able to reference those at pool creation. Data providers and data feeds are added to the whitelist through a DIVA governance vote following a thorough due diligence process.

In addition to data providers and data feeds, the whitelist contract also stores collateral tokens. Whitelisted data providers are expected to report values for pools where whitelisted collateral tokens are used. For pools with non-whitelisted collateral tokens, data providers are not expected to submit any values. This is to prevent that data providers are abused and paid in worthless tokens.

DIVA whitelist smart contract addresses (same address across networks):

- Ropsten: 0x2A5c18f001719f4663ab8d3E65E3E54182376B20
- Rinkeby: 0x2A5c18f001719f4663ab8d3E65E3E54182376B20
- Kovan: 0x2A5c18f001719f4663ab8d3E65E3E54182376B20
- Mumbai: 0x2A5c18f001719f4663ab8d3E65E3E54182376B20
- Polygon: n/a
- Mainnet: n/a

### Whitelist smart contract

The following getter functions can be called to retrieve whitelist information from the whitelist smart contract.

Function to get the data provider name and whitelist status:

```
getDataProvider(address _address)
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

This function returns the following `DataProvider` struct:

```
struct DataProvider {
    string name;            // Name of data provider
    bool publicTrigger;     // 1 if anyone can trigger the oracle to submit the final value, 0 if only the owner of the address can do it
}
```

Function to return the data feeds for a given data provider:

```
getDataFeeds(address _address)
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

```
struct DataFeed {
    string referenceAsset;              // Name of the data feed provided by the data provider
    string referenceAssetUnified;       // Unified name for referenceAsset to account for different labels used for the same asset (e.g., XBT/USD, BTC-USD, BTCUSD)
    uint8 roundingDecimals;             // The rounding precision that this data feed offers
    string dataSourceLink;              // Link to the data source description
    bool active;                        // Flag indicating whether the data feed is active or not
}
```

Function to return the data feed at a given index for a given data provider:

```
getDataFeed(address _address, uint256 _index)
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

```
getCollateralToken(address _collateralToken)
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

- Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-ropsten
- Rinkeby: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-rinkeby
- Kovan: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-kovan
- Mumbai: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-mumbai
- Polygon: n/a
- Mainnet: n/a

## DIVA protocol addresses

- Ropsten: 0x07F0293a07703c583F4Fb4ce3aC64043732eF3bf
- Rinkeby: 0xa1fa77354D7810A6355583b566E5adB29C3f7733
- Kovan: 0x607228ebB95aa097648Fa8b24dF8807684BBF101
- Mumbai: 0xf2Ea8e23E1EaA2e5D280cE6b397934Ba7f30EF6B
- Polygon: n/a
- Mainnet: n/a


