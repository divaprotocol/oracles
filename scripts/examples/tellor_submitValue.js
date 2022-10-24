/**
 * Script to submit a value to the tellor playground. Make sure you run this script after the pool expired.
 * Note that one address can only submit one value. It will fail if you try to submit a value with the same address again.
 * Run: `yarn tellor:submitValue`
 */

const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = require("@ethersproject/units");

const ERC20_ABI = require("../../contracts/abi/ERC20.json");
const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const TELLOR_PLAYGROUND_ABI = require("../../contracts/abi/TellorPlayground.json");

const {
  addresses,
  tellorPlaygroundAddresses,
  divaTellorOracleAddresses,
} = require("../../utils/constants");

const {
  calcFee,
  encodeToOracleValue,
  decodeTellorValue,
  getQueryDataAndId,
} = require("../../utils");

const checkConditions = (
  poolDataProvider,
  divaOracleTellorAddress,
  poolExpiryTime
) => {
  // Check that the DIVA Tellor oracle is the data provider
  if (poolDataProvider != divaOracleTellorAddress) {
    throw new Error("Data provider is not DIVAOracleTellor address");
  }

  // Confirm that the pool expired
  const currentTime = new Date();
  if (Number(poolExpiryTime) * 1000 > currentTime) {
    throw new Error("Pool is not expired yet");
  }
};

const estimateRewards = async (
  divaOracleTellor,
  poolId,
  poolParams,
  feesParams
) => {
  // Get tips
  const tippingTokens = await divaOracleTellor.getTippingTokens(poolId);
  if (tippingTokens.length) {
    await Promise.all(
      tippingTokens.map(async (tippingToken) =>
        console.log(
          `Tips for ${tippingToken} is: `,
          await divaOracleTellor.getTips(poolId, tippingToken)
        )
      )
    );
  } else {
    console.log("No tips for this pool on DivaOracleTellor contract yet");
  }

  const collateralTokenContract = await ethers.getContractAt(
    ERC20_ABI,
    poolParams.collateralToken
  );
  const decimals = await collateralTokenContract.decimals();

  // Estimate fee claim on DIVA contract after set final reference value
  const settlementFee = calcFee(
    feesParams.settlementFee,
    poolParams.collateralBalance,
    decimals
  );
  console.log("Settlement fee: ", settlementFee);
};

async function main() {
  // INPUT: network
  const network = "goerli";

  const divaAddress = addresses[network];
  const tellorPlaygroundAddress = tellorPlaygroundAddresses[network];
  const divaOracleTellorAddress = divaTellorOracleAddresses[network];

  // INPUT: id of pool
  const poolId = 4;

  // Get chain id
  const chainId = (await ethers.provider.getNetwork()).chainId;

  // Get signer of reporter
  const [reporter] = await ethers.getSigners();
  console.log("Reporter address: " + reporter.address);

  // Connect to DIVA contract
  const diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
  console.log("DIVA address: ", diva.address);

  // Connect to DIVAOracleTellor contract
  const divaOracleTellor = await ethers.getContractAt(
    "DIVAOracleTellor",
    divaOracleTellorAddress
  );
  console.log("DIVAOracleTellor address: ", divaOracleTellor.address);

  // Connect to tellor contract
  const tellorPlayground = await ethers.getContractAt(
    TELLOR_PLAYGROUND_ABI,
    tellorPlaygroundAddress
  );
  console.log("Tellor address: ", tellorPlayground.address);

  // Get pool parameters for the specified poolId
  const poolParams = await diva.getPoolParameters(poolId);

  // Check conditions
  checkConditions(
    poolParams.dataProvider,
    divaOracleTellor.address,
    poolParams.expiryTime
  );

  // Get fee params
  const feesParams = await diva.getFees(poolId);
  // Get tips and estimate fees from DIVA after set final reference value
  await estimateRewards(divaOracleTellor, poolId, poolParams, feesParams);

  // Prepare Tellor value submission
  const [queryData, queryId] = getQueryDataAndId(poolId, divaAddress, chainId);
  console.log("queryId", queryId);

  // Prepare values and submit to tellorPlayground
  const finalReferenceValue = parseUnits("25000");
  const collateralToUSDRate = parseUnits("1.00");
  const oracleValue = encodeToOracleValue(
    finalReferenceValue,
    collateralToUSDRate
  );

  // Submit value to tellorPlayground
  const tx = await tellorPlayground
    .connect(reporter)
    .submitValue(queryId, oracleValue, 0, queryData);
  await tx.wait();

  // Check that timestamp and values have been set in tellorPlayground contract
  const tellorDataTimestamp = await tellorPlayground.timestamps(queryId, 0);
  const tellorValue = await tellorPlayground.values(
    queryId,
    tellorDataTimestamp
  );
  const formattedTellorValue = decodeTellorValue(tellorValue);
  console.log("poolId: ", poolId);
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
