/**
 * Run `yarn tellor:queryDataExample`
 */

const { ethers } = require("hardhat");

const { addresses } = require("../../utils/constants");

async function main() {
  // INPUT: network
  const network = "goerli";

  // INPUT: id of pool
  const poolId = 1;

  // Get chain id
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const divaAddress = addresses[network];

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
  console.log("divaAddress: ", divaAddress);
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
