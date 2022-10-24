/**
 * Script to add tip. Make sure you run this script before set finial reference value.
 * Run `yarn divaTellor:addTip`
 */

const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = require("@ethersproject/units");

const ERC20_ABI = require("../../contracts/abi/ERC20.json");
const {
  collateralTokens,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

const checkConditions = (reporter) => {
  // Check reporter address
  if (reporter !== ethers.constants.AddressZero) {
    throw new Error("Already confirmed pool");
  }
};

async function main() {
  const network = "goerli";
  const collateralTokenSymbol = "dUSD";

  const collateralTokenAddress =
    collateralTokens[network][collateralTokenSymbol];
  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  const poolId = 4;
  console.log("PoolId: ", poolId);

  // Get signer of tipper
  const [tipper] = await ethers.getSigners();
  console.log("Tipper: " + tipper.address);

  // Connect to Tellor oracle contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("DivaOracleTellorAddress: " + divaOracleTellor.address);

  // Get reporter
  const reporter = await divaOracleTellor.getReporter(poolId);
  checkConditions(reporter);

  // Connect to ERC20 token that will be used as collateral when creating a contingent pool
  const collateralTokenContract = await ethers.getContractAt(
    ERC20_ABI,
    collateralTokenAddress
  );
  console.log("Collateral token address: " + collateralTokenContract.address);

  // Get decimals of collateral token
  const decimals = await collateralTokenContract.decimals();
  console.log("Collateral token decimals: " + decimals);

  const amount = parseUnits("10", decimals);
  console.log("Tipping amount: ", formatUnits(amount, decimals));

  // Set allowance for DIVA contract
  const approveTx = await collateralTokenContract
    .connect(tipper)
    .approve(divaOracleTellor.address, amount);
  await approveTx.wait();

  // Get tip after add tip
  console.log(
    "Tips on DIVAOracleTellor contract before add tip: ",
    formatUnits(
      await divaOracleTellor.getTips(poolId, collateralTokenAddress),
      decimals
    )
  );

  const tx = await divaOracleTellor
    .connect(tipper)
    .addTip(poolId, amount, collateralTokenAddress);
  await tx.wait();

  // Get tip after add tip
  console.log(
    "Tips on DIVAOracleTellor contract after add tip: ",
    formatUnits(
      await divaOracleTellor.getTips(poolId, collateralTokenAddress),
      decimals
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
