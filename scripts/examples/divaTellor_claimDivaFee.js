/**
 * Script to claim DIVA fee. Run this function AFTER the final value has been confirmed
 * (i.e. once `setFinalReferenceValue` was called).
 * Run `yarn divaTellor:claimDivaFee`
 */

const { ethers } = require("hardhat");
const { formatUnits } = require("@ethersproject/units");

const ERC20_ABI = require("../../contracts/abi/ERC20.json");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  addresses,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

// Check the final value has been set and a fee has been assigned inside DIVA Protocol.
// Not running the check may result in wasting gas for claiming a zero fee.
const checkConditions = (reporter) => {
  if (reporter === ethers.constants.AddressZero) {
    throw new Error("Final value is not yet confirmed");
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

  // Get reporter
  const reporter = await divaOracleTellor.getReporter(poolId);

  // Check conditions
  checkConditions(reporter);

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);

  // Connect to collateral token contract
  const collateralToken = await ethers.getContractAt(
    ERC20_ABI,
    poolParams.collateralToken
  );

  // Get decimals of collateral token
  const decimals = await collateralToken.decimals();

  // Get collateral token balance of reporter before claiming the fee
  const collateralTokenBalanceReporterBefore = formatUnits(await collateralToken.balanceOf(reporter), decimals);

  // Get fee claim before claiming the fee
  const DIVAFeeBefore = formatUnits(await diva.getClaim(poolParams.collateralToken, divaOracleTellorAddress));

  // Claim DIVA fee
  const tx = await divaOracleTellor.claimDIVAFee(poolId, diva.address);
  await tx.wait();

  // Get collateral token balance of reporter after claiming the fee
  const collateralTokenBalanceReporterAfter = formatUnits(await collateralToken.balanceOf(reporter), decimals);

  // Get fee claim after claiming the fee
  const DIVAFeeAfter = formatUnits(await diva.getClaim(poolParams.collateralToken, divaOracleTellorAddress));

  // Log relevant information
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);
  console.log("DIVA address: ", diva.address);
  console.log("PoolId: ", poolId);
  console.log("Reporter address: ", reporter);
  console.log("Get fee claim BEFORE claiming DIVA fee: ", DIVAFeeBefore);
  console.log("Get fee claim AFTER claiming DIVA fee: ", DIVAFeeAfter);
  console.log("Collateral token balance of reporter BEFORE claim DIVA fee: ", collateralTokenBalanceReporterBefore);
  console.log("Collateral token balance of reporter AFTER claim DIVA fee: ", collateralTokenBalanceReporterAfter);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
