const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const {
  getLastBlockTimestamp,
  setNextBlockTimestamp,
  getCurrentTimestampInSeconds,
} = require("../utils/utils");
const {
  ONE_HOUR,
  ONE_DAY,
  TEN_MINS,
  DIVA_ADDRESS,
  PLI_ADDRESS,
} = require("../utils/constants"); //  DIVA Protocol v1.0.0

const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture");

const collateralTokenDecimals = 6;
const tippingTokenDecimals = 6;

const calcSettlementFee = (
  collateralBalance, // Basis for fee calcuation
  fee, // Settlement fee percent expressed as an integer with 18 decimals
  collateralTokenDecimals,
  collateralToUSDRate = parseUnits("0") // USD value of one unit of collateral token
) => {
  // Fee amount in collateral token decimals
  feeAmount = collateralBalance.mul(fee).div(parseUnits("1"));

  // Fee amount in USD expressed as integer with 18 decimals
  feeAmountUSD = feeAmount
    .mul(parseUnits("1", 18 - collateralTokenDecimals))
    .mul(collateralToUSDRate)
    .div(parseUnits("1"));

  return [
    feeAmount, // expressed as integer with collateral token decimals
    feeAmountUSD, // expressed as integer with 18 decimals
  ];
};

const encodeOracleValue = (finalReferenceValue, collateralToUSDRate) => {
  return new ethers.utils.AbiCoder().encode(
    ["uint256", "uint256"],
    [finalReferenceValue, collateralToUSDRate]
  );
};

const decodeOracleValue = (tellorValue) => {
  return new ethers.utils.AbiCoder().decode(
    ["uint256", "uint256"],
    tellorValue
  );
};

const getQueryDataAndId = (latestPoolId, divaAddress, chainId) => {
  const abiCoder = new ethers.utils.AbiCoder();
  const queryDataArgs = abiCoder.encode(
    ["uint256", "address", "uint256"],
    [latestPoolId, divaAddress, chainId]
  );
  const queryData = abiCoder.encode(
    ["string", "bytes"],
    ["DIVAProtocol", queryDataArgs]
  );
  const queryId = ethers.utils.keccak256(queryData);
  return [queryData, queryId];
};

