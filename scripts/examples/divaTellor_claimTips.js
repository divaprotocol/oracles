/**
 * Script to claim tips. Make sure you run this script after set finial reference value.
 * Run `yarn divaTellor:claimTips`
 */

const { ethers } = require("hardhat");
const { formatUnits } = require("@ethersproject/units");

const ERC20_ABI = require("../../contracts/abi/ERC20.json");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  addresses,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

const checkConditions = (reporter, tippingTokens) => {
  if (reporter === ethers.constants.AddressZero) {
    throw new Error("Not confirmed pool");
  }

  if (!tippingTokens.length) {
    throw new Error("No tipping tokens to claim");
  }
};

async function main() {
  // INPUT: network
  const network = "goerli";

  const divaAddress = addresses[network];
  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // INPUT: id of existing pool
  const poolId = 4;

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);

  // Get reporter
  const reporter = await divaOracleTellor.getReporter(poolId);

  // Get tipping tokens
  const tippingTokens = await divaOracleTellor.getTippingTokens(poolId);

  // Check conditions
  checkConditions(reporter, tippingTokens);

  // Get contracts of tipping tokens
  const tippingTokenContracts = await Promise.all(
    tippingTokens.map(async (tippingToken) => {
      return await ethers.getContractAt(ERC20_ABI, tippingToken);
    })
  );

  // Get decimals of tipping tokens
  const tippingTokenDecimals = await Promise.all(
    tippingTokenContracts.map(async (tippingTokenContract) => {
      return await tippingTokenContract.decimals();
    })
  );

  // Check tips on DIVAOracleTellor contract before claim tips
  console.log("");
  console.log("Tips on DIVAOracleTellor contract before claim tips");
  await Promise.all(
    tippingTokens.map(async (tippingToken, index) => {
      const tips = await divaOracleTellor.getTips(poolId, tippingToken);
      console.log(
        `Token address: ${tippingToken} Balance: ${formatUnits(
          tips,
          tippingTokenDecimals[index]
        )}`
      );
    })
  );

  // Check the balances of reporter before claim tips
  console.log("");
  console.log("Tipping token balances of reporter before claim tips");
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

  // Claim tips
  const tx = await divaOracleTellor.claimTips(poolId, tippingTokens);
  await tx.wait();

  // Check tips on DIVAOracleTellor contract after claim tips
  console.log("");
  console.log("Tips on DIVAOracleTellor contract after claim tips");
  await Promise.all(
    tippingTokens.map(async (tippingToken, index) => {
      const tips = await divaOracleTellor.getTips(poolId, tippingToken);
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

  // Log relevant information
  console.log("DIVA address: ", diva.address);
  console.log("PoolId: ", poolId);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
