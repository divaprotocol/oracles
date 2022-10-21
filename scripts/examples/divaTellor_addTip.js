/**
 * Run `yarn divaTellor:addTip`
 */

const { ethers } = require("hardhat");
const { parseEther } = require("@ethersproject/units");

const ERC20_ABI = require("../../contracts/abi/ERC20.json");
const {
  collateralTokens,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

async function main() {
  const network = "goerli";
  const collateralTokenSymbol = "dUSD";

  const poolId = 3;
  console.log("PoolId", poolId);
  const amount = parseEther("10");
  const collateralTokenAddress =
    collateralTokens[network][collateralTokenSymbol];
  const divaOracleTellorAddress = divaTellorOracleAddresses[network];
  console.log("DivaOracleTellorAddress: " + divaOracleTellorAddress);

  // Get signer of tipper
  const [tipper] = await ethers.getSigners();
  console.log("Tipper: " + tipper.address);

  // Connect to Tellor oracle contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Connect to ERC20 token that will be used as collateral when creating a contingent pool
  const collateralTokenContract = await ethers.getContractAt(
    ERC20_ABI,
    collateralTokenAddress
  );
  const decimals = await collateralTokenContract.decimals();
  console.log("Collateral token decimals: " + decimals);

  // Set allowance for DIVA contract
  const approveTx = await collateralTokenContract
    .connect(tipper)
    .approve(divaOracleTellor.address, amount);
  await approveTx.wait();

  // Get tip after add tips
  console.log(
    "Before add tips",
    await divaOracleTellor.getTips(poolId, collateralTokenAddress)
  );

  const tx = await divaOracleTellor
    .connect(tipper)
    .addTip(poolId, amount, collateralTokenAddress);
  await tx.wait();

  // Get tip after add tips
  console.log(
    "After add tips",
    await divaOracleTellor.getTips(poolId, collateralTokenAddress)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
