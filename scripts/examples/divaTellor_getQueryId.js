/**
 * Run `divaTellor:getQueryId`
 */
const hre = require("hardhat");
const { addresses, divaTellorOracleAddresses } = require('../../utils/constants');

async function main() {

  const network = "goerli"
  const poolId = 1150
  const divaAddress = addresses[network]
  console.log('divaAddress: ', divaAddress)

  const divaOracleTellorAddress = divaTellorOracleAddresses[network]
  console.log('divaOracleTellorAddress: ', divaOracleTellorAddress)

  // Get signers
  const [acc1, acc2, acc3] = await ethers.getSigners();
  const user = acc1;

  // Connect to Tellor oracle contract
  const divaOracleTellor = await hre.ethers.getContractAt("DIVAOracleTellor", divaOracleTellorAddress);
  
  // Get current queryId
  const queryId = await divaOracleTellor.getQueryId(poolId, divaAddress)
  console.log('queryId: ', queryId)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
