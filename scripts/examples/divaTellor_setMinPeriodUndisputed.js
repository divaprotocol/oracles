const hre = require("hardhat");
const { divaTellorOracleAddresses } = require('../../utils/constants');

async function main() {

  const network = "ropsten"
  let divaOracleTellorAddress = divaTellorOracleAddresses[network]
  const newMinPeriodUndisputed = 3600 // 10 seconds

  // Get signers
  const [acc1, acc2, acc3] = await ethers.getSigners();
  const user = acc1;

  // Connect to Tellor oracle contract
  const divaOracleTellor = await hre.ethers.getContractAt("DIVAOracleTellor", divaOracleTellorAddress);
  
  // Get current contract owner (only owner can change the minPeriodUndisputed)
  const owner = await divaOracleTellor.owner()
  console.log('contract owner: ', owner)

  // Get current minPeriodUndisputed
  const _currentMinPeriodUndisputed = await divaOracleTellor.getMinPeriodUndisputed()
  console.log('current minPeriodUndisputed: ', _currentMinPeriodUndisputed)

  // Set new minPeriodUndisputed
  const tx = await divaOracleTellor.connect(user).setMinPeriodUndisputed(newMinPeriodUndisputed);
  await tx.wait()

  // Get new minPeriodUndisputed
  const _newMinPeriodUndisputed = await divaOracleTellor.getMinPeriodUndisputed()
  console.log('new minPeriodUndisputed: ', _newMinPeriodUndisputed)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
