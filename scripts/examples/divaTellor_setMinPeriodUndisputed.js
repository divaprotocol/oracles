/**
 * Run `yarn divaTellor:setMinPeriodUndisputed`
 */

const hre = require("hardhat");
const { divaTellorOracleAddresses } = require("../../utils/constants");

async function main() {
  // INPUT: network
  const network = "goerli";

  // INPUT: new minPeriodUndisputed value
  const newMinPeriodUndisputed = 3600; // 3600 seconds

  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // Get signers
  const [acc1] = await ethers.getSigners();
  const user = acc1;

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await hre.ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("DIVAOracleTellor address: " + divaOracleTellor.address);

  // Get current contract owner (only owner can change the minPeriodUndisputed)
  const owner = await divaOracleTellor.owner();
  console.log("contract owner: ", owner);

  // Get current minPeriodUndisputed
  const _currentMinPeriodUndisputed =
    await divaOracleTellor.getMinPeriodUndisputed();
  console.log("current minPeriodUndisputed: ", _currentMinPeriodUndisputed);

  // Set new minPeriodUndisputed
  const tx = await divaOracleTellor
    .connect(user)
    .setMinPeriodUndisputed(newMinPeriodUndisputed);
  await tx.wait();

  // Get new minPeriodUndisputed
  const _newMinPeriodUndisputed =
    await divaOracleTellor.getMinPeriodUndisputed();
  console.log("new minPeriodUndisputed: ", _newMinPeriodUndisputed);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
