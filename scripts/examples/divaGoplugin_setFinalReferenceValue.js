/**
 * Script to set the final reference value. Run this script after around 10
 * seconds from request final reference value.
 * Run `yarn divaGoplugin:setFinalReferenceValue`
 */

const { ethers, network } = require("hardhat");

const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  STATUS,
  DIVA_ADDRESS,
  DIVA_GOPLUGIN_ADDRESS,
} = require("../../utils/constants");

async function main() {
  // INPUT: id of existing pool
  const poolId = 8;

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(
    DIVA_ABI,
    DIVA_ADDRESS[network.name]
  );

  // Connect to DIVAGoplugin contract
  const divaGoplugin = await ethers.getContractAt(
    "DIVAGoplugin",
    DIVA_GOPLUGIN_ADDRESS[network.name]
  );

  // Check that the final reference value is already requested or not
  if ((await divaGoplugin.getLastRequestedTimestamp(poolId)).eq(0)) {
    throw new Error("Final reference value is not requested yet.");
  }

  // Check that the final reference value is already submitted or not
  const finalReferenceValue = await divaGoplugin.getGoPluginValue(poolId);
  if (finalReferenceValue.eq(0)) {
    throw new Error("Final reference value is not submitted yet.");
  }

  // Set final reference value
  const tx = await divaGoplugin.setFinalReferenceValue(poolId);
  await tx.wait();

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);

  // Log relevant information
  console.log("DIVA address: ", diva.address);
  console.log("DIVAGoplugin address: " + divaGoplugin.address);
  console.log("PoolId: ", poolId);
  console.log("Final reference value: ", finalReferenceValue);
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
