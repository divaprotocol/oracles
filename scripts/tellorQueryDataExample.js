const { ethers } = require("hardhat");

const { addresses } = require("../utils/constants");

async function main() {
  // Get DIVA address
  const network = "ropsten";
  const divaAddress = addresses[network];

  // Load ABI code from ethers library
  const abiCoder = new ethers.utils.AbiCoder();

  // Generate queryId for Tellor submission
  const latestPoolId = 1;
  const queryDataArgs = abiCoder.encode(
    ["uint256", "address"],
    [latestPoolId, divaAddress]
  );
  const queryData = abiCoder.encode(
    ["string", "bytes"],
    ["DIVAProtocolPolygon", queryDataArgs]
  );
  const queryId = ethers.utils.keccak256(queryData);

  // Print values
  console.log("divaAddress: ", divaAddress);
  console.log("latestPoolId: ", latestPoolId);
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
