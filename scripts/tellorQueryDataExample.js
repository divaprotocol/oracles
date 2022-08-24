const { ethers } = require("hardhat");

async function main() {

  // Load ABI code from ethers library
  abiCoder = new ethers.utils.AbiCoder
  
  // Generate queryId for Tellor submission
  const latestPoolId = 1
  queryDataArgs = abiCoder.encode(['uint256'], [latestPoolId])
  queryData = abiCoder.encode(['string','bytes'], ['DIVAProtocolPolygon', queryDataArgs])
  queryId = ethers.utils.keccak256(queryData)
  
  // Print values
  console.log('latestPoolId', latestPoolId)
  console.log('queryDataArgs', queryDataArgs)
  console.log('queryData', queryData)
  console.log('queryId', queryId)

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
