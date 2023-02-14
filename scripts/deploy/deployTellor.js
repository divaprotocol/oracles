/**
 * Script to deploy DIVAOracleTellor contract.
 * Run `yarn deploy:divaTellor`
 */

const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");

const {
  TELLOR_PLAYGROUND_ADDRESS,
  TELLOR_ADDRESS,
  TELLOR_VERSION,
  DIVA_ADDRESS,
} = require("../../utils/constants"); //  DIVA Protocol v0.9.0
const { checkPeriodMinPeriodUndisputed } = require("../../utils/utils");

// Load relevant variables from `.env` file
const EXCESS_FEE_RECIPIENT = process.env.EXCESS_FEE_RECIPIENT || "";

async function main() {
  const network = "goerli";
  const tellorVersion = TELLOR_VERSION.ACTUAL;
  let tellorAddress;

  if (tellorVersion == TELLOR_VERSION.PLAYGROUND) {
    tellorAddress = TELLOR_PLAYGROUND_ADDRESS[network];
  } else if (tellorVersion == TELLOR_VERSION.ACTUAL) {
    tellorAddress = TELLOR_ADDRESS[network];
  } else {
    throw Error("Invalid value for tellorVersion. Set to PLAYGROUND or ACTUAL");
  }

  const divaAddress = DIVA_ADDRESS[network];
  const periodMinPeriodUndisputed = 10; // IMPORTANT to set correctly!; input in seconds
  checkPeriodMinPeriodUndisputed(periodMinPeriodUndisputed);
  const maxFeeAmountUSD = parseEther("10"); // $10

  const divaOracleTellorFactory = await ethers.getContractFactory(
    "DIVAOracleTellor"
  );
  const divaOracleTellor = await divaOracleTellorFactory.deploy(
    tellorAddress,
    EXCESS_FEE_RECIPIENT,
    periodMinPeriodUndisputed,
    maxFeeAmountUSD,
    divaAddress
  );

  await divaOracleTellor.deployed();

  console.log("DIVAOracleTellor deployed to:", divaOracleTellor.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
