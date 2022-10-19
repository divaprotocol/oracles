/**
 * Script to get the pool parameters for an existing poolId in DIVA Protocol.
 * Run: `yarn diva:getPoolParameters`
 */

const { ethers } = require("hardhat");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const { addresses } = require("../../utils/constants");

async function main() {
  // Set network (check constants.js for available values), id of an existing pool
  const network = "goerli";

  // INPUT: id of existing pool
  const poolId = 1;

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, addresses[network]);
  console.log("DIVA address: ", diva.address);

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);
  console.log(poolParams);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
