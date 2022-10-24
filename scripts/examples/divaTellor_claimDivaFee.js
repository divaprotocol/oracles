/**
 * Script to claim DIVA fee. Make sure you run this script after set finial reference value.
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

const checkConditions = (reporter) => {
  if (reporter === ethers.constants.AddressZero) {
    throw new Error("Not confirmed pool");
  }
};

async function main() {
  // INPUT: network
  const network = "goerli";

  const divaAddress = addresses[network];
  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // INPUT: id of existing pool
  const poolId = 4;
  console.log("Pool id: ", poolId);

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
  console.log("DIVA address: ", diva.address);

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);

  // Get reporter
  const reporter = await divaOracleTellor.getReporter(poolId);
  console.log("Reporter address: ", reporter);

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

  console.log(
    "Collateral token balance of reporter before claim DIVA fee: ",
    formatUnits(await collateralToken.balanceOf(reporter), decimals)
  );

  // Claim DIVA fee
  const tx = await divaOracleTellor.claimDIVAFee(poolId, diva.address);
  await tx.wait();

  console.log(
    "Collateral token balance of reporter after claim DIVA fee: ",
    formatUnits(await collateralToken.balanceOf(reporter), decimals)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
