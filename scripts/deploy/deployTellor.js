/**
 * Script to deploy DIVAOracleTellor contract.
 *
 * IMPORTANT:
 * - Set `EXCESS_FEE_RECIPIENT` in `.env` file to the initial DIVA treasuy address.
 * - Set `tellorVersion` on line 29 to the correct one you want link to. Make sure
 * the Tellor contract addresses in `utils/constants.js` file are correct.
 * - Set `MAX_FEE_AMOUNT_USD` in `.env` file to an integer with 18 decimals (e.g., $10 = 10000000000000000000)
 *
 * Run `yarn deploy:divaTellor`
 */

const { ethers, network } = require("hardhat");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  TELLOR_PLAYGROUND_ADDRESS,
  TELLOR_ADDRESS,
  TELLOR_VERSION,
  DIVA_ADDRESS,
} = require("../../utils/constants");
const { writeFileSync } = require("../../utils/utils");

// Load relevant variable from `.env` file
const EXCESS_FEE_RECIPIENT = process.env.EXCESS_FEE_RECIPIENT || "";
const MAX_FEE_AMOUNT_USD = process.env.MAX_FEE_AMOUNT_USD || "";

async function main() {
  // INPUT: Tellor version
  const tellorVersion = TELLOR_VERSION.ACTUAL;

  let tellorAddress;
  if (tellorVersion == TELLOR_VERSION.PLAYGROUND) {
    tellorAddress = TELLOR_PLAYGROUND_ADDRESS[network.name];
  } else if (tellorVersion == TELLOR_VERSION.ACTUAL) {
    tellorAddress = TELLOR_ADDRESS[network.name];
  } else {
    throw Error(
      "Invalid value for tellorVersion. Set to PLAYGROUND or ACTUAL"
    );
  }

  // Get DIVA contract deployed on selected network
  const divaAddress = DIVA_ADDRESS[network.name];
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Get DIVA ownership contract address
  const divaOwnershipAddress = await diva.getOwnershipContract();

  // Deploy DIVAOracleTellor contract
  const divaOracleTellorFactory = await ethers.getContractFactory(
    "DIVAOracleTellor"
  );
  const divaOracleTellor = await divaOracleTellorFactory.deploy(
    divaOwnershipAddress,
    tellorAddress,
    EXCESS_FEE_RECIPIENT,
    MAX_FEE_AMOUNT_USD,
    divaAddress
  );
  await divaOracleTellor.deployed();
  console.log("DIVAOracleTellor deployed to:", divaOracleTellor.address);

  // Generate the content of the `deploy-args.js` file used for the verification of
  // the `DIVAOracleTellor` contract
  const divaOracleTellorArgs = `
    module.exports = [
      "${divaOwnershipAddress}",
      "${tellorAddress}",
      "${EXCESS_FEE_RECIPIENT}",
      "${MAX_FEE_AMOUNT_USD}",
      "${divaAddress}"
    ];
  `;
  writeFileSync("deploy-args.js", divaOracleTellorArgs);

  // Generate the content of the `verify-args.js` file used for the verification of
  // the `DIVAOracleTellor` contract
  const verifyArgs = `
    module.exports = {
      network: "${network.name}",
      address: "${divaOracleTellor.address}",
    };
  `;
  writeFileSync("verify-args.js", verifyArgs);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
