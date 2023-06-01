/**
 * Script to get the pool parameters for an existing poolId in DIVA Protocol.
 * Run: `yarn diva:getPoolParameters --network mumbai`
 */

const { ethers } = require("hardhat");
const { formatUnits } = require("@ethersproject/units");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const { DIVA_ADDRESS, STATUS } = require("../../utils/constants");

async function main() {
  // INPUT: id of pool
  const poolId = "0xa7c27b6ba28c8b173c64ad0f2edc56da840740cec684c7a72e51a7d71d86a496";

  // Connect to deployed DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, DIVA_ADDRESS[network.name]);

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);

  // Get collateral token decimals to perform conversions from integer to decimal. Note that position tokens have the same number of decimals.
  const erc20Contract = await ethers.getContractAt(
    "MockERC20",
    poolParams.collateralToken
  );
  const decimals = await erc20Contract.decimals();

  // Log relevant info
  console.log("DIVA address: ", diva.address);
  console.log("Pool id: ", poolId);
  console.log("Reference asset: ", poolParams.referenceAsset);
  console.log("Floor: ", formatUnits(poolParams.floor));
  console.log("Inflection: ", formatUnits(poolParams.inflection));
  console.log("Cap: ", formatUnits(poolParams.cap));
  console.log("Gradient: ", formatUnits(poolParams.gradient, decimals));
  console.log(
    "Pool collateral balance: ",
    formatUnits(poolParams.collateralBalance, decimals)
  );
  console.log("Capacity: ", formatUnits(poolParams.capacity, decimals));
  console.log("Short token: ", poolParams.shortToken);
  console.log("Long token: ", poolParams.longToken);
  console.log("Collateral token: ", poolParams.collateralToken);
  console.log(
    "Expiry time: ",
    new Date(poolParams.expiryTime * 1000).toLocaleString()
  );
  console.log("Data provider: ", poolParams.dataProvider);

  console.log(
    "Status final reference value: ",
    STATUS[poolParams.statusFinalReferenceValue]
  );
  console.log("Status timestamp: ", poolParams.statusTimestamp.toString());
  console.log(
    "Final referencen value: ",
    formatUnits(poolParams.finalReferenceValue)
  );
  console.log(
    "Payout short token: ",
    formatUnits(poolParams.payoutShort, decimals)
  );
  console.log(
    "Payout long token: ",
    formatUnits(poolParams.payoutLong, decimals)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
