# DIVA oracle data specifications

## Version overview
|Last updated on|Key changes|Updated by|
|:---|:---|:---|
|9 February 2022| Additional information added |@Walodja1987|
|_Upcoming_|_`expiryDate` will be renamed to `expiryTime`, `createdAt` will be added to subgraph_||

# How to get started
Scripts:
1. `yarn install` to install dependencies
1. `yarn compile` to compile contracts
2. `yarn hardhat test` to run tests (includes compilation of contracts)
3. `yarn hardhat test test/DIVAOracleTellor.test.js` to run the tests in `test/DIVAOracleTellor.test.js`

If you have `node` version 17 or higher installed, you may need to downgrade it to 16.13.0, for instance, to make it work. 
1. `node --version` to check the node version
2. `nvm use 16.13.0` to downgrade the node version

If you don't have `nvm` installed yet, check out their [repo](https://github.com/nvm-sh/nvm).

# Intro
Contingent pools created on DIVA expect one value input following pool expiration. This document describes how data providers can access the relevant data and interact with the protocol.

Refer to our [gitbook](https://app.gitbook.com/s/HZJ0AbZj1fc1i5a58eEE/oracles/oracles-in-diva) for more details about oracles and the settlement process in DIVA.

# DIVA queries
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
      { "internalType": "uint256", 
      "name": "_poolId", 
      "type": "uint256" 
      }
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
            "name": "inflection",
            "type": "uint256"
          },
          { "internalType": "uint256", 
            "name": "cap", 
            "type": "uint256" 
          },
          { "internalType": "uint256", 
            "name": "floor", 
            "type": "uint256" 
          },
          {
            "internalType": "uint256",
            "name": "supplyShortInitial",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "supplyLongInitial",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "supplyShort",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "supplyLong",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "expiryDate",
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
            "name": "collateralBalanceShort",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "collateralBalanceLong",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "shortToken",
            "type": "address"
          },
          { "internalType": "address", 
            "name": "longToken", 
            "type": "address" 
          },
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
            "name": "dataFeedProvider",
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
          { "internalType": "uint256", 
            "name": "capacity", 
            "type": "uint256" 
          }
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
    uint256 inflection;                         // Threshold for rebalancing between the long and the short side of the pool
    uint256 cap;                                // Reference asset value at or above which all collateral will end up in the long pool
    uint256 floor;                              // Reference asset value at or below which all collateral will end up in the short pool 
    uint256 supplyShortInitial;                 // Short token supply at pool creation
    uint256 supplyLongInitial;                  // Long token supply at pool creation
    uint256 supplyShort;                        // Current short token supply
    uint256 supplyLong;                         // Current long token supply
    uint256 expiryDate;                         // Expiration time of the pool and as of time of final value expressed as a unix timestamp in seconds
    address collateralToken;                    // Address of ERC20 collateral token
    uint256 collateralBalanceShortInitial;      // Collateral balance of short side at pool creation
    uint256 collateralBalanceLongInitial;       // Collateral balance of long side at pool creation
    uint256 collateralBalanceShort;             // Current collateral balance of short side
    uint256 collateralBalanceLong;              // Current collateral balance of long side
    address shortToken;                         // Short position token address
    address longToken;                          // Long position token address
    uint256 finalReferenceValue;                // Reference asset value at the time of expiration
    Status statusFinalReferenceValue;           // Status of final reference price (0 = Open, 1 = Submitted, 2 = Challenged, 3 = Confirmed)
    uint256 redemptionAmountLongToken;          // Payout amount per long position token
    uint256 redemptionAmountShortToken;         // Payout amount per short position token
    uint256 statusTimestamp;                    // Timestamp of status change
    address dataFeedProvider;                   // Address of data feed provider
    uint256 redemptionFee;                      // Redemption fee prevailing at the time of pool creation
    uint256 settlementFee;                      // Settlement fee prevailing at the time of pool creation
    uint256 capacity;                           // Maximum collateral that the pool can accept; 0 for unlimited
}   
```

Example response with values:
```
    referenceAsset: 'ETH/USDT',
    inflection: BigNumber { value: "22000000000000000000" },
    cap: BigNumber { value: "27000000000000000000" },
    floor: BigNumber { value: "17000000000000000000" },
    supplyShortInitial: BigNumber { value: "105000000000000000000" },
    supplyLongInitial: BigNumber { value: "105000000000000000000" },
    supplyShort: BigNumber { value: "105000000000000000000" },
    supplyLong: BigNumber { value: "105000000000000000000" },
    expiryDate: BigNumber { value: "1642021490" },
    collateralToken: '0xaD6D458402F60fD3Bd25163575031ACDce07538D',
    collateralBalanceShortInitial: BigNumber { value: "20000000000000000" },
    collateralBalanceLongInitial: BigNumber { value: "10000000000000000" },
    collateralBalanceShort: BigNumber { value: "20000000000000000" },
    collateralBalanceLong: BigNumber { value: "10000000000000000" },
    shortToken: '0x43a9f0adaa48F4D42BdFd0A4761611a468733A3d',
    longToken: '0x0881c26507867d5020531b744D285778432c7DAc',
    finalReferenceValue: BigNumber { value: "85000000000000000000" },
    statusFinalReferenceValue: 3,
    redemptionAmountLongToken: BigNumber { value: "284857142857142" },
    redemptionAmountShortToken: BigNumber { value: "0" },
    statusTimestamp: BigNumber { value: "1642075118" },
    dataFeedProvider: '0x47566C6c8f70E4F16Aa3E7D8eED4a2bDb3f4925b',
    redemptionFee: BigNumber { value: "2500000000000000" },
    settlementFee: BigNumber { value: "500000000000000" },
    capacity: BigNumber { value: "0" }
