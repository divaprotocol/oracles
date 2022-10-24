/**
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
  console.log("DIVA ddress: ", divaAddress);

  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);

  // Get current queryId
  const queryId = await divaOracleTellor.getQueryId(poolId, divaAddress);
  console.log("queryId: ", queryId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
