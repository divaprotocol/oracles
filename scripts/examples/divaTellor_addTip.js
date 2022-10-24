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
  // INPUT: network
  const network = "goerli";

  // INPUT: tipping token symbol
  const tippingTokenSymbol = "dUSD";

  const tippingTokenAddress = collateralTokens[network][tippingTokenSymbol];
  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // INPUT: id of pool
  const poolId = 5;
  console.log("PoolId: ", poolId);

  // Get signer of tipper
  const [tipper] = await ethers.getSigners();
  console.log("Tipper: " + tipper.address);

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("DivaOracleTellorAddress: " + divaOracleTellor.address);

  // Get reporter
  const reporter = await divaOracleTellor.getReporter(poolId);
  // Check conditions
  checkConditions(reporter);

  // Connect to tipping token contract
  const tippingTokenContract = await ethers.getContractAt(
    ERC20_ABI,
    tippingTokenAddress
  );
  console.log("Tipping token address: " + tippingTokenContract.address);

  // Get decimals of tipping token
  const decimals = await tippingTokenContract.decimals();
  console.log("Tipping token decimals: " + decimals);

  // INPUT: tipping amount
  const amount = parseUnits("10", decimals);
  console.log("Tipping amount: ", formatUnits(amount, decimals));

  // Set allowance for DIVAOracleTellor contract
  const approveTx = await tippingTokenContract
    .connect(tipper)
    .approve(divaOracleTellor.address, amount);
  await approveTx.wait();

  // Get tips before add tip
  console.log(
    "Tips on DIVAOracleTellor contract before add tip: ",
    formatUnits(
      await divaOracleTellor.getTips(poolId, tippingTokenContract.address),
      decimals
    )
  );

  // Add tip
  const tx = await divaOracleTellor
    .connect(tipper)
    .addTip(poolId, amount, tippingTokenContract.address);
  await tx.wait();

  // Get tips after add tip
  console.log(
    "Tips on DIVAOracleTellor contract after add tip: ",
    formatUnits(
      await divaOracleTellor.getTips(poolId, tippingTokenContract.address),
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
