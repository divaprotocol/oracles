/**
 * Script to set the final reference value for an already expired pool. 
 * Run this script after a value has been submitted to the Tellor contract
 * and the minPeriodUndisputed has passed.
 * Run `yarn divaTellor:setFinalReferenceValue --network mumbai`
 * 
 * Example usage (append corresponding network):
 * 1. `yarn diva::createContingentPool`: Create pool with a short expiration and
 *    the Tellor adapter contract address as the data provider.
 * 2. `yarn tellor:submitValue`: Submit value to Tellor contract.
 */

const { ethers } = require("hardhat");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const {
  STATUS,
  DIVA_ADDRESS,
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS,
} = require("../../utils/constants");

async function main() {
  // INPUT: id of existing pool
  const poolId = "0x93604d7bfeeb6a5a36aad8bd8a037ba6e9c72c8b53af919a0b01a8537394626e";

  // Get DIVA Tellor oracle address
  const divaOracleTellorAddress = DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];

  // Get DIVA Protocol address
  const divaAddress = DIVA_ADDRESS[network.name];

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Set final reference value
  const tx = await divaOracleTellor.setFinalReferenceValue(poolId, [], false);
  const receipt = await tx.wait();

  // Get newly created pool Id from event
  const finalReferenceValueSetEvent = receipt.events.find(
    (item) => item.event === "FinalReferenceValueSet"
  );

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);

  // Log relevant information
  console.log("DIVA address: ", diva.address);
  console.log("DIVAOracleTellor address: " + divaOracleTellor.address);
  console.log("PoolId: ", poolId);
  console.log(
    "Final reference value: ",
    finalReferenceValueSetEvent.args.finalValue.toString()
  );
  console.log("Data provider: ", poolParams.dataProvider);
  console.log(
    "StatusFinalReferenceValue: ",
    STATUS[poolParams.statusFinalReferenceValue]
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
