# Tellor adapter for DIVA Protocol v1 - Documentation

This documentation outlines the functionality of the Tellor adapter for DIVA Protocol v1.

## Table of contents

1.  [System overview](#system-overview)
2.  [Function overview](#function-overview)


# System overview

Derivative contracts (also referred to as "contingent pools" or simply "pools") created on DIVA Protocol require one data input following expiration. The Tellor adapter offers users of DIVA Protocol a decentralized oracle solution for outcome reporting. 

The key benefits of using the Tellor integration are highlighted below: 
* No single point of failure as anyone can report the outcome in a permissionless way
* Disputes do not interrupt the reporting process meaning that reporters can continue to report values without the need for an additional request
* The Tellor adapter offers the possibility to add tips to incentivize reporting

Those advantages give users a high confidence that pools will settle correctly. Refer to the [risks](#risks) section to understand the risks involved.

## How it works

1. **Pool creation:** A user creates a contingent pool on DIVA Protocol and sets the Tellor adapter contract address as the data provider. The creation of a pool constitutes a request to the assigned data provider to report the outcome of the underlying event/metric at a future point in time.
2. **Monitoring:** Tellor reporters are monitoring expired pools that require reporting by running special software (so-called "DIVA Tellor clients"). There are two implementations available, one developed by the [DIVA team](https://github.com/divaprotocol/diva-monorepo/tree/main/packages/diva-oracle) and one by the [Tellor team](https://github.com/tellor-io/telliot-feeds). If you plan to build your own reporter software, check out the [README](https://github.com/divaprotocol/oracles/blob/main/README.md) for guidance.
3. **Reporting to Tellor Protocol:** If a pool expired, reporters submit their values to the Tellor smart contract. Only values that are submitted during the submission period, which starts at the time of pool expiration and lasts for 7 days (subject to change), are considered valid submissions.
4. **Reporting to DIVA Protocol:** The first value submitted to the Tellor Protocol that remains undisputed for more than 12h will be considered the final one and is submitted to DIVA Protocol by calling the `setFinalReferenceValue` function on the Tellor adapter contract. This will set the status of the final reference value to "Confirmed" and determine the payouts for each counterparty involved in the derivative contract. No further submissions to DIVA Protocol are possible afterwards.

**Comments:**
* Values submitted to Tellor Protocol prior to pool expiration or for pools that have already been confirmed will be ignored. To save gas, it is recommended to check the timestamps of the Tellor submissions and the status of the final reference value prior to calling the `setFinalReferenceValue` function on the Tellor adapter contract. 
* Values submitted to the Tellor Protocol may be disputed. Refer to [Tellor disputes](#tellor-disputes) section for details.

## Reporting frequency
Tellor reporters are required to stake 100 TRB (also referred to as 1 stake) to be able to report one value every 12 hours. 2 stakes allow to report one value every 6 hours, etc.

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

## Supported data feeds
The Tellor client implementations for DIVA Protocol support any data feed. BTC/USD and ETH/USD prices are pulled automatically. Any other data would have to be submitted manually by the provided scripts.

## Tellor Disputes
* Disputed values will be disregarded and are handled in a separate process managed by Tellor.


## DIVA Disputes
The Tellor adapter deactivates the possibility to challenge within DIVA Protocol as the Tellor system comes with an embedded dispute mechanism. That is, the value that is reported to DIVA Protocol via the Tellor adapter is considered the final one.

# Risks

| Risks        | Mitigants                                                                                                                                 |
| :---------------- |:---------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
|No value is reported. This may be the case if the costs of reporting exceed the expected fee reward or if the data point is simply not publicly accessible. |Add tips or report yourself |
|Inaccurate value submitted to Tellor Protocol may remain undisputed for more than 12h and pushed into DIVA Protocol resulting in inaccurate payouts. | Choose underlyings that are monitored and reported by many reporters. |
|Bug in Tellor adapter contract| Both the Tellor Protocol as well as the Tellor adapter contract have been audited to reduce the likelihood of bugs.|