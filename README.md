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

Contingent pools created on DIVA expect one value input following pool expiration. This document describes how data providers can access the relevant data and interact with the protocol.

Refer to our [gitbook](https://app.gitbook.com/s/HZJ0AbZj1fc1i5a58eEE/oracles/oracles-in-diva) (still in DRAFT) for more details about oracles and the settlement process in DIVA.

## DIVA queries

Pool parameters are stored within the DIVA smart contract at the time of pool creation and can be queried in two ways:

1. DIVA smart contract via the `getPoolParameters` function
1. DIVA subgraph

### DIVA smart contract

Pool parameters can be queried from the DIVA smart contract by calling the following function:

```s
`getPoolParameters(uint256 poolId)`
```

where `poolId` is a unique identifier (more precisely, an integer that starts at 1 and increments by 1) that is assigned to a pool at the time of creation.

ABI:

```json
{
  "inputs": [
    { "internalType": "uint256", "name": "_poolId", "type": "uint256" }
  ],
  "name": "getPoolParameters",
  "outputs": [
    {
      "components": [
        {
          "internalType": "string",
          "name": "referenceAsset",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "expiryTime",
          "type": "uint256"
        },
        { "internalType": "uint256", "name": "floor", "type": "uint256" },
        {
          "internalType": "uint256",
          "name": "inflection",
          "type": "uint256"
        },
        { "internalType": "uint256", "name": "cap", "type": "uint256" },
        {
          "internalType": "uint256",
          "name": "supplyInitial",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "collateralToken",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "collateralBalanceShortInitial",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "collateralBalanceLongInitial",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "collateralBalance",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "shortToken",
          "type": "address"
        },
        { "internalType": "address", "name": "longToken", "type": "address" },
        {
          "internalType": "uint256",
          "name": "finalReferenceValue",
          "type": "uint256"
        },
        {
          "internalType": "enum LibDiamond.Status",
          "name": "statusFinalReferenceValue",
          "type": "uint8"
        },
        {
          "internalType": "uint256",
          "name": "redemptionAmountLongToken",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "redemptionAmountShortToken",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "statusTimestamp",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "dataProvider",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "redemptionFee",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "settlementFee",
          "type": "uint256"
        },
        { "internalType": "uint256", "name": "capacity", "type": "uint256" }
      ],
      "internalType": "struct LibDiamond.Pool",
      "name": "",
      "type": "tuple"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
```

The following Pool struct is returned when `getPoolParameters` is called:

```
struct Pool {
    string referenceAsset;                      // Reference asset string (e.g., "BTC/USD", "ETH Gas Price (Wei)", "TVL Locked in DeFi", etc.)
    uint256 expiryTime;                         // Expiration time of the pool and as of time of final value expressed as a unix timestamp in seconds
    uint256 floor;                              // Reference asset value at or below which all collateral will end up in the short pool
    uint256 inflection;                         // Threshold for rebalancing between the long and the short side of the pool
    uint256 cap;                                // Reference asset value at or above which all collateral will end up in the long pool
    uint256 supplyInitial;                      // Initial short and long token supply
    address collateralToken;                    // Address of ERC20 collateral token
    uint256 collateralBalanceShortInitial;      // Collateral balance of short side at pool creation
    uint256 collateralBalanceLongInitial;       // Collateral balance of long side at pool creation
    uint256 collateralBalance;                  // Current total pool collateral balance
    address shortToken;                         // Short position token address
    address longToken;                          // Long position token address
    uint256 finalReferenceValue;                // Reference asset value at the time of expiration
    Status statusFinalReferenceValue;           // Status of final reference price (0 = Open, 1 = Submitted, 2 = Challenged, 3 = Confirmed)
    uint256 redemptionAmountLongToken;          // Payout amount per long position token
    uint256 redemptionAmountShortToken;         // Payout amount per short position token
    uint256 statusTimestamp;                    // Timestamp of status change
    address dataProvider;                       // Address of data provider
    uint256 redemptionFee;                      // Redemption fee prevailing at the time of pool creation
    uint256 settlementFee;                      // Settlement fee prevailing at the time of pool creation
    uint256 capacity;                           // Maximum collateral that the pool can accept; 0 for unlimited
}
```

Example response with values:

```
    referenceAsset: 'ETH/USDT',
    expiryTime: BigNumber { value: "1642021490" },
    floor: BigNumber { value: "17000000000000000000" },
    inflection: BigNumber { value: "22000000000000000000" },
    cap: BigNumber { value: "27000000000000000000" },
    supplyInitial: BigNumber { value: "210000000000000000000" },
    collateralToken: '0xaD6D458402F60fD3Bd25163575031ACDce07538D',
    collateralBalanceShortInitial: BigNumber { value: "20000000000000000" },
    collateralBalanceLongInitial: BigNumber { value: "10000000000000000" },
    collateralBalance: BigNumber { value: "40000000000000000" },
    shortToken: '0x43a9f0adaa48F4D42BdFd0A4761611a468733A3d',
    longToken: '0x0881c26507867d5020531b744D285778432c7DAc',
    finalReferenceValue: BigNumber { value: "85000000000000000000" },
    statusFinalReferenceValue: 3,
    redemptionAmountLongToken: BigNumber { value: "284857142857142" },
    redemptionAmountShortToken: BigNumber { value: "0" },
    statusTimestamp: BigNumber { value: "1642075118" },
    dataProvider: '0x47566C6c8f70E4F16Aa3E7D8eED4a2bDb3f4925b',
    redemptionFee: BigNumber { value: "2500000000000000" },
    settlementFee: BigNumber { value: "500000000000000" },
    capacity: BigNumber { value: "0" }
```

### DIVA subgraph

Pool information can also be obtained by querying the DIVA subgraph:

- Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-ropsten
- Rinkeby: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-rinkeby
- Kovan: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-kovan
- Mumbai: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-mumbai
- Polygon: n/a
- Mainnet: n/a

The DIVA subgraph has additional information that is not included in [`getPoolParameters`](##diva-smart-contract). In particular, it includes challenge specific information such as the challenger address and the value proposed by the challenger which can be useful when a data provider has enabled the challenge functionality.

The following fields include relevant information for data providers:

- `referenceAsset`
- `expiryTime`
- `dataProvider`
- `finalReferenceValue`
- `statusFinalReferenceValue`
- `collateralToken`
- `settlementFee`
- `collateralTokenName` (in subgraph only)
- `collateralSymbol` (in subgraph only)
- `collateralDecimals` (in subgraph only)
- `challengedBy` (in subgraph only)
- `proposedFinalReferenceValue` (in subgraph only)
- `createdAt` (in subgraph only)

Additional parameters that may be useful when implementing sanity checks on the oracle side include `floor` and `cap` which define the range that the derivative assets linked to the pool are tracking.

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

# DIVA Porter module

## How to deploy and verify the contract

### Deploy

Run `npx hardhat run --network <network> scripts/deployPorterModule.js` to deploy contract. You can see the contract address after deployment is completed.

### Verify

Run `npx hardhat verify <contract address from above> --network <network> <Porter Finance BondFactory address>` to verify the contract.

Porter Finance BondFactory addresses:

- Mainnet: 0x9f20521ef789fd2020e708390b1e6c701d8218ba
- Rinkeby: 0x0ae42cF40Fb46A926e2dcCE92b2Fe785d2D1E0A0
- Ropsten: 0x74Ef0622280dfae28F9513e9173CaFF711C47eF4
- Goerli: 0x74Ef0622280dfae28F9513e9173CaFF711C47eF4

## How to run test

Run `yarn t test/DIVAPorterModule.test.js` to run the tests in `test/DIVAPorterModule.test.test.js`

## Purpose of this DIVA Porter module

To have a trustless on-chain oracle for credit default protection products issued on DIVA Protocol.

![DIVA oracle module](https://user-images.githubusercontent.com/37043174/174320777-8b0acaab-06e1-4b35-85ef-de7a3a6dfddf.png)

DIVA Porter module includes the following features:

- Create contingent pool: Create contingent pool on DIVA protocol. `createContingentPool` function will automatically encode the reference asset, expiry time, floor, cap and data provider based on a pre-defined structure.
- Set final reference: Get the unpaid amount from Porter Finance bond contract and pass it into DIVA Protocol by calling the `setFinalReferenceValue` function.

## How to create a pool using the `createContingentPool` function inside the DIVA Porter Module

Users can create a contingent pool on DIVA protocol by calling the `createContingentPool` function inside the DIVA Porter Module

```
createContingentPool(
    address _divaDiamond,
    PorterPoolParams calldata _porterPoolParams
)
```

where:

- `_divaDiamond` is the address of the DIVA protocol
- `_porterPoolParams` is the structure of the pool parameters. `PorterPoolParams` struct is like this:

```
struct PorterPoolParams {
    address referenceAsset;
    uint256 inflection;
    uint256 gradient;
    uint256 collateralAmount;
    address collateralToken;
    uint256 capacity;
}
```

where:

- `referenceAsset` is the address of bond contract.
- `inflection` is the value of underlying at which the long token will payout out `gradient` and the short token `1-gradient`.
- `gradient` is the long token payout at inflection. The short token payout at inflection is `1-gradient`.
- `collateralAmount` is the collateral amount to be deposited into the pool to back the position tokens.
- `collateralToken` is the ERC20 collateral token address.
- `capacity` is the maximum collateral amount that the pool can accept.

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_divaDiamond",
      "type": "address"
    },
    {
      "components": [
        {
          "internalType": "address",
          "name": "referenceAsset",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "inflection",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "gradient",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "collateralAmount",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "collateralToken",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "capacity",
          "type": "uint256"
        }
      ],
      "internalType": "struct IDIVAPorterModule.PorterPoolParams",
      "name": "_porterPoolParams",
      "type": "tuple"
    }
  ],
  "name": "createContingentPool",
  "outputs": [
    {
      "internalType": "uint256",
      "name": "",
      "type": "uint256"
    }
  ],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

## How to trigger the `setFinalReferenceValue` function in DIVA Porter Module

Users can trigger the `setFinalReferenceValue` function in DIVA Porter Module by calling it after `expiryTime` has passed:

```
setFinalReferenceValue(
    address _divaDiamond,
    uint256 _poolId
)
```

where:

- `_divaDiamond` is the address of the DIVA protocol
- `_poolId` is the id of the pool that is to be settled

ABI:

```json
{
  "inputs": [
    {
      "internalType": "address",
      "name": "_divaDiamond",
      "type": "address"
    },
    {
      "internalType": "uint256",
      "name": "_poolId",
      "type": "uint256"
    }
  ],
  "name": "setFinalReferenceValue",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

## Caveats

`amountUnpaid` from Porter Finance bond contract may change even after grace period end if the borrower sends more funds. So ideally, the `setFinalReferenceValue` function should be triggered shortly following expiration to get the relevant value. A request to store the `amountUnpaid` prevailing as of grace period end has been submitted [here](https://github.com/porter-finance/v1-core/issues/324).

## Porter module addresses

- Ropsten: 0xf68F1Ec9dB1C60cf6E934eDa79D94f014Df47d53
- Goerli: 0x8059860B02DA39Cb7418352262a9F6f81b3Aaf2a
- Mainnet: n/a
