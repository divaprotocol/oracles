/**
 * Run `yarn divaTellor:setFinalReferenceValue`
 */

const { ethers } = require("hardhat");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const {
  addresses,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

async function main() {
  const network = "goerli";
  const divaOracleTellorAddress = divaTellorOracleAddresses[network];
  const poolId = 2;
  divaAddress = addresses[network];
  console.log("divaAddress: " + divaAddress);
  console.log("divaOracleTellorAddress: " + divaOracleTellorAddress);

  // Connect to Tellor oracle contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  const tx = await divaOracleTellor.setFinalReferenceValue(divaAddress, poolId);
  await tx.wait();

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);
  console.log("poolId", poolId);
  console.log("dataProvider", poolParams.dataProvider);
  console.log(
    "statusFinalReferenceValue: ",
    poolParams.statusFinalReferenceValue
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
