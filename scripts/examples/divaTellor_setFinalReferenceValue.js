/**
 * Script to set the final reference value. Run this script after a value has been
 * submitted to the Tellor contract and the minPeriodUndisputed has passed.
 * Run `yarn divaTellor:setFinalReferenceValue`
 */

const { ethers } = require("hardhat");

const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  status,
  addresses,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

async function main() {
  // INPUT: network
  const network = "goerli";

  const divaOracleTellorAddress = divaTellorOracleAddresses[network];
  const divaAddress = addresses[network];

  // INPUT: id of existing pool
  const poolId = 4;

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Set final reference value
  const tx = await divaOracleTellor.setFinalReferenceValue(divaAddress, poolId);
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
    status[finalReferenceValueSetEvent.finalValue]
  );
  console.log("Data provider: ", poolParams.dataProvider);
  console.log(
    "StatusFinalReferenceValue: ",
    status[poolParams.statusFinalReferenceValue]
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
