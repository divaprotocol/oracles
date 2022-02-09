# Last updated
9 February 2022

# How to get started

Scripts:
1. `yarn install` to install dependencies
1. `yarn compile` to compile contracts
2. `yarn hardhat test` to run tests (includes compilation of contracts)
3. `yarn hardhat test test/DIVAOracleTellor.test.js` to run the tests in `test/DIVAOracleTellor.test.js`

# Upcoming changes
* `expiryDate` will be renamed to `expiryTime`

# Settlement process in DIVA
Refer to our [gitbook](https://app.gitbook.com/s/HZJ0AbZj1fc1i5a58eEE/oracles/oracles-in-diva) to learn about oracles and the settlement process in DIVA.

# DIVA Queries
Pool parameters are stored at the time of pool creation and can be queried in the following two ways:
1. DIVA smart contract via the `getPoolParameters` function 
1. DIVA subgraph

The specifications for both ways are provided below.

### DIVA Smart contract
To query pool parameters from the smart contract, call the following function using the `poolId` (incremental unsigned integer) as argument:
```s
`getPoolParameters(poolId)`
```

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

struct Pool {
    string referenceAsset;                      // Reference asset string (e.g., "BTC/USD", "ETH Gas Price (Wei)", "TVL Locked in DeFi", etc.)
    uint256 inflection;                         // Threshold for rebalancing between the long and the short side of the pool
    uint256 cap;                                // Reference asset value at or above which all collateral will end up in the long pool
    uint256 floor;                              // Reference asset value at or below which all collateral will end up in the short pool 
    uint256 supplyShortInitial;                 // Short token supply at pool creation
    uint256 supplyLongInitial;                  // Long token supply at pool creation
    uint256 supplyShort;                        // Current short token supply
    uint256 supplyLong;                         // Current long token supply
    uint256 expiryDate;                         // Expiration time of the pool expressed as a unix timestamp in seconds
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

Example response:
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

Relevant parameters for data providers include:
* `referenceAsset`
* `expiryDate` 
* `dataFeedProvider` 
* `statusFinalReferenceValue`

Once the value was submitted by the `dataFeedProvider`, the following two fields will be updated:
* `finalReferenceValue`: set equal to the submitted value 
* `statusFinalReferenceValue`: set to `1` = Submitted, `2` = Challenged, or `3` = Confirmed, depending on whether the [dispute mechanism](#optional-dispute-mechanism) was activated or not. If the dispute mechanism was deactivated (e.g., in case of automated oracles like Tellor or Chainlink or custom oracle smart contracts that implement their own dispute mechanism), the first submitted value will set the status to "Confirmed" and users can start redeeming their position tokens. 

Other important notes:
* As Solidity cannot handle floating numbers, the final reference value should be submitted as an integer with 18 decimals (e.g., 18500000000000000000 for 18.5).  
* A data provider cannot submit a second value when the status switches to "Submitted".
* Data providers are expected to provide values only for pools where they were assigned as the data provider.  

The following two parameters specify the range that the pool is tracking and can be helpful when implementing sanity checks on the oracle side:
|Parameter|Description|
|:---|:---|
| `floor` | The lower bound of the range that the reference asset is tracking. A final reference asset value that is equal to or smaller than the floor will result in a zero payoff for the long side and maximum payoff for the short side.|
| `cap` | The upper bound of the range that the reference asset is tracking. A final reference asset value that is equal to or larger than the cap will result in a zero payoff for the short side and maximum payoff for the long side.|

#### Optional dispute mechanism
The `dataFeedProvider` indicates at the time of the submission whether a challenge is allowed or not by setting the `_allowChallenge` in `setFinalReferenceValue` . If the `dataFeedProvider` is a smart contract, this flag can be pre-set for everyone to see before the pool is created avoiding any surprises. 

### DIVA pool subgraph 
Includes all information that is returned from the `getPoolParameters` function.
* Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-ropsten
* Rinkeby: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-rinkeby
* Kovan: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-kovan
* Mumbai: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-mumbai
* Polygon: n/a
* Mainnet: n/a

## DIVA whitelist subgraph
Whitelist of data providers and data feeds. Users are presented the list of whitelisted data providers and data feeds during the pool creation process in the app. Data providers and data feeds are added to the whitelist through a DIVA governance vote following a thorough due diligence process. 
* Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-ropsten
* Rinkeby: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-rinkeby
* Kovan: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-kovan
* Mumbai: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-mumbai
* Polygon: n/a
* Mainnet: n/a

The DIVA subgraph includes two fields that refer to the reference asset: 
1. referenceAsset
2. referenceAssetUnified

Latter is used to consolidate different labels for the same asset (e.g., XBT/USD, BTC-USD) into one unified label (e.g., BTC/USD).

## DIVA addresses
* DIVA protocol:
   * Ropsten: 0x6455A2Ae3c828c4B505b9217b51161f6976bE7cf
   * Rinkeby: 0x5EB926AdbE39029be962acD8D27130073C50A0e5
   * Kovan: 0xa8450f6cDbC80a07Eb593E514b9Bd5503c3812Ba
   * Mumbai: 0xCDc415B8DEA4d348ccCa42Aa178611F1dbCD2f69 
   * Polygon: n/a 
   * Mainnet: n/a
* DIVA whitelist:
   * Ropsten: 0x50D327C638B09d0A434185d63E7193060E6271B2
   * Rinkeby: 0xF1a36B324AB5d549824a805ccd04Fa4d2e598E6b
   * Kovan: 0xe3343218CAa73AE523D40936D64E7f335AfDe8f9
   * Mumbai: 0xcA65fcD37fA8BA5f79f5CB3E68F4fCD426ccE5ef 
   * Polygon: n/a
   * Mainnet: n/a
