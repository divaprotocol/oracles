# Arbor adapter for DIVA Protocol

## What is Arbor Protocol?
[Arbor protocol](https://docs.arbor.garden/) allows DAOs and other on-chain entities to borrow stablecoins using their tokens as collateral with fixed rates and no liquidations. 

## Using Arbor in DIVA Protocol
DIVA Protocol can be used to create derivative products using the repayment amount as the underlying event. Users may want to create those products for the following two reasons: 
* **Hedging:** While the loans are collateralized by the DAOs native token, it is reasonable to assume that a failure to repay a loan will negatively impact the the collateral token in stablecoin terms. To protect against this risk, lenders may set up credit default protection products that will compensate them if the borrowed amount is not fully repaid. 
* **Market access:** The minimum lending amount may be too high for some market participants ($100k for the Ribbon bond). Market participants may create derivative products on existing loans to still participate.  

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