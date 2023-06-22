/**
 * Script to set the final reference value for an already expired pool. 
 * Run: `yarn divaTellor:setFinalReferenceValue --network mumbai`
 * 
 * Example usage (append corresponding network):
 * 1. `yarn diva::createContingentPool`: Create pool with a short expiration and
 *    the Tellor adapter contract address as the data provider.
 * 2. `yarn tellor:submitValue`: Submit value to Tellor contract.
 * 3. Wait for `minPeriodUndisputed` (check via `yarn divaTellor:getMinPeriodUndisputed`)
 *    following pool expiration.
 * 4. `yarn diva:getPoolParameters`: Check the pool status before reporting.
 * 5. `yarn divaTellor:setFinalReferenceValue`: Push value from Tellor contract to DIVA
 *    contract.
 * 6. `yarn diva:getPoolParameters`: Check the updated pool status.
 */

const { ethers } = require("hardhat");
const { formatUnits } = require("@ethersproject/units");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const {
  STATUS,
  DIVA_ADDRESS,
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS,
} = require("../../utils/constants");

async function main() {
  // ************************************
  //           INPUT ARGUMENTS
  // ************************************

  // Id of an existing pool
  const poolId = "0x2610b8617991b12848a9dda7b9efd0ac2cc3ceacda5a055d7ebbe8ca4f0e5b26";


  // ************************************
  //              EXECUTION
  // ************************************

  // Get DIVA Tellor oracle address
  const divaOracleTellorAddress = DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];

  // Get DIVA Protocol address
  const divaAddress = DIVA_ADDRESS[network.name];

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Connect to Tellor adapter contract
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
  console.log("Tellor adapter address: " + divaOracleTellor.address);
  console.log("PoolId: ", poolId);
  console.log(
    "Final reference value: ",
    formatUnits(finalReferenceValueSetEvent.args.finalValue.toString())
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
