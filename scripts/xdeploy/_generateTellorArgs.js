// Auxiliary script used as part of the xdeployer process to generate the
// constructor args file for DIVAOracleTellor contract.

const { ethers, network } = require("hardhat");
const { parseUnits } = require("ethers/lib/utils");

const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const { writeFile } = require("../../utils/utils");
const {
  DIVA_ADDRESS,
  TELLOR_VERSION,
  TELLOR_ADDRESS,
  TELLOR_PLAYGROUND_ADDRESS,
} = require("../../utils/constants");

// Load relevant variables from `.env` file
const EXCESS_FEE_RECIPIENT = process.env.EXCESS_FEE_RECIPIENT || "";
const MAX_FEE_AMOUNT_USD = process.env.MAX_FEE_AMOUNT_USD || "";

const main = async () => {
  // INPUT: tellor version
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

  // Generate the content of the xdeploy-args.js file used for the deployment of
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
  writeFile("xdeploy-args.js", divaOracleTellorArgs);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