describe("DIVAGoplugin", () => {
  let collateralTokenInstance;
  let user1, user2, user3, reporter, excessFeeRecipient, tipper1, tipper2;

  let divaGoplugin;
  let tellorPlayground;
  let divaAddress = DIVA_ADDRESS[network.name];
  let pliAddress = PLI_ADDRESS[network.name];

  let activationDelay;
  let maxFeeAmountUSD = parseUnits("10");

  let minPeriodUndisputed;

  let latestPoolId;
  let poolParams;
  let feesParams;

  let tippingToken1;
  let tippingToken2;
  let tippingAmount1;
  let tippingAmount2;

  let chainId;
  let finalReferenceValue, collateralToUSDRate;
  let queryData, queryId, oracleValue;

  let nextBlockTimestamp;

  before(async () => {
    [owner, user1, user2, user3, reporter] = await ethers.getSigners();

    // Get DIVA contract
    diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
    // Check the owner of DIVA contract
    expect(await diva.getOwner()).to.eq(owner.address);

    // Deploy DIVAGoplugin contract
    const divaGopluginFactory = await ethers.getContractFactory(
      "DIVAGoplugin"
    );
    divaGoplugin = await divaGopluginFactory.deploy(divaAddress, pliAddress);

    // Check initial params
    expect(await divaGoplugin.getChallengeable()).to.eq(false);
    expect(await divaGoplugin.getDIVAAddress()).to.eq(divaAddress);

    // Get `minPeriodUndisputed`
    minPeriodUndisputed = await divaGoplugin.getMinPeriodUndisputed();
    expect(minPeriodUndisputed).to.eq(ONE_HOUR * 12);

    // Set user start token balance
    const userStartTokenBalance = parseUnits("1000000");

    // Deploy collateral token and approve it to DIVA contract
    collateralTokenInstance = await erc20DeployFixture(
      "DummyToken",
      "DCT",
      userStartTokenBalance,
      user1.address,
      collateralTokenDecimals
    );
    await collateralTokenInstance.approve(diva.address, userStartTokenBalance);

    // Create an expired contingent pool that uses Tellor as the data provider
    const tx = await createContingentPool();
    const receipt = await tx.wait();

    latestPoolId = receipt.events?.find((x) => x.event === "PoolIssued")?.args
      ?.poolId;
    poolParams = await diva.getPoolParameters(latestPoolId);

    feesParams = await diva.getFees(poolParams.indexFees);

    // Get chain id
    chainId = (await ethers.provider.getNetwork()).chainId;
  });

  // Function to create contingent pools pre-populated with default values that can be overwritten depending on the test case
  const createContingentPool = async ({
    referenceAsset = "BTC/USD", // reference asset
    expireInSeconds = TEN_MINS, // expiryTime
    floor = 40000, // floor
    inflection = 60000, // inflection
    cap = 80000, // cap
    gradient = 0.7, // gradient
    collateralAmount = 100, // collateral amount
    collateralToken = collateralTokenInstance.address, // collateral token
    dataProvider = divaGoplugin.address, // data provider
    capacity = 200, // capacity
    longRecipient = user1.address, // longRecipient
    shortRecipient = user1.address, // shortRecipient
    permissionedERC721Token = ethers.constants.AddressZero,
  } = {}) => {
    return await diva.createContingentPool({
      referenceAsset,
      expiryTime: (await getLastBlockTimestamp()) + expireInSeconds,
      floor: parseUnits(floor.toString()),
      inflection: parseUnits(inflection.toString()),
      cap: parseUnits(cap.toString()),
      gradient: parseUnits(gradient.toString(), collateralTokenDecimals),
      collateralAmount: parseUnits(
        collateralAmount.toString(),
        collateralTokenDecimals
      ),
      collateralToken,
      dataProvider,
      capacity: parseUnits(capacity.toString(), collateralTokenDecimals),
      longRecipient,
      shortRecipient,
      permissionedERC721Token,
    });
  };

  // describe("requestFinalReferenceValue", async () => {
  //   it("Should request final reference value to DIVAGoplugin", async () => {
  //     // ---------
  //     // Arrange: Check that there's no tip added for latestPoolId
  //     // ---------
  //     expect(
  //       (
  //         await divaGoplugin.getTipAmounts([
  //           { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
  //         ])
  //       )[0][0]
  //     ).to.eq(0);
  //     expect(await tippingToken1.balanceOf(divaGoplugin.address)).to.eq(0);

  //     // ---------
  //     // Act: Add tip
  //     // ---------
  //     await divaGoplugin
  //       .connect(tipper1)
  //       .addTip(latestPoolId, tippingAmount1, tippingToken1.address);

  //     // ---------
  //     // Assert: Check that tip is added on divaGoplugin correctly
  //     // ---------
  //     expect(
  //       (
  //         await divaGoplugin.getTipAmounts([
  //           { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
  //         ])
  //       )[0][0]
  //     ).to.eq(tippingAmount1);
  //     expect(await tippingToken1.balanceOf(divaGoplugin.address)).to.eq(
  //       tippingAmount1
  //     );
  //   });
  // });

  // describe("setFinalReferenceValue", async () => {
  //   it("Should set a reported Tellor value as the final reference value in DIVA Protocol and leave tips and fee claims in DIVA unclaimed", async () => {
  //     // ---------
  //     // Arrange: Confirm params and submit values to tellorPlayground
  //     // ---------
  //     // Get tips and balances for tippingToken1
  //     expect(
  //       (
  //         await divaGoplugin.getTipAmounts([
  //           { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
  //         ])
  //       )[0][0]
  //     ).to.eq(tippingAmount1);
  //     expect(await tippingToken1.balanceOf(divaGoplugin.address)).to.eq(
  //       tippingAmount1
  //     );
  //     expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

  //     // Get tips and balances for tippingToken2
  //     expect(
  //       (
  //         await divaGoplugin.getTipAmounts([
  //           { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
  //         ])
  //       )[0][0]
  //     ).to.eq(tippingAmount2);
  //     expect(await tippingToken2.balanceOf(divaGoplugin.address)).to.eq(
  //       tippingAmount2
  //     );
  //     expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

  //     // Check collateral token balance for reporter
  //     expect(await collateralTokenInstance.balanceOf(reporter.address)).to.eq(
  //       0
  //     );

  //     // Check finalReferenceValue and statusFinalReferenceValue in DIVA Protocol
  //     expect(poolParams.finalReferenceValue).to.eq(0);
  //     expect(poolParams.statusFinalReferenceValue).to.eq(0);

  //     // Prepare value submission to tellorPlayground
  //     finalReferenceValue = parseUnits("42000");
  //     collateralToUSDRate = parseUnits("1.14");
  //     oracleValue = encodeOracleValue(
  //       finalReferenceValue,
  //       collateralToUSDRate
  //     );

  //     // Submit value to Tellor playground contract
  //     nextBlockTimestamp = poolParams.expiryTime.add(1);
  //     await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
  //     await tellorPlayground
  //       .connect(reporter)
  //       .submitValue(queryId, oracleValue, 0, queryData);

  //     // Calculate settlement fee expressed in collateral token
  //     const [settlementFeeAmount] = calcSettlementFee(
  //       poolParams.collateralBalance,
  //       feesParams.settlementFee,
  //       collateralTokenDecimals,
  //       collateralToUSDRate
  //     );

  //     // ---------
  //     // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor
  //     // contract after exactly `minPeriodUndisputed` period has passed
  //     // ---------
  //     nextBlockTimestamp =
  //       (await getLastBlockTimestamp()) + minPeriodUndisputed;
  //     await setNextBlockTimestamp(nextBlockTimestamp);
  //     await divaGoplugin
  //       .connect(user2)
  //       .setFinalReferenceValue(latestPoolId, [], false);

  //     // ---------
  //     // Assert: Confirm that finalReferenceValue, statusFinalReferenceValue and feeClaim in DIVA Protocol are updated
  //     // but tipping token and collateral token balances remain unchanged
  //     // ---------
  //     // Check that finalReferenceValue and statusFinalReferenceValue are updated in DIVA Protocol
  //     poolParams = await diva.getPoolParameters(latestPoolId);
  //     expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
  //     expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

  //     // Check that the fee claim was allocated to the reporter in DIVA Protocol
  //     expect(
  //       await diva.getClaim(collateralTokenInstance.address, reporter.address)
  //     ).to.eq(settlementFeeAmount);

  //     // Check that tips and balances for tippinToken1 are unchanged
  //     expect(
  //       (
  //         await divaGoplugin.getTipAmounts([
  //           { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
  //         ])
  //       )[0][0]
  //     ).to.eq(tippingAmount1);
  //     expect(await tippingToken1.balanceOf(divaGoplugin.address)).to.eq(
  //       tippingAmount1
  //     );
  //     expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

  //     // Check that tips and balances for tippinToken2 are unchanged
  //     expect(
  //       (
  //         await divaGoplugin.getTipAmounts([
  //           { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
  //         ])
  //       )[0][0]
  //     ).to.eq(tippingAmount2);
  //     expect(await tippingToken2.balanceOf(divaGoplugin.address)).to.eq(
  //       tippingAmount2
  //     );
  //     expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

  //     // Check that the reporter's collateral token balance is unchanged (as the DIVA fee claim resides inside DIVA Protocol)
  //     expect(await collateralTokenInstance.balanceOf(reporter.address)).to.eq(
  //       0
  //     );

  //     // Check that pool id is added to `reporterToPoolIds`
  //     expect(
  //       (
  //         await divaGoplugin.getPoolIdsLengthForReporters([reporter.address])
  //       )[0]
  //     ).to.eq(1);
  //     expect(
  //       (
  //         await divaGoplugin.getPoolIdsForReporters([
  //           { reporter: reporter.address, startIndex: 0, endIndex: 2 },
  //         ])
  //       )[0][0]
  //     ).to.eq(latestPoolId);
  //   });
  // });
});
