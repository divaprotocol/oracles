/**
 * Script to add tip. Run this function BEFORE the final value has been confirmed
 * (i.e. `setFinalReferenceValue` was called).
 * Run `yarn divaTellor:addTip`
 */

const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = require("@ethersproject/units");
const {
  COLLATERAL_TOKENS,
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS,
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
  // INPUT: Id of pool
  const poolId = "0xa7c27b6ba28c8b173c64ad0f2edc56da840740cec684c7a72e51a7d71d86a496";

  // INPUT: tipping token symbol
  const tippingTokenSymbol = "dUSD";

  // INPUT: Tipping amount (converted into big integer further down below)
  const _amount = 1.5;

  // Get tipping token address
  const tippingTokenAddress = COLLATERAL_TOKENS[network.name][tippingTokenSymbol];
  
  // Get DIVA Tellor oracle address
  const divaOracleTellorAddress = DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];

  // Get signer of tipper
  const [tipper] = await ethers.getSigners();

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Get reporter
  const reporter = (await divaOracleTellor.getReporters([poolId]))[0];

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
  const amount = parseUnits(_amount.toString(), decimals);

  // Set allowance for DIVAOracleTellor contract
  const approveTx = await tippingTokenContract
    .connect(tipper)
    .approve(divaOracleTellor.address, amount);
  await approveTx.wait();

  // Get tips before add tip
  const tipsBefore = formatUnits(
    (
      await divaOracleTellor.getTipAmounts([
        { poolId, tippingTokens: [tippingTokenContract.address] },
      ])
    )[0][0],
    decimals
  );

  // Add tip
  const tx = await divaOracleTellor
    .connect(tipper)
    .addTip(poolId, amount, tippingTokenContract.address);
  await tx.wait();

  // Get tips after add tip
  const tipsAfter = formatUnits(
    (
      await divaOracleTellor.getTipAmounts([
        { poolId, tippingTokens: [tippingTokenContract.address] },
      ])
    )[0][0],
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
