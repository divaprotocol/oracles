/**
 * Script to get queryId for a given poolId, DIVA address and chain number. The
 * latter is inferred by the specified network.
 * Run `yarn divaTellor:getQueryId`
 */
const { ethers } = require("hardhat");

const {
  addresses,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

async function main() {
  // INPUT: network
  const network = "goerli";

  // INPUT: id of pool
  const poolId = 1150;

  const divaAddress = addresses[network];

  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Get current queryId
  const queryId = await divaOracleTellor.getQueryId(poolId, divaAddress);

  // Log relevant information
  console.log("DIVA address: ", divaAddress);
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);
  console.log("queryId: ", queryId);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
