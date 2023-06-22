/**
 * Script to create a contingent pool on DIVA Protocol.
 * Run: `yarn diva:createContingentPool --network mumbai`
 */

const { ethers, network } = require("hardhat");
const { parseUnits } = require("@ethersproject/units");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const {
  DIVA_ADDRESS,
  COLLATERAL_TOKENS,
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS,
} = require("../../utils/constants");
const { getExpiryInSeconds } = require("../../utils/utils");

async function main() {
  // ************************************
  //           INPUT ARGUMENTS
  // ************************************
  
  // Pool parameters. Note that the conversion into integer happens
  // below in the code as it depends on the collateral token decimals.
  const referenceAsset = "ETH/USD";
  const expiryTime = await getExpiryInSeconds(100); // 100 means expiry in 100 seconds from now
  const floorInput = "2000"; // floorInput <= inflectionInput <= capInput
  const inflectionInput = "2500"; // floorInput <= inflectionInput <= capInput
  const capInput = "3000"; // floorInput <= inflectionInput <= capInput
  const gradientInput = "0.5"; // 0 <= gradientInput <= 1
  const collateralAmountInput = "100"; // collateralAmountInput <= capacityInput
  const collateralTokenSymbol = "dUSD"; // see `constants.js` for available tokens
  const dataProvider = DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];
  const capacityInput = "200"; // collateralAmountInput <= capacityInput
  const longRecipient = "0x9AdEFeb576dcF52F5220709c1B267d89d5208D78";
  const shortRecipient = "0x9AdEFeb576dcF52F5220709c1B267d89d5208D78";
  const permissionedERC721Token = ethers.constants.AddressZero;

  // Set pool creator account
  const [creator] = await ethers.getSigners();
  
  // ************************************
  //              EXECUTION
  // ************************************

  // Set ERC20 collateral token address
  const erc20CollateralTokenAddress =
    COLLATERAL_TOKENS[network.name][collateralTokenSymbol];

  // Connect to ERC20 token that will be used as collateral when creating a contingent pool
  const erc20Contract = await ethers.getContractAt(
    "MockERC20",
    erc20CollateralTokenAddress
  );
  const decimals = await erc20Contract.decimals();

  // Input arguments for `createContingentPool` function
  const floor = parseUnits(floorInput);
  const inflection = parseUnits(inflectionInput);
  const cap = parseUnits(capInput);
  const gradient = parseUnits(gradientInput, decimals);
  const collateralAmount = parseUnits(collateralAmountInput, decimals);
  const collateralToken = erc20CollateralTokenAddress;
  const capacity = parseUnits(capacityInput, decimals);

  // Get creator's ERC20 token balance
  const balance = await erc20Contract.balanceOf(creator.address);

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
  const diva = await ethers.getContractAt(DIVA_ABI, DIVA_ADDRESS[network.name]);

  // Get creator's current allowance
  let allowance = await erc20Contract.allowance(creator.address, diva.address);

  // Increase allowance for DIVA contract if insufficient
  if (allowance.lt(collateralAmount)) {
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
  const poolId = poolIssuedEvent.args.poolId;

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

// Auxiliary function to perform checks required for successful execution, in line with those implemented
// inside the smart contract function. It is recommended to perform those checks in frontend applications
// to save users gas fees on reverts. Alternatively, use Tenderly to pre-simulate the tx and catch any errors
// before actually executing it.
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

  if (cap.gte(parseUnits("1", 59))) {
    throw new Error("Cap should not exceed 1e59.");
  }

  if (collateralToken === ethers.constants.AddressZero) {
    throw new Error("collateralToken cannot be zero address.");
  }

  if (dataProvider === ethers.constants.AddressZero) {
    throw new Error("dataProvider cannot be zero address.");
  }

  if (gradient.gt(parseUnits("1", decimals))) {
    throw new Error("Gradient cannot be greater than 1e18");
  }

  if (capacity.lt(collateralAmount)) {
    throw new Error("Capacity cannot be smaller than collateral amount");
  }

  if (decimals > 18) {
    throw new Error("Collateral token cannot have more than 18 decimals");
  }

  if (decimals < 6) {
    throw new Error("Collateral token cannot have less than 6 decimals");
  }

  if (longRecipient === ethers.constants.AddressZero) {
    throw new Error("Long token recipient cannot be the zero address.");
  }

  if (shortRecipient === ethers.constants.AddressZero) {
    throw new Error("Short token recipient cannot be the zero address.");
  }

  if (userBalance.lt(collateralAmount)) {
    throw new Error("Insufficient collateral tokens in wallet");
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
