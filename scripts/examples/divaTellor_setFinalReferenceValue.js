/**
 * Script to set the final reference value. Run this script after a value has been
 * submitted to the Tellor contract and the minPeriodUndisputed has passed.
 * Run `yarn divaTellor:setFinalReferenceValue`
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
  const poolId = "0xa7c27b6ba28c8b173c64ad0f2edc56da840740cec684c7a72e51a7d71d86a496";

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
