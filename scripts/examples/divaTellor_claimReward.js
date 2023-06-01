/**
 * Script to claim tips. Make sure you run this script after set finial reference value.
 * Run: `yarn divaTellor:claimReward --network mumbai`
 */

const { ethers } = require("hardhat");
const { formatUnits } = require("@ethersproject/units");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const {
  DIVA_ADDRESS,
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS,
} = require("../../utils/constants");

const checkConditions = (reporter, tippingTokens) => {
  if (reporter === ethers.constants.AddressZero) {
    throw new Error("Not confirmed pool");
  }
  if (tippingTokens.length == 1 && tippingTokens[0] == ethers.constants.AddressZero) {
    throw new Error("No tipping tokens to claim");
  }
};

async function main() {
  // INPUT: id of existing pool
  const poolId = "0xa7c27b6ba28c8b173c64ad0f2edc56da840740cec684c7a72e51a7d71d86a496";

  // Get DIVA Tellor oracle address
  const divaOracleTellorAddress = DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];

  // Get DIVA Protocol address
  const divaAddress = DIVA_ADDRESS[network.name];

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Connect to Tellor adapter contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("Tellor adapter address: ", divaOracleTellor.address);

  // Get reporter
  const reporter = (await divaOracleTellor.getReporters([poolId]))[0];

  // Get tipping tokens
  const tippingTokens = (
    await divaOracleTellor.getTippingTokens([
      { poolId, startIndex: 0, endIndex: 1 },
    ])
  )[0];

  // Check conditions
  checkConditions(reporter, tippingTokens);

  // Get contracts of tipping tokens
  const tippingTokenContracts = await Promise.all(
    tippingTokens.map(async (tippingToken) => {
      return await ethers.getContractAt("MockERC20", tippingToken);
    })
  );

  // Get decimals of tipping tokens
  const tippingTokenDecimals = await Promise.all(
    tippingTokenContracts.map(async (tippingTokenContract) => {
      return await tippingTokenContract.decimals();
    })
  );

  // Check tips on Tellor adapter contract before reward claim
  console.log("");
  console.log("Tips on Tellor adapter contract before reward claim");
  await Promise.all(
    tippingTokens.map(async (tippingToken, index) => {
      const tips = (
        await divaOracleTellor.getTipAmounts([
          { poolId, tippingTokens: [tippingToken] },
        ])
      )[0][0];
      console.log(
        `Token address: ${tippingToken} Balance: ${formatUnits(
          tips,
          tippingTokenDecimals[index]
        )}`
      );
    })
  );

  // Check the balances of reporter before reward claim
  console.log("");
  console.log("Tipping token balances of reporter before reward claim");
  await Promise.all(
    tippingTokenContracts.map(async (tippingTokenContract, index) => {
      const tippingTokenBalance = await tippingTokenContract.balanceOf(
        reporter
      );
      console.log(
        `Token address: ${tippingTokenContract.address} Balance: ${formatUnits(
          tippingTokenBalance,
          tippingTokenDecimals[index]
        )}`
      );
    })
  );

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);

  // Connect to collateral token contract
  const collateralToken = await ethers.getContractAt(
    "MockERC20",
    poolParams.collateralToken
  );

  // Get decimals of collateral token
  const decimals = await collateralToken.decimals();

  // Get collateral token balance of reporter before claiming the DIVA reward
  const collateralTokenBalanceReporterBefore = formatUnits(
    await collateralToken.balanceOf(reporter),
    decimals
  );

  // Get DIVA reward claim before claiming it
  const divaRewardBefore = formatUnits(
    await diva.getReservedClaim(poolParams.collateralToken, divaOracleTellorAddress),
    decimals
  );

  // Claim tips
  const tx = await divaOracleTellor.claimReward(poolId, tippingTokens, true);
  await tx.wait();

  // Check tips on Tellor adapter contract after claim tips
  console.log("");
  console.log("Tips on Tellor adapter contract after claim tips");
  await Promise.all(
    tippingTokens.map(async (tippingToken, index) => {
      const tips = (
        await divaOracleTellor.getTipAmounts([
          { poolId, tippingTokens: [tippingToken] },
        ])
      )[0][0];
      console.log(
        `Token address: ${tippingToken} Balance: ${formatUnits(
          tips,
          tippingTokenDecimals[index]
        )}`
      );
    })
  );

  // Check the balance of reporter after claim tips
  console.log("");
  console.log("Tipping token balances of reporter after claim tips");
  await Promise.all(
    tippingTokenContracts.map(async (tippingTokenContract, index) => {
      const tippingTokenBalance = await tippingTokenContract.balanceOf(
        reporter
      );
      console.log(
        `Token address: ${tippingTokenContract.address} Balance: ${formatUnits(
          tippingTokenBalance,
          tippingTokenDecimals[index]
        )}`
      );
    })
  );

  // Get collateral token balance of reporter after claiming the DIVA reward
  const collateralTokenBalanceReporterAfter = formatUnits(
    await collateralToken.balanceOf(reporter),
    decimals
  );

  // Get DIVA reward claim after claiming it
  const divaRewardAfter = formatUnits(
    await diva.getClaim(poolParams.collateralToken, divaOracleTellorAddress)
  );

  // Log relevant information
  console.log("DIVA address: ", diva.address);
  console.log("PoolId: ", poolId);
  console.log("Reporter address: ", reporter);
  console.log("Get DIVA reward BEFORE claim: ", divaRewardBefore);
  console.log("Get DIVA reward AFTER claim: ", divaRewardAfter);
  console.log(
    "Collateral token balance of reporter BEFORE DIVA reward claim: ",
    collateralTokenBalanceReporterBefore
  );
  console.log(
    "Collateral token balance of reporter AFTER DIVA reward claim: ",
    collateralTokenBalanceReporterAfter
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
