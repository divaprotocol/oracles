/**
 * Script to get queryId for a given poolId, DIVA address and chain number. The
 * latter is inferred by the specified network.
 * Run `yarn divaTellor:getQueryId`
 */
const { ethers } = require("hardhat");

const {
  DIVA_ADDRESS,
  DIVA_TELLOR_ORACLE_ADDRESS,
} = require("../../utils/constants");

async function main() {
  // INPUT: network
  const network = "goerli";

  // INPUT: id of pool
  const poolId = 1150;

  // Get chain id
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const divaAddress = DIVA_ADDRESS[network];

  const divaOracleTellorAddress = DIVA_TELLOR_ORACLE_ADDRESS[network];

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Get current queryId
  const queryId = await divaOracleTellor.getQueryId(poolId, divaAddress);

  // Log relevant information
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);
  console.log("PoolId: ", poolId);
  console.log("DIVA address: ", divaAddress);
  console.log("ChainId: ", chainId);
  console.log("queryId: ", queryId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
