const hre = require("hardhat");
const { divaTellorOracleAddresses } = require('../../utils/constants');

async function main() {

  const network = "goerli"
  const divaOracleTellorAddress = divaTellorOracleAddresses[network]
  console.log('divaOracleTellorAddress: ', divaOracleTellorAddress)

  // Get signers
  const [acc1, acc2, acc3] = await ethers.getSigners();
  const user = acc1;

  // Connect to Tellor oracle contract
  const divaOracleTellor = await hre.ethers.getContractAt("DIVAOracleTellor", divaOracleTellorAddress);
  
  // Get current minPeriodUndisputed
  const minPeriodUndisputed = await divaOracleTellor.getMinPeriodUndisputed()
  console.log('current minPeriodUndisputed: ', minPeriodUndisputed)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
