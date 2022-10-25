/**
 * Script to create a contingent pool on DIVA Protocol.
 * Run: `yarn diva:createContingentPool`
 */

const { ethers } = require("hardhat");
const { parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../../contracts/abi/DIVA.json");

const {
  DIVA_ADDRESS,
  COLLATERAL_TOKENS,
  DIVA_TELLOR_ORACLE_ADDRESS,
} = require("../../utils/constants");
const { getExpiryInSeconds } = require("../../utils/utils");

// Auxiliary function to perform checks required for successful execution, in line with those implemented
// inside the smart contract function. It is recommended to perform those checks in frontend applications
// to save users gas fees on reverts.
const checkConditions = (
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
  decimals,
  userBalance
) => {
  // Get current time (proxy for block timestamp)
  const now = Math.floor(Date.now() / 1000);

  if (Number(expiryTime) <= now) {
    throw new Error("Expiry time has to be in the future");
  }

  if (referenceAsset.length === 0) {
    throw new Error("Reference asset cannot be an empty string");
  }

  if (!(floor.lte(inflection) && inflection.lte(cap))) {
    throw new Error("Ensure that floor <= inflection <= cap");
  }

  if (
    collateralToken === ethers.constants.AddressZero ||
    dataProvider === ethers.constants.AddressZero
  ) {
    throw new Error("collateralToken/dataProvider cannot be zero address");
  }

  if (gradient.gt(parseUnits("1", decimals))) {
    throw new Error("Gradient cannot be greater than 1e18");
  }

  if (collateralAmount.lt(parseUnits("1", 6))) {
    throw new Error("collateralAmount cannot be smaller than 1e6");
  }

  if (capacity.lt(collateralAmount)) {
    throw new Error("Capacity cannot be smaller than collateral amount");
  }

  if (decimals > 18) {
    throw new Error("Collateral token cannot have more than 18 decimals");
  }

  if (decimals < 3) {
    throw new Error("Collateral token cannot have less than 3 decimals");
  }

  if (
    longRecipient === ethers.constants.AddressZero &&
    shortRecipient === ethers.constants.AddressZero
  ) {
    throw new Error(
      "Long and short token recipient cannot be both zero address"
    );
  }

  if (userBalance.lt(collateralAmount)) {
    throw new Error("Insufficient collateral tokens in wallet");
  }
};

async function main() {
  // INPUT: network should be the same as in diva::getPoolParameters command)
  const network = "goerli";

  // INPUT: collateral token symbol
  const collateralTokenSymbol = "dUSD";

  const collateralTokenAddress =
    COLLATERAL_TOKENS[network][collateralTokenSymbol];
  const dataProviderAddress = DIVA_TELLOR_ORACLE_ADDRESS[network];

  // Get signer of pool creator
  const [creator] = await ethers.getSigners();

  // Connect to ERC20 token that will be used as collateral when creating a contingent pool
  const erc20Contract = await ethers.getContractAt(
    "MockERC20",
    collateralTokenAddress
  );
  const decimals = await erc20Contract.decimals();

  // Get creator's ERC20 token balance
  const balance = await erc20Contract.balanceOf(creator.address);

  // Input arguments for `createContingentPool` function
  const referenceAsset = "ETH/USD";
  const expiryTime = getExpiryInSeconds(100); // 100 means expiry in 100 seconds from now
  const floor = parseUnits("2000");
  const inflection = parseUnits("2500");
  const cap = parseUnits("3000");
  const gradient = parseUnits("0.5", decimals);
  const collateralAmount = parseUnits("100", decimals);
  const collateralToken = collateralTokenAddress;
  const dataProvider = dataProviderAddress;
  const capacity = parseUnits("200", decimals);
  const longRecipient = creator.address;
  const shortRecipient = creator.address;
  const permissionedERC721Token = ethers.constants.AddressZero;

  // Check validity of input parameters
  checkConditions(
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
    decimals,
    balance
  );

  // Connect to deployed DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, DIVA_ADDRESS[network]);

  // Get creator's current allowance
  let allowance = await erc20Contract.allowance(creator.address, diva.address);

  if (allowance.lt(collateralAmount)) {
    // Increase allowance for DIVA contract
    const approveTx = await erc20Contract
      .connect(creator)
      .approve(diva.address, collateralAmount);
    await approveTx.wait();

    // Get creator's new allowance
    allowance = await erc20Contract.allowance(creator.address, diva.address);
  }

  // Create contingent pool
  const tx = await diva
    .connect(creator)
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
  const receipt = await tx.wait();

  // Get newly created pool Id from event
  const poolIssuedEvent = receipt.events.find(
    (item) => item.event === "PoolIssued"
  );
  const poolId = poolIssuedEvent.poolId;

  // Get pool parameters for newly created pool Id
  const poolParams = await diva.getPoolParameters(poolId);

  // Log relevant info
  console.log("DIVA address: ", diva.address);
  console.log("Creator address: ", creator.address);
  console.log("PoolId of newly created pool: ", poolId.toString());
  console.log("Pool creator address: ", creator.address);
  console.log("Long token recipient: ", longRecipient);
  console.log("Short token recipient: ", shortRecipient);
  console.log("Long token address: ", poolParams.longToken);
  console.log("Short token address: ", poolParams.shortToken);
  console.log("ERC20 collateral token address: ", erc20Contract.address);
  console.log("Collateral/Position token decimals: ", decimals.toString());
  console.log("Data provider: ", poolParams.dataProvider);
  console.log(
    "Expiry time: ",
    new Date(poolParams.expiryTime * 1000).toLocaleString()
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
