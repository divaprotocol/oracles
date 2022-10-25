/**
 * Script to update the minimum period undisputed parameter. Only executable by contract owner.
 * Run `yarn divaTellor:setMinPeriodUndisputed`
 */

const { ethers } = require("hardhat");
const { DIVA_TELLOR_ORACLE_ADDRESS } = require("../../utils/constants");

const checkConditions = (newMinPeriodUndisputed, signerOfOwner, owner) => {
  if (newMinPeriodUndisputed < 3600 || newMinPeriodUndisputed > 64800) {
    throw new Error("Out of range");
  }

  if (signerOfOwner.address !== owner) {
    throw new Error(
      "Only owner of contract can update minimum period undisputed parameter"
    );
  }
};

async function main() {
  // INPUT: network
  const network = "goerli";

  // INPUT: new minPeriodUndisputed value
  const newMinPeriodUndisputed = 3600; // 3600 seconds

  const divaOracleTellorAddress = DIVA_TELLOR_ORACLE_ADDRESS[network];

  // Get signer of owner
  const [signerOfOwner] = await ethers.getSigners();

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Get current contract owner (only owner can change the minPeriodUndisputed)
  const owner = await divaOracleTellor.owner();

  checkConditions(newMinPeriodUndisputed, signerOfOwner, owner);

  // Get current minPeriodUndisputed
  const _currentMinPeriodUndisputed =
    await divaOracleTellor.getMinPeriodUndisputed();

  // Set new minPeriodUndisputed
  const tx = await divaOracleTellor
    .connect(signerOfOwner)
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
