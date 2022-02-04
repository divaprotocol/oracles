# How to get started

Scripts:
1. `yarn install` to install dependencies
1. `yarn compile` to compile contracts
2. `yarn hardhat test` to run tests (includes compilation of contracts)
3. `yarn hardhat test test/DIVAOracleTellor.test.js` to run the tests in `DIVAOracleTellor.test.js` within the `test` folder


# DIVA Queries
Pool parameters including expiration time and reference asset are stored at the time of pool creation and can be queried by calling a smart contract function or via the DIVA subgraph. 

### DIVA Smart contract
Function with `poolId` as argument:
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

Parameters relevant for reporters are listed below:

|Parameter|Description|
|:---|:---|
| `referenceAsset` | Reference asset of the underlying pool (e.g., "ETH/USD", "BTC/USD", "ETH Gas Price (Wei)", "TVL locked in DeFi", etc.). |
| `expiryDate` | Expiration time of the pool expressed as a unix timestamp in seconds. |
| `dataFeedProvider` | Address that is supposed to report the final value of the reference asset.| 

Note that oracles are expected to provide values only for pools where they are selected as the data provider. 

The following two parameters specify the range that the pool is tracking and can be helpful when implementing sanity checks on the oracle side:
|Parameter|Description|
|:---|:---|
| `floor` | The lower bound of the range that the reference asset is tracking. A final reference asset value that is equal to or smaller than the floor will result in a zero payoff for the long side and maximum payoff for the short side.|
| `cap` | The upper bound of the range that the reference asset is tracking. A final reference asset value that is equal to or larger than the cap will result in a zero payoff for the short side and maximum payoff for the long side.|

### DIVA pool subgraph 
Includes all information that is returned from the `getPoolParameters` function.
Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-ropsten
Rinkeby: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-rinkeby
Kovan: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-kovan
Mumbai: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-mumbai
Polygon: n/a
Mainnet: n/a

## DIVA whitelist subgraph
Whitelist of data providers and data feeds. Users are presented the list of whitelisted data providers and data feeds during the pool creation process in the app. Data providers and data feeds are added to the whitelist through a DIVA governance vote following a thorough due diligence process. 
Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-ropsten
Rinkeby: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-rinkeby
Kovan: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-kovan
Mumbai: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-mumbai
Polygon: n/a
Mainnet: n/a

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
