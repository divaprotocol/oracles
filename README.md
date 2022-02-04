# Basic Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
node scripts/sample-script.js
npx hardhat help
```





## DIVA Queries
Pool parameters including expiration time and reference asset are stored at the time of pool creation and can be queried in two ways:

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

Parameters relevant for reports are listed below:

|Parameter|Description|
|:---|:---|
| `referenceAsset` | Reference asset of the underlying pool (e.g., "ETH/USD", "BTC/USD", "ETH Gas Price (Wei)", "TVL locked in DeFi"). |
| `expiryDate` | Expiration time of the pool expressed as a unix timestamp in seconds. |
| `dataFeedProvider` | Address of the Ethereum account that is supposed to report the final value of the reference asset| 

Note that Tellor reporters are expected to provide values only for pools where the Tellor oracle contract is specified as the data feed provider. Refer to the [address section](#tellor-oracle-address) for the corresponding address.

The following two parameters specify the range that the pool is tracking and can be helpful when implementing sanity checks on the reporter side:
|Parameter|Description|
|:---|:---|
| `floor` | The lower bound of the range that the reference asset is tracking. A final reference asset value that is equal to or smaller than the floor will result in a zero payoff for the long side and maximum payoff for the short side|
| `cap` | The upper bound of the range that the reference asset is tracking. A final reference asset value that is equal to or larger than the cap will result in a zero payoff for the short side and maximum payoff for the long side|

### DIVA pool subgraph 
Contains the same parameters as those returned by the `getPoolParameters` functions.
Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-ropsten
Polygon: n/a

## DIVA whitelist subgraph
Whitelist of data providers and their corresponding data feeds. Tellor oracle contract address will be included in DIVA's whitelist and selecteable in DIVA's pool creation process. Tellor data feeds will be added by DIVA governance after thorough due diligence. Refer to the following subgraph to see which data feeds are listed for Tellor oracle: 
Ropsten: https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-whitelist-ropsten
Polygon: n/a

## Tellor oracle address
Proxy contract that pulls the price from Tellor and submits it to DIVA. Can be triggered by anyone following pool expiration.  
Ropsten: n/a
Polygon: n/a

## DIVA addresses
* DIVA protocol:
   * Ropsten: 0x6455A2Ae3c828c4B505b9217b51161f6976bE7cf
   * Polygon: n/a 
* DIVA whitelist:
   * Ropsten: 0x50D327C638B09d0A434185d63E7193060E6271B2
   * Polygon: n/a
