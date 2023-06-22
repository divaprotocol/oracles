/**
 * Script to add a tip to an existing contingent pool.
 * The pool has to be in "Open" state for successful execution.
 * 
 * Run: `yarn divaTellor:addTip --network mumbai`
 */

const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = require("@ethersproject/units");
const {
  COLLATERAL_TOKENS,
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS,
} = require("../../utils/constants");

async function main() {
  // ************************************
  //           INPUT ARGUMENTS
  // ************************************

  // Id of an existing pool
  const poolId = "0x2610b8617991b12848a9dda7b9efd0ac2cc3ceacda5a055d7ebbe8ca4f0e5b26";

  // Tipping token symbol
  const tippingTokenSymbol = "dUSD";

  // Tipping amount (converted into big integer further down below)
  const _amount = 1.5;

  // Set tipper account
  const [tipper] = await ethers.getSigners();


  // ************************************
  //              EXECUTION
  // ************************************

  // Get tipping token address
  const tippingTokenAddress = COLLATERAL_TOKENS[network.name][tippingTokenSymbol];
  
  // Get DIVA Tellor oracle address
  const divaOracleTellorAddress = DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];

  // Connect to Tellor adapter contract
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

  // Convert tipping amount into an integer with the corresponding
  // amount of decimals
  const amount = parseUnits(_amount.toString(), decimals);

  // Set allowance for Tellor adapter contract
  const approveTx = await tippingTokenContract
    .connect(tipper)
    .approve(divaOracleTellorAddress, amount);
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
  console.log("Tellor adapter address: " + divaOracleTellorAddress);
  console.log("PoolId: ", poolId);
  console.log("Tipper: " + tipper.address);
  console.log("Tipping token address: " + tippingTokenContract.address);
  console.log("Tipping token decimals: " + decimals);
  console.log(
    "Tipping amount (in decimal terms): ",
    formatUnits(amount, decimals)
  );
  console.log("Tips on Tellor adapter contract BEFORE add tip: ", tipsBefore);
  console.log("Tips on Tellor adapter contract AFTER add tip: ", tipsAfter);
}

// Auxiliary function to perform checks required for successful execution, in line with those implemented
// inside the smart contract function. It is recommended to perform those checks in frontend applications
// to save users gas fees on reverts. Alternatively, use Tenderly to pre-simulate the tx and catch any errors
// before actually executing it.
const checkConditions = (reporter) => {
  // Confirm that no reporter has been set yet which is equivalent to that the pool
  // was not yet confirmed
  if (reporter !== ethers.constants.AddressZero) {
    throw new Error("Already confirmed pool");
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
