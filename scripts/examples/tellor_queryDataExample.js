/**
 * Script to get the queryId and queryData which is needed for Tellor's submitValue function.
 * Run `yarn tellor:queryDataExample`
 */

const { ethers } = require("hardhat");

const { DIVA_ADDRESS } = require("../../utils/constants");

async function main() {
  // INPUT: network
  const network = "goerli";

  // INPUT: id of pool
  const poolId = 1;

  // Get chain id
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const divaAddress = DIVA_ADDRESS[network];

  // Load ABI code from ethers library
  const abiCoder = new ethers.utils.AbiCoder();

  // Generate queryId for Tellor submission
  const queryDataArgs = abiCoder.encode(
    ["uint256", "address", "uint256"],
    [poolId, divaAddress, chainId]
  );
  const queryData = abiCoder.encode(
    ["string", "bytes"],
    ["DIVAProtocol", queryDataArgs]
  );
  const queryId = ethers.utils.keccak256(queryData);

  // Print values
  console.log("DIVA address: ", divaAddress);
  console.log("poolId: ", poolId);
  console.log("queryDataArgs: ", queryDataArgs);
  console.log("queryData: ", queryData);
  console.log("queryId: ", queryId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
