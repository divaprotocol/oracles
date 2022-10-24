/**
 * Script to create a contingent pool on DIVA Protocol.
 * Run: `yarn diva:createContingentPool`
 */

const { ethers } = require("hardhat");
const { parseEther, parseUnits, formatUnits } = require("@ethersproject/units");

const ERC20_ABI = require("../../contracts/abi/ERC20.json");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  addresses,
  collateralTokens,
  divaTellorOracleAddresses,
} = require("../../utils/constants");
const { getExpiryInSeconds } = require("../../utils");

const checkConditions = (
  referenceAsset,
  floor,
  inflection,
  cap,
  collateralAmount,
  collateralToken,
  dataProvider,
  capacity,
  decimals,
  balance
) => {
  if (referenceAsset.length === 0) {
    throw new Error("Reference asset cannot be an empty string");
  }

  if (!(floor.lte(inflection) && inflection.lte(cap))) {
    throw new Error("Ensure that floor <= inflection <= cap");
  }

  if (
    collateralToken === ethers.AddressZero ||
    dataProvider === ethers.AddressZero
  ) {
    throw new Error("collateralToken/dataProvider cannot be zero address");
  }

  if (capacity.gt(0)) {
    if (capacity.lt(collateralAmount)) {
      throw new Error("Capacity cannot be smaller than collateral amount");
    }
  }

  if (decimals > 18) {
    throw new Error("Collateral token cannot have more than 18 decimals");
  }

  if (decimals < 3) {
    throw new Error("Collateral token cannot have less than 3 decimals");
  }

  if (balance.lt(collateralAmount)) {
    throw new Error("Insufficient collateral tokens in wallet");
  }
};

async function main() {
  // INPUT: network
  const network = "goerli";

  // INPUT: collateral token symbol
  const collateralTokenSymbol = "dUSD";

  const collateralTokenAddress =
    collateralTokens[network][collateralTokenSymbol];
  const dataProviderAddress = divaTellorOracleAddresses[network];

  // Get signer of pool creator
  const [poolCreator] = await ethers.getSigners();
  console.log("Pool creator address: " + poolCreator.address);

  // Connect to ERC20 token that will be used as collateral when creating a contingent pool
  const collateralTokenContract = await ethers.getContractAt(
    ERC20_ABI,
    collateralTokenAddress
  );
  console.log("Collateral token address: " + collateralTokenContract.address);

  // Get decimals of collateral token
  const decimals = await collateralTokenContract.decimals();
  console.log("Collateral token decimals: " + decimals);

  // INPUTS for `createContingentPool` function
  const referenceAsset = "BTC/USD"; // "BTC/USD"
  const expiryTime = getExpiryInSeconds(100); // 100 means expiry in 100 seconds from now
  const floor = parseEther("20000");
  const inflection = parseEther("20000");
  const cap = parseEther("45000");
  const gradient = parseUnits("0.7");
  const collateralAmount = parseUnits("100", decimals);
  const collateralToken = collateralTokenAddress;
  const dataProvider = dataProviderAddress;
  const capacity = parseUnits("200", decimals);
  const longRecipient = poolCreator.address;
  const shortRecipient = poolCreator.address;
  const permissionedERC721Token = ethers.constants.AddressZero;

  // Get collateral token balance of pool creator
  const balance = await collateralTokenContract.balanceOf(poolCreator.address);
  console.log(
    "Collateral token balance of pool creator: " +
      formatUnits(balance, decimals)
  );

  // Check conditions
  checkConditions(
    referenceAsset,
    floor,
    inflection,
    cap,
    collateralAmount,
    collateralToken,
    dataProvider,
    capacity,
    decimals,
    balance
  );

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, addresses[network]);
  console.log("DIVA address: ", diva.address);

  // Set allowance for DIVA contract
  const approveTx = await collateralTokenContract
    .connect(poolCreator)
    .approve(diva.address, collateralAmount);
  await approveTx.wait();

  // Check that allowance was set
  const allowance = await collateralTokenContract.allowance(
    poolCreator.address,
    diva.address
  );
  console.log("Approved amount: " + formatUnits(await allowance, decimals));

  // Create contingent pool
  const tx = await diva
    .connect(poolCreator)
    .createContingentPool([
      referenceAsset,
      expiryTime,
      floor,
      inflection,
      cap,
      gradient,
      collateralAmount,
      collateralToken,
      dataProvider,
      capacity,
      longRecipient,
      shortRecipient,
      permissionedERC721Token,
    ]);
  await tx.wait();

  // Get pool Id
  const poolId = await diva.getLatestPoolId();
  console.log("Pool id of new pool created: " + poolId);

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);

  // Log relevant info
  console.log("Data provider: " + poolParams.dataProvider);
  console.log(
    "Expiry time: " + new Date(poolParams.expiryTime * 1000).toLocaleString()
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