```

### DIVA subgraph 
Pool information can also be obtained by querying the DIVA subgraph:
* Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-ropsten
* Rinkeby: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-rinkeby
* Kovan: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-kovan
* Mumbai: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-mumbai
* Polygon: n/a
* Mainnet: n/a

The DIVA subgraph has additional information that is not included in [`getPoolParameters`](#diva-smart-contract). In particular, it includes challenge specific information such as the challenger address and the value proposed by the challenger which can be useful when a data provider has enabled the challenge functionality. 

The following fields include relevant information for data providers:
* `referenceAsset`
* `expiryDate` 
* `dataFeedProvider` 
* `finalReferenceValue`
* `statusFinalReferenceValue`
* `collateralToken`
* `settlementFee`
* `collateralTokenName` (in subgraph only)
* `collateralSymbol` (in subgraph only)
* `collateralDecimals` (in subgraph only)
* `challengedBy` (in subgraph only)
* `proposedFinalReferenceValue` (in subgraph only)

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
* `_poolId` is the id of the pool that is to be settled
* `_finalReferenceValue` is an 18 decimal integer representation of the final value (e.g., 18500000000000000000 for 18.5)
* `_allowChallenge` is a true/false flag that indicates whether the submitted value can be challenged or not 

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

Once a value has been submitted, `statusFinalReferenceValue` switches from `0` (Open) to `1` (Submitted) or `3` (Confirmed) depending on whether the [dispute mechanism](#optional-dispute-mechanism) was activated or not. The data provider cannot submit a second value unless the status changes to `2` (Challenged) which is only possible when the dispute mechanism was activated. Once the value reaches Confirmed stage, the value is considered final and no changes can be made anymore.

Note that DIVA does not prevent users from creating pools with an expiry date in the past. Whitelisted data providers can but are not expected to provide any value for such pools. The time of pool creation will be made available in the subgraph in the next release.

## Challenges
DIVA integrates an optional dispute/challenge mechanism which can be activated on demand (e.g., when manual oracles such as a human reporter are used). A data provider can indicate via `_allowChallenge` parameter at the time of submission whether the submitted value can be challenged or not. To avoid surprises for users, data providers can wrap the `setFinalReferenceValue` function into a separate smart contract and hard-code the `_allowChallenge` value so that pool creators already know at the time of pool creation whether a submitted value can be challenged or not. 

Each position token holder of a pool can submit a challenge including a value that they deem correct. This value is not stored in the DIVA smart contract but emitted as part of the `StatusChanged` event and indexed in the subgraph. Data providers should leverage this information as part of their review process. 

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
* `_collateralToken` is the collateral token in which the fee was paid 
* `_recipient` is the entitled data provider address

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

The `_collateralToken` address can be obtained via [`getPoolParameters`](#diva-smart-contract) function or the [DIVA subgraph](#diva-subgraph). 

### Claim fees
The settlement fee is paid in collateral token and can be claimed by the entitled data provider by calling the following function:
```
claimFees(address _collateralToken)
```
where `_collateralToken` is the address of the collateral token in which the fee is denominated. The collateral token address can be obtained via the [`getPoolParameters`](#diva-smart-contract) function or the [DIVA subgraph](#diva-subgraph). Note that partial claims are not possible.

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
* `_recipient` is the address of the new fee claim recipient
* `_collateralToken` is the address of the collateral token in which the fee is denominated
* `_amount` is the fee amount to be transferred

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

## DIVA whitelist 
To protect users from malicious pools, DIVA token holders maintain a whitelist of trusted data providers along with the data feeds that they can provide. Users will be able to reference those at pool creation. Data providers and data feeds are added to the whitelist through a DIVA governance vote following a thorough due diligence process. 

In addition to data providers and data feeds, the whitelist contract also stores collateral tokens. Whitelisted data providers are expected to report values for pools where whitelisted collateral tokens are used. For pools with non-whitelisted collateral tokens, data providers are not expected to submit any values. This is to prevent that data providers are abused and paid in worthless tokens.  

DIVA whitelist smart contract addresses:
* Ropsten: 0x50D327C638B09d0A434185d63E7193060E6271B2
* Rinkeby: 0xF1a36B324AB5d549824a805ccd04Fa4d2e598E6b
* Kovan: 0xe3343218CAa73AE523D40936D64E7f335AfDe8f9
* Mumbai: 0xcA65fcD37fA8BA5f79f5CB3E68F4fCD426ccE5ef 
* Polygon: n/a
* Mainnet: n/a

### Whitelist getter functions
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
      "name": "_address",
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
          "name": "whitelisted",
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
    bool whitelisted;       // Flag indicating whether a given address is whitelist or not
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
          "name": "_address",
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
      "name": "_address",
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


Two fields merit additional comment: 
1. `referenceAsset` is the name provided by the data provider to be used as an identifier on their side 
2. `referenceAssetUnified` is set by DIVA governance to consolidate different labels for the same asset (e.g., XBT/USD, BTC-USD) into one unified label (e.g., BTC/USD)

### Whitelist subgraph
Whitelisted data providers, data feeds and collateral tokens can also be accessed via the whitelist subgraph.  
* Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-ropsten
* Rinkeby: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-rinkeby
* Kovan: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-kovan
* Mumbai: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-mumbai
* Polygon: n/a
* Mainnet: n/a

## DIVA protocol addresses
* Ropsten: 0x6455A2Ae3c828c4B505b9217b51161f6976bE7cf
* Rinkeby: 0x5EB926AdbE39029be962acD8D27130073C50A0e5
* Kovan: 0xa8450f6cDbC80a07Eb593E514b9Bd5503c3812Ba
* Mumbai: 0xCDc415B8DEA4d348ccCa42Aa178611F1dbCD2f69 
* Polygon: n/a 
* Mainnet: n/a
