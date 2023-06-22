/**
 * Script to get the minimum period a reported value needs to remain undisputed
 * before considered valid. This is a parameter inside Tellor adapter contract that is set
 * at contract deployment.
 * Run: `yarn divaTellor:getMinPeriodUndisputed --network mumbai`
 */

const { ethers } = require("hardhat");
const { DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS } = require("../../utils/constants");

async function main() {
  // Get DIVA Tellor oracle address
  const divaOracleTellorAddress = DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];

  // Connect to Tellor adapter contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Get current minPeriodUndisputed
  const minPeriodUndisputed = await divaOracleTellor.getMinPeriodUndisputed();

  // Log relevant information
  console.log("Tellor adapter address: ", divaOracleTellor.address);
  console.log("current minPeriodUndisputed: ", minPeriodUndisputed);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
