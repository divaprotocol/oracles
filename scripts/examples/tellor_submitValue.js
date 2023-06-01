/**
 * Script to submit a value to the Tellor playground. Run this script AFTER the pool expired.
 * Note that one address can only submit one value. It will fail if you try to submit a value
 * with the same address multiple times.
 * Run: `yarn tellor:submitValue --network mumbai`
 */

const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = require("@ethersproject/units");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const TELLOR_PLAYGROUND_ABI = require("../../contracts/abi/TellorPlayground.json");
const TELLOR_ABI = require("../../contracts/abi/Tellor.json");
const {
  DIVA_ADDRESS,
  TELLOR_VERSION,
  TELLOR_ADDRESS,
  TELLOR_PLAYGROUND_ADDRESS,
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS,
} = require("../../utils/constants");

const {
  calcSettlementFee,
  encodeOracleValue,
  decodeOracleValue,
  getQueryDataAndId,
} = require("../../utils/utils");

async function main() {
  // ************************************
  //           INPUT ARGUMENTS
  // ************************************

  // Tellor version (PLAYGROUND or ACTUAL)
  const tellorVersion = TELLOR_VERSION.PLAYGROUND;

  // Id of an existing pool
  const poolId = "0x2610b8617991b12848a9dda7b9efd0ac2cc3ceacda5a055d7ebbe8ca4f0e5b26";

  // Set reporter account
  const [reporter] = await ethers.getSigners();


  // ************************************
  //              EXECUTION
  // ************************************

  // The Tellor protocol address to submit the value to
  let tellorAddress;

  // The Tellor adapter address that was set as the data provider for the
  // selected pool (only for checking condition before executing the tx)
  let divaOracleTellorAddress;

  // Set variables depending on user input
  if (tellorVersion == TELLOR_VERSION.PLAYGROUND) {
    tellorAddress = TELLOR_PLAYGROUND_ADDRESS[network.name];
    // Get the Tellor adapter address to confirm later that 
    divaOracleTellorAddress =
      DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS[network.name];
  } else if (tellorVersion == TELLOR_VERSION.ACTUAL) {
    tellorAddress = TELLOR_ADDRESS[network.name];
    divaOracleTellorAddress =
      DIVA_TELLOR_ORACLE_ADDRESS[network.name];
  } else {
    throw Error(
      "Invalid value for tellorVersion. Set to PLAYGROUND or ACTUAL"
    );
  }

  // Get the DIVA Protocol address to obtain the queryId and queryData
  // required for reporting
  const divaAddress = DIVA_ADDRESS[network.name];

  // Get chain id
  const chainId = (await ethers.provider.getNetwork()).chainId;

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Connect to Tellor adapter contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );

  // Connect to Tellor contract
  const tellor = await ethers.getContractAt(
    tellorVersion == TELLOR_VERSION.PLAYGROUND
      ? TELLOR_PLAYGROUND_ABI
      : TELLOR_ABI,
    tellorAddress
  );

  // Get pool parameters for the specified poolId
  const poolParams = await diva.getPoolParameters(poolId);

  // Check conditions
  checkConditions(
    poolParams.dataProvider,
    divaOracleTellorAddress,
    poolParams.expiryTime
  );

  // Get fee params
  const feesParams = await diva.getFees(poolParams.indexFees);

  // Get current tips and fees from DIVA for reporting the value
  await getReward(divaOracleTellor, poolId, poolParams, feesParams);

  // Prepare Tellor value submission
  const [queryData, queryId] = getQueryDataAndId(poolId, divaAddress, chainId);

  // Prepare values and submit to tellor contract
  const finalReferenceValue = parseUnits("25001");
  const collateralToUSDRate = parseUnits("1.00");
  const oracleValue = encodeOracleValue(
    finalReferenceValue,
    collateralToUSDRate
  );

  // Submit value to Tellor contract
  const tx = await tellor
    .connect(reporter)
    .submitValue(queryId, oracleValue, 0, queryData);
  await tx.wait();

  // Check that timestamp and values have been set in tellor contract
  const tellorDataTimestamp =
    tellorVersion == TELLOR_VERSION.PLAYGROUND
      ? await tellor.timestamps(queryId, 0)
      : await tellor.getTimestampbyQueryIdandIndex(queryId, 0);
  const tellorValue =
    tellorVersion == TELLOR_VERSION.PLAYGROUND
      ? await tellor.values(queryId, tellorDataTimestamp)
      : await tellor.getCurrentValue(queryId);
  const formattedTellorValue = decodeOracleValue(tellorValue);

  // Log relevant information
  console.log("DIVA address: ", diva.address);
  console.log("Tellor adapter address: ", divaOracleTellor.address);
  console.log("Tellor playground address: ", tellor.address);
  console.log("PoolId: ", poolId);
  console.log("Reporter address: " + reporter.address);
  console.log("queryId", queryId);
  console.log("queryData", queryData);
  console.log(
    "tellorDataTimestamp: ",
    tellorDataTimestamp.toString() +
      " (" +
      new Date(poolParams.expiryTime * 1000).toLocaleString() +
      ")"
  );
  console.log(
    "finalReferenceValue: ",
    formattedTellorValue[0].toString() +
      " (" +
      formatUnits(formattedTellorValue[0].toString()) +
      ")"
  );
  console.log(
    "collateralToUSDRate: ",
    formattedTellorValue[1].toString() +
      " (" +
      formatUnits(formattedTellorValue[1].toString()) +
      ")"
  );
}

const checkConditions = (
  poolDataProvider,
  divaOracleTellorAddress,
  poolExpiryTime
) => {
  // Check that the DIVA Tellor oracle is the data provider for the selected pool
  if (poolDataProvider != divaOracleTellorAddress) {
    throw new Error("Data provider is not DIVAOracleTellor address");
  }

  // Confirm that the pool expired
  const currentTime = new Date();
  if (Number(poolExpiryTime) * 1000 > currentTime) {
    throw new Error("Pool is not expired yet");
  }
};

const getReward = async (divaOracleTellor, poolId, poolParams, feesParams) => {
  // Get tips
  const tippingTokens = (
    await divaOracleTellor.getTippingTokens([
      { poolId, startIndex: 0, endIndex: 1 },
    ])
  )[0];
  if (!(tippingTokens.length == 1 && tippingTokens[0] == ethers.constants.AddressZero)) {
    await Promise.all(
      tippingTokens.map(async (tippingToken) =>
        console.log(
          `Tips for ${tippingToken} is: `,
          (
            await divaOracleTellor.getTipAmounts([
              { poolId, tippingTokens: [tippingToken] },
            ])
          )[0][0].toString()
        )
      )
    );
  } else {
    console.log("No tips for this pool on DivaOracleTellor contract yet");
  }

  const collateralTokenContract = await ethers.getContractAt(
    "MockERC20",
    poolParams.collateralToken
  );
  const decimals = await collateralTokenContract.decimals();

  // Estimate fee claim on DIVA contract after set final reference value
  const [settlementFee] = calcSettlementFee(
    poolParams.collateralBalance,
    feesParams.settlementFee,
    decimals
  );
  console.log("Settlement fee: ", formatUnits(settlementFee.mul(100)) + "%");
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
