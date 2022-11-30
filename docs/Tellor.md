### Notes

Note that nothing prevents you from submitting a value to Tellor protocol. Before submitting a value to Tellor protocol, check whether the corresponding pool is already confirmed.
Also, please note that values submitted prior to pool expiry time will be considered invalid.


# Tellor adapter for DIVA Protocol - Documentation

This documentation outlines the functionality of the Tellor adapter for DIVA Protocol.

## Table of contents

1.  [System overview](#system-overview)
2.  [Function overview](#function-overview)


# System overview

The Tellor adapter offers a way to receive data inputs in a fully decentralized manner.

## How it works

* A user creates a contingent pool on DIVA Protocol and sets the [Tellor adapter contract](#relevant-addresses) as the data provider. The creation of a pool constitutes a request to the assigned data provider to report the outcome of the corresponding underlying event/metric at a future point in time.
* Tellor reporters are running their software to monitor DIVA Protocol for expired pools. If you want to create a reporter yourself, take a look [here](https://github.com/divaprotocol/oracles/blob/main/README.md). If you want to run an existing reporting software, check out the [DIVA team's Tellor client implementation](https://github.com/divaprotocol/diva-monorepo/tree/main/packages/diva-oracle) or the [Tellor team's one](https://github.com/tellor-io/telliot-feeds).
* If a pool 
* The first value that remains undisputed for more than 12h will be considered the final value. The value is pushed into DIVA Protocol by calling the `setFinalReferenceValue` function on the Tellor adapter contract.


## Notes for reporters
* Values submitted prior to pool expiration will be considered invalid.
* Nothing prevents reports to submit values to the Tellor protocol for expired and already reported (also referred to as "Confirmed") pools. It is recommended to check whether a pool is confirmed (`statusFinalReferenceValue = "Confirmed"`) before submitting a value.
* Disputed values will be disregarded and are handled in a separate process managed by Tellor

## Fees
Reporters receive 
* Settlement fee: 0.05% of the `collateralBalanceGross` (field available in the subgraph)
* Tips

Notes:
* The maximum fee for  $10 to reporter. The remainder goes to the Tellor treasury. This logic was implemented to prevent "dispute wars" to receive the reward
* To calculate the split, the reporters are also submitted the USD value of the collateral token. 


## Relevant addresses

Relevant addresses on Goerli:
| Name        |                                                                                                                                 |
| :---------------- |:---------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| Tellor adapter contract|`0x9959f7f8eFa6B77069e817c1Af97094A9CC830FD`         | Contract that connects the Tellor system with DIVA Protocol. To be used as the data provider address when creating a pool                                              |
|TRB token|`0x51c59c6cAd28ce3693977F2feB4CfAebec30d8a2`| Token that needs to be staked in order to be able to report values to the Tellor system. One stake corresponds to 100 TRB allows and allows to report one value every 12 hours.  |
|Tellor system|`0xB3B662644F8d3138df63D2F43068ea621e2981f9`|Tellor contract where values are reported to and TRB staked.|
|Tellor governance contract|`0x02803dcFD7Cb32E97320CFe7449BFb45b6C931b8`|Implements the `beginDispute` function to initiate a dispute.|
|DIVA smart contract|`0x659f8bF63Dce2548eB4D9b4BfF6883dddFde4848`|The DIVA smart contract address that the Tellor adapter contract points to. Selecting the Tellor adapter contract as the oracle for any other version of the DIVA smart contract will result in failure to report.|
|DIVA subgraph|https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new-2|Subgraph containing all pool related information.|

Note that depositing a stake or or disputing a value requires prior approval for the TRB token for the corresponding contract to transfer the token.

## Tellor Disputes


## DIVA Disputes
The Tellor adapter deactivates the possibility to challenge within DIVA Protocol as the Tellor system comes with an embedded dispute mechanism. That is, the value that is reported to DIVA Protocol via the Tellor adapter is considered the final one.
