/**
 * Script to deploy DIVAOracleTellor contract.
 *
 * IMPORTANT:
 * - Set `EXCESS_FEE_RECIPIENT` in `.env` file to the initial DIVA treasuy address.
 * - Set `tellorVersion` on line 33 to the correct one you want link to.
 *
 * Run `yarn deploy:divaTellor`
 */

const { ethers, network } = require("hardhat");
const { parseUnits } = require("ethers/lib/utils");

const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  TELLOR_PLAYGROUND_ADDRESS,
  TELLOR_ADDRESS,
  TELLOR_VERSION,
  DIVA_ADDRESS,
} = require("../../utils/constants");
const { checkMinPeriodUndisputed } = require("../../utils/utils");

// Load relevant variable from `.env` file
const EXCESS_FEE_RECIPIENT = process.env.EXCESS_FEE_RECIPIENT || "";
const MIN_PERIOD_UNDISPUTED = process.env.MIN_PERIOD_UNDISPUTED || "";
const MAX_FEE_AMOUNT_USD = process.env.MAX_FEE_AMOUNT_USD || "";

async function main() {
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

  const minPeriodUndisputed = Number(MIN_PERIOD_UNDISPUTED); // IMPORTANT to set correctly!; input in seconds
  // checkMinPeriodUndisputed(minPeriodUndisputed);
  const maxFeeAmountUSD = parseUnits(MAX_FEE_AMOUNT_USD); // $10

  const divaAddress = DIVA_ADDRESS[network.name];
  // Get DIVA contract
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
    minPeriodUndisputed,
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
