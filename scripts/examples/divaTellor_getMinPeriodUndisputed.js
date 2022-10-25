/**
 * Script to get the minimum period a reported value needs to remain undisputed
 * before considered valid. This is a parameter inside DIVAOracleTellor that is set
 * at contract deployment.
 * Run `yarn divaTellor:getMinPeriodUndisputed`
 */

const { ethers } = require("hardhat");

const { divaTellorOracleAddresses } = require("../../utils/constants");

async function main() {
  // INPUT: network
  const network = "goerli";

  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Get current minPeriodUndisputed
  const minPeriodUndisputed = await divaOracleTellor.getMinPeriodUndisputed();

  // Log relevant information
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);
  console.log("current minPeriodUndisputed: ", minPeriodUndisputed);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
