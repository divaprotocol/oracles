/**
 * Script to get queryId for a given poolId, DIVA address and chain number. The
 * latter is inferred by the specified network.
 * Run `yarn divaTellor:getQueryDataAndId`
 */
const { ethers, network } = require("hardhat");
const { getQueryDataAndId } = require("../../utils/utils");
const {
  DIVA_ADDRESS,
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS,
} = require("../../utils/constants");

async function main() {
  // INPUT: id of pool
  const poolId = "0xa7c27b6ba28c8b173c64ad0f2edc56da840740cec684c7a72e51a7d71d86a496";

  // Get chain id
  const chainId = (await ethers.provider.getNetwork()).chainId;

  // Get DIVA Tellor oracle address
  const divaOracleTellorAddress = DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];

  // Get DIVA Protocol address
  const divaAddress = DIVA_ADDRESS[network.name];

  // Get current queryData and queryId
  const [queryData, queryId] = getQueryDataAndId(poolId, divaAddress, chainId);

  // Log relevant information
  console.log("DIVAOracleTellor address: ", divaOracleTellorAddress);
  console.log("DIVA address: ", divaAddress);
  console.log("PoolId: ", poolId);
  console.log("Network name: ", network.name)
  console.log("ChainId: ", chainId);
  console.log("queryData: ", queryData);
  console.log("queryId: ", queryId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
