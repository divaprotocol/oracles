/**
 * Script to set final reference value. Make sure you run this script after submit value on Tellor contract.
 * Run `yarn divaTellor:setFinalReferenceValue`
 */

const { ethers } = require("hardhat");

const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  status,
  addresses,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

async function main() {
  // INPUT: network
  const network = "goerli";

  const divaOracleTellorAddress = divaTellorOracleAddresses[network];
  const divaAddress = addresses[network];

  // INPUT: id of existing pool
  const poolId = 4;

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
  console.log("DIVA address: ", diva.address);

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("DIVAOracleTellor address: " + divaOracleTellor.address);

  // Set final reference value
  const tx = await divaOracleTellor.setFinalReferenceValue(divaAddress, poolId);
  await tx.wait();

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);
  console.log("Pool id: ", poolId);
  console.log("Data provider: ", poolParams.dataProvider);
  console.log(
    "StatusFinalReferenceValue: ",
    status[poolParams.statusFinalReferenceValue]
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
