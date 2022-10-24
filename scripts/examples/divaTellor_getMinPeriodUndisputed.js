/**
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
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);

  // Get current minPeriodUndisputed
  const minPeriodUndisputed = await divaOracleTellor.getMinPeriodUndisputed();
  console.log("current minPeriodUndisputed: ", minPeriodUndisputed);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
