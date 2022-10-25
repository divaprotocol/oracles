/**
 * Script to update the minimum period undisputed parameter. Only executable by contract owner.
 * Run `yarn divaTellor:setMinPeriodUndisputed`
 */

const hre = require("hardhat");
const { divaTellorOracleAddresses } = require("../../utils/constants");

// TODO Add checkConditions function to ensure that the new period is within the pre-defined range
// TODO Add check that user is contract owner. If not, revert
// TODO Do we need hre here? Saw you replaced it in diva-contracts repo

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

  // Get current contract owner (only owner can change the minPeriodUndisputed)
  const owner = await divaOracleTellor.owner();

  // Get current minPeriodUndisputed
  const _currentMinPeriodUndisputed =
    await divaOracleTellor.getMinPeriodUndisputed();

  // Set new minPeriodUndisputed
  const tx = await divaOracleTellor
    .connect(user)
    .setMinPeriodUndisputed(newMinPeriodUndisputed);
  await tx.wait();

  // Get new minPeriodUndisputed
  const _newMinPeriodUndisputed =
    await divaOracleTellor.getMinPeriodUndisputed();

  // Log relevant information
  console.log("DIVAOracleTellor address: " + divaOracleTellor.address);
  console.log("Contract owner: ", owner);
  console.log("Old minPeriodUndisputed: ", _currentMinPeriodUndisputed);
  console.log("New minPeriodUndisputed: ", _newMinPeriodUndisputed);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
