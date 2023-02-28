const { expect } = require("chai");
const { ethers } = require("hardhat");
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

const {
  erc20AttachFixture,
  erc20DeployFixture,
} = require("./fixtures/MockERC20Fixture");

const network = "apothem"; // for tellorPlayground address; should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 6;

describe("DIVAGoplugin", () => {
  let collateralTokenInstance;
  let user1, user2, user3, reporter;

  let divaGoplugin;
  let divaAddress = DIVA_ADDRESS[network];
  let pliAddress = PLI_ADDRESS[network];
  let pliToken;

  let minPeriodUndisputed;
  let feePerRequest;

  let poolId;
  let poolParams;
  let feesParams;

  let finalReferenceValue;

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
    expect(await divaGoplugin.getPLIAddress()).to.eq(pliAddress);
    minPeriodUndisputed = await divaGoplugin.getMinPeriodUndisputed();
    expect(minPeriodUndisputed).to.eq(ONE_HOUR * 12);
    feePerRequest = await divaGoplugin.getFeePerRequest();
    expect(feePerRequest).to.eq(parseUnits("0.1"));

    // Get PLI token instance
    pliToken = await erc20AttachFixture(pliAddress);

    // Transfer PLI token to user1
    const ownerPLIBalance = await pliToken.balanceOf(owner.address);
    expect(ownerPLIBalance).to.gt(0);
    await pliToken
      .connect(owner)
      .transfer(user1.address, ownerPLIBalance.div(2));

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
    await collateralTokenInstance
      .connect(user1)
      .approve(diva.address, userStartTokenBalance);

    // Create an expired contingent pool that uses Tellor as the data provider
    const tx = await createContingentPool();
    const receipt = await tx.wait();

    poolId = receipt.events?.find((x) => x.event === "PoolIssued")?.args
      ?.poolId;
    poolParams = await diva.getPoolParameters(poolId);

    feesParams = await diva.getFees(poolParams.indexFees);
  });

  // Function to create contingent pools pre-populated with default values that can be overwritten depending on the test case
  const createContingentPool = async ({
    referenceAsset = "0x21046D8b5B4ad1e95292A8F37626848c0e116aeB", // Goplugin Feed for XDC/USDT
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
    return await diva.connect(user1).createContingentPool({
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

  describe("requestFinalReferenceValue", async () => {
    it("Should request final reference value to DIVAGoplugin", async () => {
      // ---------
      // Arrange: Check that there's no request for final reference value
      // ---------
      expect(await divaGoplugin.getLastRequestedBlocktimestamp(poolId)).to.eq(
        0
      );
      await pliToken
        .connect(user1)
        .approve(divaGoplugin.address, feePerRequest);

      // ---------
      // Act: Call `requestFinalReferenceValue` function
      // ---------
      await divaGoplugin.connect(user1).requestFinalReferenceValue(poolId);

      // ---------
      // Assert: Check that final reference value is requested
      // ---------
      expect(await divaGoplugin.getLastRequestedBlocktimestamp(poolId)).to.eq(
        await getLastBlockTimestamp()
      );
      expect(await divaGoplugin.getRequester(poolId)).to.eq(user1.address);
    });
  });

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
