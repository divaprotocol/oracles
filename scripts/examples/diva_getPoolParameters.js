/**
 * Script to get the pool parameters for an existing poolId in DIVA Protocol.
 * Run: `yarn diva:getPoolParameters`
 */

const { ethers } = require("hardhat");

const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const { addresses } = require("../../utils/constants");

// TODO Align with the script in diva-contracts repo

async function main() {
  // INPUT: network (check constants.js for available values)
  const network = "goerli";

  // INPUT: id of existing pool
  const poolId = 1;
  console.log("Pool id: ", poolId);

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
