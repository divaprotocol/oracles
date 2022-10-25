/**
 * Script to add tip. Run this function BEFORE the final value has been confirmed
 * (i.e. `setFinalReferenceValue` was called).
 * Run `yarn divaTellor:addTip`
 */

const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = require("@ethersproject/units");

const {
  collateralTokens,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

// Auxiliary function to perform checks required for successful execution, in line with those implemented
// inside the smart contract function. It is recommended to perform those checks in frontend applications
// to save users gas fees on reverts.
const checkConditions = (reporter) => {
  // Check reporter address
  if (reporter !== ethers.constants.AddressZero) {
    throw new Error("Already confirmed pool");
  }
};

async function main() {
  // INPUT: network
  const network = "goerli";

  // INPUT: tipping token symbol
  const tippingTokenSymbol = "dUSD";

  const tippingTokenAddress = collateralTokens[network][tippingTokenSymbol];
  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // INPUT: id of pool
  const poolId = 5;

  // Get signer of tipper
  const [tipper] = await ethers.getSigners();

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Get reporter
  const reporter = await divaOracleTellor.getReporter(poolId);

  // Check conditions
  checkConditions(reporter);

  // Connect to tipping token contract
  const tippingTokenContract = await ethers.getContractAt(
    "MockERC20",
    tippingTokenAddress
  );

  // Get decimals of tipping token
  const decimals = await tippingTokenContract.decimals();

  // INPUT: tipping amount
  const amount = parseUnits("10", decimals);

  // Set allowance for DIVAOracleTellor contract
  const approveTx = await tippingTokenContract
    .connect(tipper)
    .approve(divaOracleTellor.address, amount);
  await approveTx.wait();

  // Get tips before add tip
  const tipsBefore = formatUnits(
    await divaOracleTellor.getTips(poolId, tippingTokenContract.address),
    decimals
  );

  // Add tip
  const tx = await divaOracleTellor
    .connect(tipper)
    .addTip(poolId, amount, tippingTokenContract.address);
  await tx.wait();

  // Get tips after add tip
  const tipsAfter = formatUnits(
    await divaOracleTellor.getTips(poolId, tippingTokenContract.address),
    decimals
  );

  // Log relevant info
  console.log("DivaOracleTellorAddress: " + divaOracleTellor.address);
  console.log("PoolId: ", poolId);
  console.log("Tipper: " + tipper.address);
  console.log("Tipping token address: " + tippingTokenContract.address);
  console.log("Tipping token decimals: " + decimals);
  console.log(
    "Tipping amount (in decimal terms): ",
    formatUnits(amount, decimals)
  );
  console.log("Tips on DIVAOracleTellor contract BEFORE add tip: ", tipsBefore);
  console.log("Tips on DIVAOracleTellor contract AFTER add tip: ", tipsAfter);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
