const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const {
  calcSettlementFee,
  encodeOracleValue,
  decodeOracleValue,
  getQueryDataAndId,
  getLastBlockTimestamp,
  setNextBlockTimestamp,
} = require("../utils/utils");
const {
  ONE_HOUR,
  ONE_DAY,
  TEN_MINS,
  DIVA_ADDRESS,
  TELLOR_PLAYGROUND_ADDRESS,
} = require("../utils/constants"); //  DIVA Protocol v1.0.0

const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture");

const network = "goerli"; // for tellorPlayground address; should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 6;
const tippingTokenDecimals = 6;

describe("DIVAOracleTellor", () => {
  let collateralTokenInstance;
  let user1,
    user2,
    user3,
    divaOracleTellorOwner,
    reporter,
    excessDIVARewardRecipient,
    tipper;

  let divaOracleTellorFactory;
  let divaOracleTellor;
  let tellorPlayground;
  let tellorPlaygroundAddress = TELLOR_PLAYGROUND_ADDRESS[network];
  let divaAddress = DIVA_ADDRESS[network];
  let divaOwnershipAddress;

  let activationDelay;
  let maxDIVARewardUSD = parseUnits("10");

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
  let excessDIVARewardRecipientInfo;
  let maxDIVARewardUSDInfo;
  let poolId1, poolId2;

  before(async () => {
    [
      user1,
      user2,
      user3,
      divaOracleTellorOwner,
      reporter,
      excessDIVARewardRecipient,
      tipper,
    ] = await ethers.getSigners();

    // Reset block
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber: hre.config.networks.hardhat.forking.blockNumber,
          },
        },
      ],
    });

    // Get TellorPlayground contract
    tellorPlayground = await ethers.getContractAt(
      "TellorPlayground",
      tellorPlaygroundAddress
    );

    // Get DIVA contract
    diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
    // Confirm that user1 is the owner of DIVA contract
    expect(await diva.getOwner()).to.eq(user1.address);

    // Get DIVA ownership contract address
    divaOwnershipAddress = await diva.getOwnershipContract();
  });

  beforeEach(async () => {
    // Deploy DIVAOracleTellor contract
    divaOracleTellorFactory = await ethers.getContractFactory(
      "DIVAOracleTellor"
    );
    divaOracleTellor = await divaOracleTellorFactory.deploy(
      divaOwnershipAddress,
      tellorPlaygroundAddress,
      excessDIVARewardRecipient.address,
      maxDIVARewardUSD,
      divaAddress
    );
    // Check challengeable
    expect(await divaOracleTellor.getChallengeable()).to.eq(false);

    // Check ownership contract address
    expect(await divaOracleTellor.getOwnershipContract()).to.eq(
      divaOwnershipAddress
    );

    // Get `minPeriodUndisputed`
    minPeriodUndisputed = await divaOracleTellor.getMinPeriodUndisputed();
    expect(minPeriodUndisputed).to.eq(ONE_HOUR * 12);

    // Get activation delay
    activationDelay = await divaOracleTellor.getActivationDelay();
    expect(activationDelay).to.eq(3 * ONE_DAY);

    // Set user start token balance
    const userStartTokenBalance = parseUnits("1000000");

    // Deploy collateral token and approve it to DIVA contract
    collateralTokenInstance = await erc20DeployFixture(
      "DummyToken",
      "DCT",
      userStartTokenBalance,
      user1.address,
      collateralTokenDecimals,
      "0"
    );
    await collateralTokenInstance.approve(diva.address, userStartTokenBalance);

    // Create an expired contingent pool that uses Tellor as the data provider
    const tx = await createContingentPool();
    const receipt = await tx.wait();
    latestPoolId = receipt.events?.find((x) => x.event === "PoolIssued")?.args
      ?.poolId; // @todo consider renaming
    poolParams = await diva.getPoolParameters(latestPoolId);

    feesParams = await diva.getFees(poolParams.indexFees);

    // Get chain id
    chainId = (await ethers.provider.getNetwork()).chainId;

    // Prepare Tellor value submission
    [queryData, queryId] = getQueryDataAndId(
      latestPoolId,
      divaAddress,
      chainId
    );
    const [queryDataFromContract, queryIdFromContract] =
      await divaOracleTellor.getQueryDataAndId(latestPoolId);
    expect(queryData).to.eq(queryDataFromContract);
    expect(queryId).to.eq(queryIdFromContract);

    // Deploy tipping tokens
    tippingToken1 = await erc20DeployFixture(
      "TippingToken1",
      "TPT1",
      userStartTokenBalance,
      tipper.address,
      tippingTokenDecimals,
      "0"
    );
    tippingToken2 = await erc20DeployFixture(
      "TippingToken2",
      "TPT2",
      userStartTokenBalance,
      tipper.address,
      tippingTokenDecimals,
      "0"
    );
    
    // Set tipping amounts
    tippingAmount1 = parseUnits("1000", tippingTokenDecimals);
    tippingAmount2 = parseUnits("2000", tippingTokenDecimals);
    expect(tippingAmount1).to.not.eq(0);
    expect(tippingAmount2).to.not.eq(0);
    expect(tippingAmount2).to.not.eq(tippingAmount1);

    // Approve tipping tokens to DIVAOracleTellor with address
    await tippingToken1
      .connect(tipper)
      .approve(divaOracleTellor.address, ethers.constants.MaxUint256);
    await tippingToken2
      .connect(tipper)
      .approve(divaOracleTellor.address, ethers.constants.MaxUint256);
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
    dataProvider = divaOracleTellor.address, // data provider
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

  describe("setFinalReferenceValue", async () => {
    beforeEach(async () => {
      // Add tips on DIVAOracleTellor
      await divaOracleTellor.connect(tipper).batchAddTip([
        {
          poolId: latestPoolId,
          amount: tippingAmount1,
          tippingToken: tippingToken1.address,
        },
        {
          poolId: latestPoolId,
          amount: tippingAmount2,
          tippingToken: tippingToken2.address,
        },
      ]);
    });

    describe("Only set final reference value", async () => {
      it("Should add a value to TellorPlayground", async () => {
        // ---------
        // Arrange: Prepare values and submit to tellorPlayground
        // ---------
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );

        // ---------
        // Act: Submit value to tellorPlayground
        // ---------
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // ---------
        // Assert: Check that timestamp and values have been set in tellorPlayground contract
        // ---------
        lastBlockTimestamp = await getLastBlockTimestamp();
        const tellorDataTimestamp = await tellorPlayground.timestamps(
          queryId,
          0
        );
        const tellorValue = await tellorPlayground.values(
          queryId,
          tellorDataTimestamp
        );
        const formattedTellorValue = decodeOracleValue(tellorValue);
        expect(tellorDataTimestamp).to.eq(lastBlockTimestamp);
        expect(formattedTellorValue[0]).to.eq(finalReferenceValue);
        expect(formattedTellorValue[1]).to.eq(collateralToUSDRate);
      });

      it("Should set a reported Tellor value as the final reference value in DIVA Protocol and leave tips and DIVA reward claims unclaimed", async () => {
        // ---------
        // Arrange: Confirm params and submit values to tellorPlayground
        // ---------
        // Get tips and balances for tippingToken1
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Get tips and balances for tippingToken2
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check collateral token balance for reporter
        expect(
          await collateralTokenInstance.balanceOf(reporter.address)
        ).to.eq(0);

        // Check finalReferenceValue and statusFinalReferenceValue in DIVA Protocol
        expect(poolParams.finalReferenceValue).to.eq(0);
        expect(poolParams.statusFinalReferenceValue).to.eq(0);

        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );

        // Submit value to Tellor playground contract
        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in collateral token
        const [settlementFeeAmount] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        );

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId, [], false);

        // ---------
        // Assert: Confirm that finalReferenceValue, statusFinalReferenceValue and reward claim in DIVA Protocol are updated
        // but tipping token and collateral token balances remain unchanged
        // ---------
        // Check that finalReferenceValue and statusFinalReferenceValue are updated in DIVA Protocol
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
        expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

        // Check that the DIVA reward claim was allocated to the reporter in DIVA Protocol
        expect(
          await diva.getClaim(
            collateralTokenInstance.address,
            reporter.address
          )
        ).to.eq(settlementFeeAmount);

        // Check that tips and balances for tippingToken1 are unchanged
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Check that tips and balances for tippingToken2 are unchanged
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check that the reporter's collateral token balance is unchanged (as the DIVA reward claim resides inside DIVA Protocol)
        expect(
          await collateralTokenInstance.balanceOf(reporter.address)
        ).to.eq(0);

        // Check that poolId is added to `reporterToPoolIds`
        expect(
          (
            await divaOracleTellor.getPoolIdsLengthForReporters([
              reporter.address,
            ])
          )[0]
        ).to.eq(1);
        expect(
          (
            await divaOracleTellor.getPoolIdsForReporters([
              { reporter: reporter.address, startIndex: 0, endIndex: 2 },
            ])
          )[0][0]
        ).to.eq(latestPoolId);
      });

      it("Should take the second value if the first one was submitted before expiryTime and the second one afterwards", async () => {
        // ---------
        // Arrange: Prepare the submission to tellorPlayground and submit two values, one before and one after expiration
        // ---------

        // First reporter submission prior to expiration
        finalReferenceValue1 = parseUnits("42000");
        collateralToUSDRate1 = parseUnits("1.14");
        oracleValue1 = encodeOracleValue(
          finalReferenceValue1,
          collateralToUSDRate1
        );
        nextBlockTimestamp = poolParams.expiryTime.sub(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue1, 0, queryData);

        // Second reporter submission after expiration
        finalReferenceValue2 = parseUnits("42500");
        collateralToUSDRate2 = parseUnits("1.15");
        oracleValue2 = encodeOracleValue(
          finalReferenceValue2,
          collateralToUSDRate2
        );
        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue2, 0, queryData);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed` has passed
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed; // has to be `minPeriodDisputed` after the time of the second submission (assumed to be 1 second after expiration)
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId, [], false);

        // ---------
        // Assert: Confirm that the second value was set as the final
        // ---------
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(await poolParams.statusFinalReferenceValue).to.eq(3);
        expect(await poolParams.finalReferenceValue).to.eq(
          finalReferenceValue2
        );
      });

      it("Should take the second value if the first one was disputed", async () => {
        // ---------
        // Arrange: Prepare the submission to tellorPlayground and submit two values, begin dispute for first one
        // ---------

        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());

        // First reporter submission
        finalReferenceValue1 = parseUnits("42000");
        collateralToUSDRate1 = parseUnits("1.14");
        oracleValue1 = encodeOracleValue(
          finalReferenceValue1,
          collateralToUSDRate1
        );
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue1, 0, queryData);

        // Begin dispute for the first submission
        await tellorPlayground.beginDispute(queryId, nextBlockTimestamp);
        expect(
          await tellorPlayground.isInDispute(queryId, nextBlockTimestamp)
        ).to.eq(true);

        // Second reporter submission
        finalReferenceValue2 = parseUnits("42500");
        collateralToUSDRate2 = parseUnits("1.15");
        oracleValue2 = encodeOracleValue(
          finalReferenceValue2,
          collateralToUSDRate2
        );
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue2, 0, queryData);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed` has passed
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed; // has to be `minPeriodDisputed` after the time of the second submission (assumed to be 1 second after expiration)
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId, [], false);

        // ---------
        // Assert: Confirm that the second value was set as the final
        // ---------
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(await poolParams.statusFinalReferenceValue).to.eq(3);
        expect(await poolParams.finalReferenceValue).to.eq(
          finalReferenceValue2
        );
      });

      it("Allocates all the DIVA reward to reporter if it is below maxDIVARewardUSD", async () => {
        // ---------
        // Arrange: Confirm that user1's DIVA reward claim balance is zero, report value and calculate USD denominated DIVA reward
        // ---------
        // Confirm that user1's DIVA reward claim balance is zero
        expect(
          await diva.getClaim(collateralTokenInstance.address, user1.address)
        ).to.eq(0);

        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );

        // Submit value to Tellor playground contract
        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in collateral token and USD denominated fee
        const [settlementFeeAmount, settlementFeeAmountUSD] =
          calcSettlementFee(
            poolParams.collateralBalance,
            feesParams.settlementFee,
            collateralTokenDecimals,
            collateralToUSDRate
          );
        expect(settlementFeeAmountUSD).to.be.lte(maxDIVARewardUSD);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed`
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId, [], false);

        // ---------
        // Assert: Confirm that the reporter receives the full DIVA reward payment (in collateral asset) and 0 goes to excess DIVA reward recipient
        // ---------
        expect(
          await diva.getClaim(
            collateralTokenInstance.address,
            reporter.address
          )
        ).to.eq(settlementFeeAmount);
        expect(
          await diva.getClaim(
            collateralTokenInstance.address,
            excessDIVARewardRecipient.address
          )
        ).to.eq(0);
      });

      it("Should split the DIVA reward between reporter and excess DIVA reward recipient if DIVA reward exceeds maxDIVARewardUSD", async () => {
        // ---------
        // Arrange: Create a contingent pool where DIVA reward exceeds maxDIVARewardUSD
        // ---------
        const tx = await createContingentPool({
          collateralAmount: 100000,
          capacity: 200000,
        });
        const receipt = await tx.wait();

        latestPoolId = receipt.events?.find((x) => x.event === "PoolIssued")
          ?.args?.poolId;
        poolParams = await diva.getPoolParameters(latestPoolId);

        // Prepare value submission to tellorPlayground
        // Re-construct as latestPoolId changed in this test
        [queryData, queryId] = getQueryDataAndId(
          latestPoolId,
          divaAddress,
          chainId
        );

        // Report value to tellor playground
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in both collateral token and USD.
        // Note that DIVA reward = settlement fee as no tips are added in this test case.
        const [feeAmount, feeAmountUSD] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        ); // feeAmount is expressed as an integer with collateral token decimals and feeAmountUSD with 18 decimals

        // Confirm that implied USD value of fee exceeds maxDIVARewardUSD
        expect(feeAmountUSD).to.be.gte(maxDIVARewardUSD);

        // Calc max DIVA reward in collateral token
        const maxDIVAReward = maxDIVARewardUSD
          .mul(parseUnits("1"))
          .div(collateralToUSDRate)
          .div(parseUnits("1", 18 - collateralTokenDecimals)); // in collateral token decimals

        // Get reporter's and excess recipient's DIVA reward claim before the final reference value is set
        const divaRewardClaimReporterBefore = await diva.getClaim(
          collateralTokenInstance.address,
          reporter.address
        );
        const divaRewardClaimExcessDIVARewardRecipientBefore = await diva.getClaim(
          collateralTokenInstance.address,
          excessDIVARewardRecipient.address
        );
        expect(divaRewardClaimReporterBefore).to.eq(0);
        expect(divaRewardClaimExcessDIVARewardRecipientBefore).to.eq(0);

        // Set random user that is going to trigger the `setFinalReferenceValue` function after the value
        // has been submitted to the Tellor contract and confirm that the DIVA reward claim balance is zero
        const randomUser = user3;
        const divaRewardClaimRandomUserBefore = await diva.getClaim(
          collateralTokenInstance.address,
          randomUser.address
        );
        expect(divaRewardClaimRandomUserBefore).to.eq(0);

        // Confirm that the random user is not the DIVA treasury address
        const governanceParameters = await diva.getGovernanceParameters();
        expect(randomUser).to.not.eq(governanceParameters.treasury);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed`
        // from a random user account
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(randomUser)
          .setFinalReferenceValue(latestPoolId, [], false); // triggered by a random user

        // ---------
        // Assert: Confirm that the reporter and excess recipient are allocated the correct amount of rewards and
        // user2 (who triggered the `setFinalReferenceValue` function) and the DIVAOracleTellor contract are not
        // allocated any rewards
        // ---------
        const divaRewardClaimReporterAfter = await diva.getClaim(
          collateralTokenInstance.address,
          reporter.address
        );
        const divaRewardClaimExcessDIVARewardRecipientAfter = await diva.getClaim(
          collateralTokenInstance.address,
          excessDIVARewardRecipient.address
        );
        const divaRewardClaimRandomUserAfter = await diva.getClaim(
          collateralTokenInstance.address,
          randomUser.address
        );

        expect(divaRewardClaimReporterAfter).to.eq(
          divaRewardClaimReporterBefore.add(maxDIVAReward)
        );
        expect(divaRewardClaimExcessDIVARewardRecipientAfter).to.eq(
          divaRewardClaimExcessDIVARewardRecipientBefore.add(feeAmount.sub(maxDIVAReward))
        );
        expect(divaRewardClaimRandomUserAfter).to.eq(0);
        expect(
          await diva.getClaim(
            collateralTokenInstance.address,
            divaOracleTellor.address
          )
        ).to.eq(0);
      });

      it("Should allocate all fees to reporter if collateralToUSDRate = 0 (should typically be disputed by the Tellor mechanism)", async () => {
        // ---------
        // Arrange: Report zero collateralToUSDRate
        // ---------

        // Report value to tellor playground with collateralToUSDRate = 0
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("0");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in both collateral token and USD.
        // DIVA reward = settlement fee as no tips are added in this test case.
        const [feeAmount] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        ); // feeAmount is expressed as an integer with collateral token decimals and feeAmountUSD with 18 decimals

        // Get reporter's and excess recipient's DIVA reward claim before the final reference value is set
        const divaRewardClaimReporterBefore = await diva.getClaim(
          collateralTokenInstance.address,
          reporter.address
        );
        const divaRewardClaimExcessDIVARewardRecipientBefore = await diva.getClaim(
          collateralTokenInstance.address,
          excessDIVARewardRecipient.address
        );
        expect(divaRewardClaimReporterBefore).to.eq(0);
        expect(divaRewardClaimExcessDIVARewardRecipientBefore).to.eq(0);

        // Set random user that is going to trigger the `setFinalReferenceValue` function after the value
        // has been submitted to the Tellor contract and confirm that the DIVA reward claim balance is zero
        const randomUser = user3;
        const divaRewardClaimRandomUserBefore = await diva.getClaim(
          collateralTokenInstance.address,
          randomUser.address
        );
        expect(divaRewardClaimRandomUserBefore).to.eq(0);

        // Confirm that the random user is not the DIVA treasury address
        const governanceParameters = await diva.getGovernanceParameters();
        expect(randomUser).to.not.eq(governanceParameters.treasury);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed`
        // from a random user account
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(randomUser)
          .setFinalReferenceValue(latestPoolId, [], false); // triggered by a random user

        // ---------
        // Assert: Confirm that the reporter and excess recipient are allocated the correct amount of rewards and
        // user2 (who triggered the `setFinalReferenceValue` function) and the DIVAOracleTellor contract are not
        // allocated any rewards
        // ---------
        const divaRewardClaimReporterAfter = await diva.getClaim(
          collateralTokenInstance.address,
          reporter.address
        );
        const divaRewardClaimExcessDIVARewardRecipientAfter = await diva.getClaim(
          collateralTokenInstance.address,
          excessDIVARewardRecipient.address
        );
        const divaRewardClaimRandomUserAfter = await diva.getClaim(
          collateralTokenInstance.address,
          randomUser.address
        );

        expect(divaRewardClaimReporterAfter).to.eq(feeAmount);
        expect(divaRewardClaimExcessDIVARewardRecipientAfter).to.eq(0);
        expect(divaRewardClaimRandomUserAfter).to.eq(0);
        expect(
          await diva.getClaim(
            collateralTokenInstance.address,
            divaOracleTellor.address
          )
        ).to.eq(0);
      });

      // ---------
      // Reverts
      // ---------
      it("Should revert if called before minPeriodUndisputed", async () => {
        // ---------
        // Arrange: Confirm that finalRereferenceValue and statusFinalReferenceValue are not yet set and submit values to tellorPlayground
        // ---------
        expect(poolParams.finalReferenceValue).to.eq(0);
        expect(poolParams.statusFinalReferenceValue).to.eq(0);
        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );
        // Submit value to Tellor playground contract
        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // ---------
        // Act & Assert: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract shortly after
        // `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed - 1;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await expect(
          divaOracleTellor
            .connect(user2)
            .setFinalReferenceValue(latestPoolId, [], false)
        ).to.be.revertedWith("MinPeriodUndisputedNotPassed()");
      });

      it("Should revert if no value was reported yet", async () => {
        // ---------
        // Arrange: Confirm that no value has been reported yet
        // ---------
        expect(
          await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0)
        ).to.eq(0);

        // ---------
        // Act & Assert: Confirm that `setFinalReferenceValue` function will revert if called when no value has been reported yet
        // ---------
        await expect(
          divaOracleTellor
            .connect(user2)
            .setFinalReferenceValue(latestPoolId, [], false)
        ).to.be.revertedWith("NoOracleSubmissionAfterExpiryTime()");
      });

      it("Should revert if a value has been reported prior to expiryTime only", async () => {
        // ---------
        // Arrange: Submit one value prior to expiration
        // ---------

        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );

        // Submit value to Tellor playground contract
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Confirm that timestamp of reported value is non-zero and smaller than expiryTime
        expect(
          await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0)
        ).not.eq(0);
        expect(
          await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0)
        ).to.be.lt(poolParams.expiryTime);

        // ---------
        // Act & Assert: Confirm that `setFinalReferenceValue`  function will revert if the only value reported is
        // before `expiryTime`
        // ---------
        await expect(
          divaOracleTellor
            .connect(user2)
            .setFinalReferenceValue(latestPoolId, [], false)
        ).to.be.revertedWith("NoOracleSubmissionAfterExpiryTime()");
      });

      it("Should revert if a zero ownership contract address is provided at contract deployment", async () => {
        await expect(
          divaOracleTellorFactory.deploy(
            ethers.constants.AddressZero,
            tellorPlaygroundAddress,
            excessDIVARewardRecipient.address,
            maxDIVARewardUSD,
            divaAddress
          )
        ).to.be.revertedWith("ZeroOwnershipContractAddress()");
      });

      it("Should revert if a zero excess DIVA reward recipient address is provided at contract deployment", async () => {
        await expect(
          divaOracleTellorFactory.deploy(
            divaOwnershipAddress,
            tellorPlaygroundAddress,
            ethers.constants.AddressZero,
            maxDIVARewardUSD,
            divaAddress
          )
        ).to.be.revertedWith("ZeroExcessDIVARewardRecipient()");
      });

      it("Should revert if a zero DIVA Protocol address is provided at contract deployment", async () => {
        await expect(
          divaOracleTellorFactory.deploy(
            divaOwnershipAddress,
            tellorPlaygroundAddress,
            excessDIVARewardRecipient.address,
            maxDIVARewardUSD,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("ZeroDIVAAddress()");
      });

      it("Should revert if a zero Tellor address is provided at contract deployment", async () => {
        await expect(
          divaOracleTellorFactory.deploy(
            divaOwnershipAddress,
            ethers.constants.AddressZero,
            excessDIVARewardRecipient.address,
            maxDIVARewardUSD,
            divaAddress
          )
        ).to.be.revertedWith("Zero Tellor address");
      });
    });

    describe("Set final reference value and claim tips and DIVA reward", async () => {
      it("Should set a reported Tellor value as the final reference value in DIVA Protocol and claim tips and DIVA reward", async () => {
        // ---------
        // Arrange: Confirm params and submit values to tellorPlayground
        // ---------
        // Get tips and balances for tippingToken1
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Get tips and balances for tippingToken2
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check collateral token balance for reporter
        expect(
          await collateralTokenInstance.balanceOf(reporter.address)
        ).to.eq(0);

        // Check finalReferenceValue and statusFinalReferenceValue in DIVA Protocol
        expect(poolParams.finalReferenceValue).to.eq(0);
        expect(poolParams.statusFinalReferenceValue).to.eq(0);

        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );

        // Submit value to Tellor playground contract
        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in collateral token.
        // Note that DIVA reward = settlement fee as no tips are added in this test case.
        const [settlementFeeAmount] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        );

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(
            latestPoolId,
            [tippingToken1.address, tippingToken2.address],
            true
          );

        // ---------
        // Assert: Confirm that finalReferenceValue and statusFinalReferenceValue in DIVA Protocol as well as
        // token balances are updated correctly
        // ---------
        // Check finalReferenceValue and statusFinalReferenceValue
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
        expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

        // Check that tips and balances for tippingToken1 are updated correctly
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
            ])
          )[0][0]
        ).to.eq(0);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          0
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
          tippingAmount1
        );

        // Check that tips and balances for tippingToken2 are updated correctly
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
            ])
          )[0][0]
        ).to.eq(0);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          0
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
          tippingAmount2
        );

        // Check that reporter received the DIVA reward
        expect(
          await collateralTokenInstance.balanceOf(reporter.address)
        ).to.eq(settlementFeeAmount);

        // Check that reporter's DIVA reward claim in DIVA Protocol dropped to zero
        expect(
          await diva.getClaim(
            collateralTokenInstance.address,
            reporter.address
          )
        ).to.eq(0);
      });

      // ---------
      // Events
      // ---------

      it("Should emit a FinalReferenceValueSet event and TipClaimed events", async () => {
        // ---------
        // Arrange: Submit values to tellorPlayground
        // ---------
        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );
        // Submit value to Tellor playground contract
        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        const tx = await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(
            latestPoolId,
            [tippingToken1.address, tippingToken2.address],
            true
          );
        const receipt = await tx.wait();

        // ---------
        // Assert: Confirm that a FinalReferenceValueSet event and TipClaimed events are emitted with the correct values
        // ---------
        // Check FinalReferenceValueSet event
        const timestampRetrieved =
          await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0);
        const finalReferenceValueSetEvent = receipt.events.find(
          (item) => item.event === "FinalReferenceValueSet"
        );
        expect(finalReferenceValueSetEvent.args.poolId).to.eq(latestPoolId);
        expect(finalReferenceValueSetEvent.args.finalValue).to.eq(
          finalReferenceValue
        );
        expect(finalReferenceValueSetEvent.args.expiryTime).to.eq(
          poolParams.expiryTime
        );
        expect(finalReferenceValueSetEvent.args.timestamp).to.eq(
          timestampRetrieved
        );

        // Check TipClaimed events
        const tipClaimedEvents = receipt.events.filter(
          (item) => item.event === "TipClaimed"
        );
        expect(tipClaimedEvents[0].args.poolId).to.eq(latestPoolId);
        expect(tipClaimedEvents[0].args.recipient).to.eq(reporter.address);
        expect(tipClaimedEvents[0].args.tippingToken).to.eq(
          tippingToken1.address
        );
        expect(tipClaimedEvents[0].args.amount).to.eq(tippingAmount1);

        expect(tipClaimedEvents[1].args.poolId).to.eq(latestPoolId);
        expect(tipClaimedEvents[1].args.recipient).to.eq(reporter.address);
        expect(tipClaimedEvents[1].args.tippingToken).to.eq(
          tippingToken2.address
        );
        expect(tipClaimedEvents[1].args.amount).to.eq(tippingAmount2);
      });
    });

    describe("Set final reference value and claim DIVA reward", async () => {
      it("Should set a reported Tellor value as the final reference value in DIVA Protocol and claim DIVA reward but leave tips unchanged", async () => {
        // ---------
        // Arrange: Confirm params and submit values to tellorPlayground
        // ---------
        // Get tips and balances for tippingToken1
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Get tips and balances for tippingToken2
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check collateral token balance for reporter
        expect(
          await collateralTokenInstance.balanceOf(reporter.address)
        ).to.eq(0);

        // Check finalReferenceValue and statusFinalReferenceValue in DIVA Protocol
        expect(poolParams.finalReferenceValue).to.eq(0);
        expect(poolParams.statusFinalReferenceValue).to.eq(0);

        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );

        // Submit value to Tellor playground contract
        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in collateral token.
        // Note that DIVA reward = settlement fee as no tips are added in this test case.
        const [settlementFeeAmount] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        );

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId, [], true);

        // ---------
        // Assert: Confirm that finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol
        // the DIVA reward claim is transferred to the reporter but it remains unclaimed
        // ---------
        // Check that finalReferenceValue and statusFinalReferenceValue are updated in DIVA Protocol
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
        expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

        // Check that reporter's DIVA reward claim in DIVA Protocol dropped to zero
        expect(
          await diva.getClaim(
            collateralTokenInstance.address,
            reporter.address
          )
        ).to.eq(0);

        // Check that the reporter's collateral token balance increased to `settlementFeeAmount`
        expect(
          await collateralTokenInstance.balanceOf(reporter.address)
        ).to.eq(settlementFeeAmount);

        // Check tips and balances for tippingToken1 are unchanged
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Check tips and balances for tippingToken2  are unchanged
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);
      });
    });

    describe("Set final reference value and claim tips", async () => {
      it("Should set a reported Tellor value as the final reference value in DIVA Protocol and claim tips but not DIVA reward", async () => {
        // ---------
        // Arrange: Confirm params and submit values to tellorPlayground
        // ---------
        // Get tips and balances for tippingToken1
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Get tips and balances for tippingToken2
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
            ])
          )[0][0]
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check collateral token balance for reporter
        expect(
          await collateralTokenInstance.balanceOf(reporter.address)
        ).to.eq(0);

        // Check finalReferenceValue and statusFinalReferenceValue in DIVA Protocol
        expect(poolParams.finalReferenceValue).to.eq(0);
        expect(poolParams.statusFinalReferenceValue).to.eq(0);

        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("1.14");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );

        // Submit value to Tellor playground contract
        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in collateral token.
        // Note that DIVA reward = settlement fee as no tips are added in this test case.
        const [settlementFeeAmount] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        );

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp =
          (await getLastBlockTimestamp()) + minPeriodUndisputed;
        await setNextBlockTimestamp(nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(
            latestPoolId,
            [tippingToken1.address, tippingToken2.address],
            false
          );

        // ---------
        // Assert: Confirm that finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol,
        // claims are transferred to reporter but DIVA reward remains unclaimed in the DIVA Protocol
        // ---------
        // Check finalReferenceValue and statusFinalReferenceValue
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
        expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

        // Check tips and balances for tippingToken1 were updated correctly
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
            ])
          )[0][0]
        ).to.eq(0);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          0
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
          tippingAmount1
        );

        // Check that tips and balances for tippingToken2 were updated correctly
        expect(
          (
            await divaOracleTellor.getTipAmounts([
              { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
            ])
          )[0][0]
        ).to.eq(0);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          0
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
          tippingAmount2
        );

        // Check the reporter's DIVA reward claim in DIVA Protocol is unchanged
        expect(
          await diva.getClaim(
            collateralTokenInstance.address,
            reporter.address
          )
        ).to.eq(settlementFeeAmount);

        // Check that the reporter's collateral token balance is unchanged
        expect(
          await collateralTokenInstance.balanceOf(reporter.address)
        ).to.eq(0);
      });
    });
  });

  describe("batchSetFinalReferenceValue", async () => {
    it("Should set a reported Tellor value as the final reference value in DIVA Protocol and leave tips and DIVA reward claims unclaimed", async () => {
      // ---------
      // Arrange: Confirm params and submit values to tellorPlayground
      // ---------

      // Prepare value submission to tellorPlayground for first pool
      const finalReferenceValue1 = parseUnits("42000");
      const collateralToUSDRate1 = parseUnits("1.14");
      const oracleValue1 = encodeOracleValue(
        finalReferenceValue1,
        collateralToUSDRate1
      );

      poolId1 = latestPoolId;
      // Check finalReferenceValue and statusFinalReferenceValue in DIVA Protocol for `poolId1`
      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);

      // Submit value to Tellor playground contract for `poolId1`
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue1, 0, queryData);

      // Calculate settlement fee expressed in collateral token for `poolId1`.
      // Note that DIVA reward = settlement fee as no tips are added in this test case.
      const [settlementFeeAmount1] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate1
      );

      // Prepare value submission to tellorPlayground for second pool
      const finalReferenceValue2 = parseUnits("43000");
      const collateralToUSDRate2 = parseUnits("1.24");
      const oracleValue2 = encodeOracleValue(
        finalReferenceValue2,
        collateralToUSDRate2
      );

      // Create second expired contingent pool that uses Tellor as the data provider
      const tx = await createContingentPool();
      const receipt = await tx.wait();
      poolId2 = receipt.events?.find((x) => x.event === "PoolIssued")?.args
        ?.poolId;
      poolParams = await diva.getPoolParameters(poolId2);
      feesParams = await diva.getFees(poolParams.indexFees);

      // Check finalReferenceValue and statusFinalReferenceValue in DIVA Protocol for `poolId2`
      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);

      // Prepare Tellor value submission for `poolId2`
      [queryData, queryId] = getQueryDataAndId(poolId2, divaAddress, chainId);

      // Submit value to Tellor playground contract for `poolId2`
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue2, 0, queryData);

      // Calculate settlement fee expressed in collateral token for `poolId2`.
      // Note that DIVA reward = settlement fee as no tips are added in this test case.
      const [settlementFeeAmount2] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate2
      );

      // ---------
      // Act: Call `batchSetFinalReferenceValue` function inside DIVAOracleTellor
      // contract after exactly `minPeriodUndisputed` period has passed
      // ---------
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor.connect(user2).batchSetFinalReferenceValue([
        { poolId: poolId1, tippingTokens: [], claimDIVAReward: false },
        { poolId: poolId2, tippingTokens: [], claimDIVAReward: false },
      ]);

      // ---------
      // Assert: Confirm that finalReferenceValue, statusFinalReferenceValue and reward claim in DIVA Protocol are updated
      // ---------
      // Check that finalReferenceValue and statusFinalReferenceValue are updated in DIVA Protocol
      const poolParams1 = await diva.getPoolParameters(poolId1);
      expect(poolParams1.finalReferenceValue).to.eq(finalReferenceValue1);
      expect(poolParams1.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

      const poolParams2 = await diva.getPoolParameters(poolId2);
      expect(poolParams2.finalReferenceValue).to.eq(finalReferenceValue2);
      expect(poolParams2.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

      // Check that the DIVA reward claim was allocated to the reporter in DIVA Protocol
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount1.add(settlementFeeAmount2));

      // Check that `poolId1` and `poolId2` are added to `reporterToPoolIds`
      expect(
        (
          await divaOracleTellor.getPoolIdsLengthForReporters([
            reporter.address,
          ])
        )[0]
      ).to.eq(2);
      const poolIds = (
        await divaOracleTellor.getPoolIdsForReporters([
          { reporter: reporter.address, startIndex: 0, endIndex: 2 },
        ])
      )[0];
      expect(poolIds[0]).to.eq(poolId1);
      expect(poolIds[1]).to.eq(poolId2);
    });
  });

  describe("addTip", async () => {
    it("Should add tip to DIVAOracleTellor", async () => {
      // ---------
      // Arrange: Check that there's no tip added for latestPoolId
      // ---------
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);

      // ---------
      // Act: Add tip
      // ---------
      await divaOracleTellor
        .connect(tipper)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);

      // ---------
      // Assert: Check that tip is added on divaOracleTellor correctly
      // ---------
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
    });

    it("Should add second tip with same tipping token after add first tip to DIVAOracleTellor", async () => {
      // ---------
      // Arrange: Add first tip and set second tipping amount
      // ---------
      await divaOracleTellor
        .connect(tipper)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);

      const secondTippingAmount = parseUnits("3000", tippingTokenDecimals);

      // ---------
      // Act: Add second tip in the same tipping token as the first tip
      // ---------
      await divaOracleTellor
        .connect(tipper)
        .addTip(latestPoolId, secondTippingAmount, tippingToken1.address);

      // ---------
      // Assert: Check that tip is increased on divaOracleTellor correctly
      // ---------
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(secondTippingAmount.add(tippingAmount1));
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        secondTippingAmount.add(tippingAmount1)
      );
    });

    it("Deducts a fee on transfer for the Mock ERC20 token with fees (required for revert test)", async () => {
      // This test is to ensure that the fee logic in the Mock ERC20 functions correctly

      // ---------
      // Arrange: Get the token balances before transfer and prepare for transfer
      // ---------
      const tippingTokenBalanceTipperBefore = await tippingToken1.balanceOf(tipper.address);
      const tippingTokenBalanceUser2Before = await tippingToken1.balanceOf(user2.address);

      // Set fee on token
      const fee = 100;
      await tippingToken1.setFee(fee);

      // Calculate applicable fee amount
      const amountToTransfer = parseUnits("1", tippingTokenDecimals);
      const feePct = await tippingToken1.getFee();
      expect(feePct).to.be.gt(0)
      const feeAmount = amountToTransfer.div(feePct);
      
      // ---------
      // Act: Transfer tokens
      // ---------
      await tippingToken1
        .connect(tipper)
        .transfer(user2.address, amountToTransfer);

      // ---------
      // Assert: Confirm that the new balances are as expected
      // ---------
      const tippingTokenBalanceTipperAfter = await tippingToken1.balanceOf(tipper.address);
      const tippingTokenBalanceUser2After = await tippingToken1.balanceOf(user2.address);
      expect(tippingTokenBalanceTipperAfter).to.eq(tippingTokenBalanceTipperBefore.sub(amountToTransfer));
      expect(tippingTokenBalanceUser2After).to.eq(tippingTokenBalanceUser2Before.add(amountToTransfer).sub(feeAmount));

      // ---------
      // Assert: Set fees back to zero
      // ---------
      await tippingToken1.setFee(0);
    });

    // ---------
    // Revert
    // ---------

    it("Should revert if user wants to add a tip on an already confirmed pool", async () => {
      // ---------
      // Arrange: Set final reference value on DIVAOracleTellor
      // ---------
      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseUnits("42000");
      collateralToUSDRate = parseUnits("1.14");
      oracleValue = encodeOracleValue(
        finalReferenceValue,
        collateralToUSDRate
      );

      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId, [], false);

      // ---------
      // Act & Assert: Confirm that tip function will fail if called after `setFinalReferenceValue` function is called
      // ---------
      await expect(
        divaOracleTellor
          .connect(tipper)
          .addTip(latestPoolId, tippingAmount1, tippingToken1.address)
      ).to.be.revertedWith("AlreadyConfirmedPool()");
    });

    it("Reverts with `FeeTokensNotSupported` if the tipping token implements a fee", async () => {
      // ---------
      // Arrange: Activate token transfer fees and set tip parameters
      // ---------
      const fee = 100;
      await tippingToken1.setFee(fee);
      expect(await tippingToken1.getFee()).to.eq(fee);
      
      // Get tip amount before
      const tipAmountBefore = (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]

      // Set tip amount
      tippingAmount1 = parseUnits("1", tippingTokenDecimals);
      
      // Confirm that the pool is not yet confirmed and a tip is possible
      expect(poolParams.statusFinalReferenceValue).to.eq(0); // 0 = Open

      // ---------
      // Act & Assert: Check that adding a tip fails if a fee is activated
      // ---------
      await expect(
        divaOracleTellor
          .connect(tipper)
          .addTip(latestPoolId, tippingAmount1, tippingToken1.address)
      ).to.be.revertedWith("FeeTokensNotSupported()");

      // ---------
      // Reset: Set back fee to zero and test that `addTip` works again
      // ---------
      await tippingToken1.setFee(0);
      expect(await tippingToken1.getFee()).to.eq(0);

      // Tip pool with `tipAmount`
      await divaOracleTellor
        .connect(tipper)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);

      // Confirm that the tip amount increased
      const tipAmountAfter = (
        await divaOracleTellor.getTipAmounts([
          { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
        ])
      )[0][0]
      expect(tipAmountAfter).to.eq(tipAmountBefore.add(tippingAmount1));
  });

    // ---------
    // Events
    // ---------

    it("Should emit a TipAdded event", async () => {
      // ---------
      // Act: Add tip
      // ---------
      const tx = await divaOracleTellor
        .connect(tipper)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);
      const receipt = await tx.wait();

      // ---------
      // Assert: Confirm that a TipAdded event is emitted with the correct values
      // ---------
      const tipAddedEvent = receipt.events.find(
        (item) => item.event === "TipAdded"
      );
      expect(tipAddedEvent.args.poolId).to.eq(latestPoolId);
      expect(tipAddedEvent.args.tippingToken).to.eq(tippingToken1.address);
      expect(tipAddedEvent.args.amount).to.eq(tippingAmount1);
      expect(tipAddedEvent.args.tipper).to.eq(tipper.address);
    });
  });

  describe("batchAddTip", async () => {
    it("Should add batch tips to DIVAOracleTellor", async () => {
      // ---------
      // Arrange: Check that there's no tip added for latestPoolId
      // ---------
      const tipAmountsBefore = (
        await divaOracleTellor.getTipAmounts([
          {
            poolId: latestPoolId,
            tippingTokens: [tippingToken1.address, tippingToken2.address],
          },
        ])
      )[0];
      expect(tipAmountsBefore[0]).to.eq(0);
      expect(tipAmountsBefore[1]).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);

      // ---------
      // Act: Add batch tips
      // ---------
      await divaOracleTellor.connect(tipper).batchAddTip([
        {
          poolId: latestPoolId,
          amount: tippingAmount1,
          tippingToken: tippingToken1.address,
        },
        {
          poolId: latestPoolId,
          amount: tippingAmount2,
          tippingToken: tippingToken2.address,
        },
      ]);

      // ---------
      // Assert: Check that tip is added on divaOracleTellor correctly
      // ---------
      const tipAmountsAfter = (
        await divaOracleTellor.getTipAmounts([
          {
            poolId: latestPoolId,
            tippingTokens: [tippingToken1.address, tippingToken2.address],
          },
        ])
      )[0];
      expect(tipAmountsAfter[0]).to.eq(tippingAmount1);
      expect(tipAmountsAfter[1]).to.eq(tippingAmount2);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
    });
  });

  describe("claimReward", async () => {
    beforeEach(async () => {
      // Add tips
      await divaOracleTellor.connect(tipper).batchAddTip([
        {
          poolId: latestPoolId,
          amount: tippingAmount1,
          tippingToken: tippingToken1.address,
        },
        {
          poolId: latestPoolId,
          amount: tippingAmount2,
          tippingToken: tippingToken2.address,
        },
      ]);

      // Prepare Tellor value submission
      [queryData, queryId] = getQueryDataAndId(
        latestPoolId,
        divaAddress,
        chainId
      );

      finalReferenceValue = parseUnits("42000");
      collateralToUSDRate = parseUnits("1.14");
      oracleValue = encodeOracleValue(
        finalReferenceValue,
        collateralToUSDRate
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);
    });

    it("Should claim tips only after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and check tips
      // ---------
      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId, [], false);

      // Check tips and balances for tippingToken1 before calling `claimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `claimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token.
      // Note that DIVA reward = settlement fee as no tips are added in this test case.
      const [settlementFeeAmount] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check DIVA reward claim in DIVA
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount);

      // ---------
      // Act: Call `claimReward` function
      // ---------
      await divaOracleTellor.claimReward(
        latestPoolId,
        [tippingToken1.address, tippingToken2.address],
        false
      );

      // ---------
      // Assert: Check tips are paid to reporter but DIVA reward claims remain untouched
      // ---------
      // Check that tips are paid out to reporter
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
        tippingAmount1
      );
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
        tippingAmount2
      );

      // Confirm that DIVA reward remains unchanged
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount);
    });

    it("Should claim DIVA reward only after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and calc settlementFeeAmount
      // ---------
      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId, [], false);

      // Check tips and balances for tippingToken1 before calling `claimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `claimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token.
      // Note that DIVA reward = settlement fee as no tips are added in this test case.
      const [settlementFeeAmount] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check DIVA reward claim in DIVA
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount);

      // ---------
      // Act: Call `claimReward` function
      // ---------
      await divaOracleTellor.claimReward(latestPoolId, [], true);

      // ---------
      // Assert: Check that DIVA reward was claimed but tips remain untouched
      // ---------
      // Check that DIVA reward was claimed and sent to reporter
      expect(await collateralTokenInstance.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount
      );
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(0);

      // Check that tips and balances for tippingToken1 are unchanged
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 are unchanged
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);
    });

    it("Should claim tips and DIVA reward after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and check tips and DIVA reward
      // ---------
      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId, [], false);

      // Check tips and balances for tippingToken1 before calling `claimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `claimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token.
      // Note that DIVA reward = settlement fee as no tips are added in this test case.
      const [settlementFeeAmount] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check DIVA reward claim in DIVA
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount);

      // ---------
      // Act: Call `claimReward` function
      // ---------
      await divaOracleTellor.claimReward(
        latestPoolId,
        [tippingToken1.address, tippingToken2.address],
        true
      );

      // ---------
      // Assert: Check that tips and DIVA rewards were paid out to the reporter
      // ---------
      // Confirm that tips were paid out to the reporter
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
        tippingAmount1
      );
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
        tippingAmount2
      );

      // Confirm that DIVA reward were paid out to the reporter
      expect(await collateralTokenInstance.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount
      );
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(0);
    });

    it("Should not change anything if `claimReward` function is called with an empty `_tippingTokens` array and `false` as `_claimDIVAReward` value", async function () {
      // ---------
      // Arrange: Set final reference value and check tips and DIVA reward
      // ---------
      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId, [], false);

      // Check tips and balances for tippingToken1 before calling `claimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `claimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token.
      // Note that DIVA reward = settlement fee as no tips are added in this test case.
      const [settlementFeeAmount] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check DIVA reward claim in DIVA
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount);

      // ---------
      // Act: Call `claimReward` function
      // ---------
      await divaOracleTellor.claimReward(latestPoolId, [], false);

      // ---------
      // Assert: Confirm that tips, DIVA reward and relevant variables remain unchanged
      // ---------
      // Confirm that tips hasn't been changed
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: latestPoolId, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Confirm that DIVA reward hasn't been changed
      expect(await collateralTokenInstance.balanceOf(reporter.address)).to.eq(
        0
      );
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount);
    });

    // ---------
    // Revert
    // ---------

    it("Should revert if users try to claim tips and DIVA reward for not confirmed pool", async () => {
      // ---------
      // Act & Assert: Confirm that `claimReward` function will fail if called before `setFinalReferenceValue` function is called
      // ---------
      await expect(
        divaOracleTellor.claimReward(
          latestPoolId,
          [tippingToken1.address, tippingToken2.address],
          true
        )
      ).to.be.revertedWith("NotConfirmedPool()");
    });

    // ---------
    // Events
    // ---------

    it("Should emit TipClaimed events", async () => {
      // ---------
      // Arrange: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      // ---------
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId, [], false);

      // ---------
      // Act: Call `claimReward` function
      // ---------
      const tx = await divaOracleTellor.claimReward(
        latestPoolId,
        [tippingToken1.address, tippingToken2.address],
        true
      );
      const receipt = await tx.wait();

      // ---------
      // Assert: Confirm that a TipClaimed events are emitted with the correct values
      // ---------
      const tipClaimedEvents = receipt.events.filter(
        (item) => item.event === "TipClaimed"
      );
      expect(tipClaimedEvents[0].args.poolId).to.eq(latestPoolId);
      expect(tipClaimedEvents[0].args.recipient).to.eq(reporter.address);
      expect(tipClaimedEvents[0].args.tippingToken).to.eq(
        tippingToken1.address
      );
      expect(tipClaimedEvents[0].args.amount).to.eq(tippingAmount1);

      expect(tipClaimedEvents[1].args.poolId).to.eq(latestPoolId);
      expect(tipClaimedEvents[1].args.recipient).to.eq(reporter.address);
      expect(tipClaimedEvents[1].args.tippingToken).to.eq(
        tippingToken2.address
      );
      expect(tipClaimedEvents[1].args.amount).to.eq(tippingAmount2);
    });
  });

  describe("batchClaimReward", async () => {
    let tippingAmount1ForPoolId1, tippingAmount2ForPoolId1;
    let tippingAmount1ForPoolId2, tippingAmount2ForPoolId2;
    let poolParams1, poolParams2;
    let feesParams1, feesParams2;

    beforeEach(async () => {
      // Set tipping amounts
      tippingAmount1ForPoolId1 = parseUnits("1000", tippingTokenDecimals);
      tippingAmount2ForPoolId1 = parseUnits("2000", tippingTokenDecimals);
      tippingAmount1ForPoolId2 = parseUnits("3000", tippingTokenDecimals);
      tippingAmount2ForPoolId2 = parseUnits("4000", tippingTokenDecimals);

      // Set poolId1
      poolId1 = latestPoolId;
      poolParams1 = await diva.getPoolParameters(poolId1);
      feesParams1 = await diva.getFees(poolParams1.indexFees);

      // Create an expired contingent pool that uses Tellor as the data provider
      const tx = await createContingentPool();
      const receipt = await tx.wait();

      // Set poolId2
      poolId2 = receipt.events?.find((x) => x.event === "PoolIssued")?.args
        ?.poolId;
      poolParams2 = await diva.getPoolParameters(poolId2);
      feesParams2 = await diva.getFees(poolParams2.indexFees);

      // Add tips for poolId1 and poolId2
      await divaOracleTellor.connect(tipper).batchAddTip([
        {
          poolId: poolId1,
          amount: tippingAmount1ForPoolId1,
          tippingToken: tippingToken1.address,
        },
        {
          poolId: poolId1,
          amount: tippingAmount2ForPoolId1,
          tippingToken: tippingToken2.address,
        },
        {
          poolId: poolId2,
          amount: tippingAmount1ForPoolId2,
          tippingToken: tippingToken1.address,
        },
        {
          poolId: poolId2,
          amount: tippingAmount2ForPoolId2,
          tippingToken: tippingToken2.address,
        },
      ]);

      // Prepare Tellor value submission for poolId1
      const [queryData1, queryId1] = getQueryDataAndId(
        poolId1,
        divaAddress,
        chainId
      );

      // Set next block timestamp
      nextBlockTimestamp =
        Math.max(
          poolParams1.expiryTime.toNumber(),
          poolParams2.expiryTime.toNumber()
        ) + 1;
      await setNextBlockTimestamp(nextBlockTimestamp);

      finalReferenceValue = parseUnits("42000");
      collateralToUSDRate = parseUnits("1.14");
      oracleValue = encodeOracleValue(
        finalReferenceValue,
        collateralToUSDRate
      );
      // Submit value to Tellor playground contract
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId1, oracleValue, 0, queryData1);

      // Prepare Tellor value submission for poolId2
      const [queryData2, queryId2] = getQueryDataAndId(
        poolId2,
        divaAddress,
        chainId
      );

      // Submit value to Tellor playground contract
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId2, oracleValue, 0, queryData2);
    });

    it("Should batch claim tips only after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and check tips
      // ---------
      // Call `setFinalReferenceValue` function for poolId1 and poolId2 inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(poolId1, [], false);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(poolId2, [], false);

      // Check tips and balances for tippingToken1 before calling `batchClaimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1ForPoolId1);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1ForPoolId2);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `batchClaimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2ForPoolId1);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2ForPoolId2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // ---------
      // Act: Call `batchClaimReward` function
      // ---------
      await divaOracleTellor.batchClaimReward([
        {
          poolId: poolId1,
          tippingTokens: [tippingToken1.address, tippingToken2.address],
          claimDIVAReward: false,
        },
        {
          poolId: poolId2,
          tippingTokens: [tippingToken1.address, tippingToken2.address],
          claimDIVAReward: false,
        },
      ]);

      // ---------
      // Assert: Check tips are paid to reporter
      // ---------
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );
    });

    it("Should batch claim DIVA reward only after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and calc settlementFeeAmount
      // ---------
      // Call `setFinalReferenceValue` function for poolId1 and poolId2 inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(poolId1, [], false);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(poolId2, [], false);

      // Check tips and balances for tippingToken1 before calling `batchClaimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1ForPoolId1);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1ForPoolId2);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `batchClaimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2ForPoolId1);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2ForPoolId2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token.
      // Note that DIVA reward = settlement fee as no tips are added in this test case.
      const [settlementFeeAmount1] = calcSettlementFee(
        poolParams1.collateralBalance,
        feesParams1.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );
      const [settlementFeeAmount2] = calcSettlementFee(
        poolParams2.collateralBalance,
        feesParams2.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check DIVA reward claim in DIVA
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount1.add(settlementFeeAmount2));

      // ---------
      // Act: Call `batchClaimReward` function
      // ---------
      await divaOracleTellor.batchClaimReward([
        {
          poolId: poolId1,
          tippingTokens: [],
          claimDIVAReward: true,
        },
        {
          poolId: poolId2,
          tippingTokens: [],
          claimDIVAReward: true,
        },
      ]);

      // ---------
      // Assert: Check that DIVA reward was claimed but tips remain untouched
      // ---------
      // Check that DIVA reward was claimed and sent to reporter
      expect(await collateralTokenInstance.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount1.add(settlementFeeAmount2)
      );
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(0);

      // Check that tips and balances for tippingToken1 are unchanged
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1ForPoolId1);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1ForPoolId2);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 are unchanged
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2ForPoolId1);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2ForPoolId2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);
    });

    it("Should batch claim tips and DIVA reward after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and check tips
      // ---------
      // Call `setFinalReferenceValue` function for poolId1 and poolId2 inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(poolId1, [], false);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(poolId2, [], false);

      // Check tips and balances for tippingToken1 before calling `batchClaimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1ForPoolId1);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount1ForPoolId2);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `batchClaimReward`
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2ForPoolId1);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(tippingAmount2ForPoolId2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token.
      // Note that DIVA reward = settlement fee as no tips are added in this test case.
      const [settlementFeeAmount1] = calcSettlementFee(
        poolParams1.collateralBalance,
        feesParams1.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );
      const [settlementFeeAmount2] = calcSettlementFee(
        poolParams2.collateralBalance,
        feesParams2.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check DIVA reward claim in DIVA
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(settlementFeeAmount1.add(settlementFeeAmount2));

      // ---------
      // Act: Call `batchClaimReward` function
      // ---------
      await divaOracleTellor.batchClaimReward([
        {
          poolId: poolId1,
          tippingTokens: [tippingToken1.address, tippingToken2.address],
          claimDIVAReward: true,
        },
        {
          poolId: poolId2,
          tippingTokens: [tippingToken1.address, tippingToken2.address],
          claimDIVAReward: true,
        },
      ]);

      // ---------
      // Assert: Check that tips and DIVA rewards were paid out to the reporter
      // ---------
      // Confirm that tips were paid out to the reporter
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken1.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId1, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(
        (
          await divaOracleTellor.getTipAmounts([
            { poolId: poolId2, tippingTokens: [tippingToken2.address] },
          ])
        )[0][0]
      ).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );

      // Confirm that DIVA reward were paid out to the reporter
      expect(await collateralTokenInstance.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount1.add(settlementFeeAmount2)
      );
      expect(
        await diva.getClaim(collateralTokenInstance.address, reporter.address)
      ).to.eq(0);
    });
  });

  describe("getTippingTokens", async () => {
    let startIndex, endIndex;
    let poolId;

    beforeEach(async () => {
      // Add tips
      await divaOracleTellor.connect(tipper).batchAddTip([
        {
          poolId: latestPoolId,
          amount: tippingAmount1,
          tippingToken: tippingToken1.address,
        },
        {
          poolId: latestPoolId,
          amount: tippingAmount2,
          tippingToken: tippingToken2.address,
        },
      ]);
    });

    it("Should get tipping tokens with correct start and end index", async () => {
      // ---------
      // Arrange: Set start, end index and poolId
      // ---------
      poolId = latestPoolId; // @todo check here if we rename latestPoolId
      startIndex = 0;
      endIndex = (
        await divaOracleTellor.getTippingTokensLengthForPoolIds([poolId])
      )[0];

      // ---------
      // Assert: Check that params are correct
      // ---------
      // Get tipping tokens for poolId
      const tippingTokensForPoolId = (
        await divaOracleTellor.getTippingTokens([
          {
            poolId,
            startIndex,
            endIndex,
          },
        ])
      )[0];
      // Confirm that tipping tokens for poolId are correct
      expect(tippingTokensForPoolId[0]).to.eq(tippingToken1.address);
      expect(tippingTokensForPoolId[1]).to.eq(tippingToken2.address);
    });

    it("Should get tipping tokens with end index larger than length of tipping tokens added for poolId", async () => {
      // ---------
      // Arrange: Set start, end index and poolId
      // ---------
      poolId = latestPoolId; // @todo remove line if we rename latestPoolId to poolId
      startIndex = 0;
      endIndex =
        (
          await divaOracleTellor.getTippingTokensLengthForPoolIds([poolId])
        )[0].toNumber() + 1;

      // ---------
      // Assert: Check that params are correct
      // ---------
      // Get tipping tokens for poolId
      const tippingTokensForPoolId = (
        await divaOracleTellor.getTippingTokens([
          {
            poolId,
            startIndex,
            endIndex,
          },
        ])
      )[0];
      // Confirm that tipping tokens for poolId are correct
      expect(tippingTokensForPoolId[0]).to.eq(tippingToken1.address);
      expect(tippingTokensForPoolId[1]).to.eq(tippingToken2.address);
      expect(tippingTokensForPoolId[2]).to.eq(ethers.constants.AddressZero);
    });
  });

  describe("getPoolIdsForReporters", async () => {
    let startIndex, endIndex;

    beforeEach(async () => {
      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseUnits("42000");
      collateralToUSDRate = parseUnits("1.14");
      oracleValue = encodeOracleValue(
        finalReferenceValue,
        collateralToUSDRate
      );

      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // Set final reference value after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp =
        (await getLastBlockTimestamp()) + minPeriodUndisputed;
      await setNextBlockTimestamp(nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId, [], false);
    });

    it("Should get poolIds with correct start and end index", async () => {
      // ---------
      // Arrange: Set start, end index and reporter
      // ---------
      startIndex = 0;
      endIndex = (
        await divaOracleTellor.getPoolIdsLengthForReporters([reporter.address])
      )[0];

      // ---------
      // Assert: Check that params are correct
      // ---------
      // Get poolIds for reporter
      const poolIdsForReporter = (
        await divaOracleTellor.getPoolIdsForReporters([
          {
            reporter: reporter.address,
            startIndex,
            endIndex,
          },
        ])
      )[0];
      // Confirm that poolId for reporter is correct
      expect(poolIdsForReporter[0]).to.eq(latestPoolId);
    });

    it("Should get poolIds with end index larger than length of poolIds reportedy by reporter", async () => {
      // ---------
      // Arrange: Set start, end index and reporter
      // ---------
      startIndex = 0;
      endIndex =
        (
          await divaOracleTellor.getPoolIdsLengthForReporters([
            reporter.address,
          ])
        )[0].toNumber() + 1;

      // ---------
      // Assert: Check that params are correct
      // ---------
      // Get poolIds for reporter
      const poolIdsForReporter = (
        await divaOracleTellor.getPoolIdsForReporters([
          {
            reporter: reporter.address,
            startIndex,
            endIndex,
          },
        ])
      )[0];
      // Confirm that poolId for reporter is correct
      expect(poolIdsForReporter[0]).to.eq(latestPoolId);
      expect(poolIdsForReporter[1]).to.eq(ethers.constants.HashZero);
    });
  });

  describe("updateMaxDIVARewardUSD", async () => {
    let newMaxDIVARewardUSD;

    it("Should update max DIVA reward USD info after deployment", async () => {
      // ---------
      // ---------
      newMaxDIVARewardUSD = parseUnits("20");

      // Get max DIVA reward USD info
      maxDIVARewardUSDInfo = await divaOracleTellor.getMaxDIVARewardUSDInfo();
      expect(maxDIVARewardUSDInfo.startTimeMaxDIVARewardUSD).to.eq(0);
      expect(maxDIVARewardUSDInfo.previousMaxDIVARewardUSD).to.eq(0);
      expect(maxDIVARewardUSDInfo.maxDIVARewardUSD).to.eq(maxDIVARewardUSD);

      // ---------
      // Act: Call `updateMaxDIVARewardUSD` function
      // ---------
      await divaOracleTellor.updateMaxDIVARewardUSD(newMaxDIVARewardUSD);

      // ---------
      // Assert: Check that max DIVA reward USD info is updated in DIVAOracleTellor correctly
      // ---------
      maxDIVARewardUSDInfo = await divaOracleTellor.getMaxDIVARewardUSDInfo();
      expect(maxDIVARewardUSDInfo.startTimeMaxDIVARewardUSD).to.eq(
        (await getLastBlockTimestamp()) + activationDelay.toNumber()
      );
      expect(maxDIVARewardUSDInfo.previousMaxDIVARewardUSD).to.eq(
        maxDIVARewardUSD
      );
      expect(maxDIVARewardUSDInfo.maxDIVARewardUSD).to.eq(newMaxDIVARewardUSD);
    });

    it("Should be able to update max DIVA reward USD info after pending period passes", async () => {
      // ---------
      // Arrange: Update max DIVA reward USD
      // ---------
      // Call `updateMaxDIVARewardUSD` function (first update)
      const newMaxDIVARewardUSD1 = parseUnits("20");
      await divaOracleTellor.updateMaxDIVARewardUSD(newMaxDIVARewardUSD1);

      // Get the max DIVA reward USD info before second updating
      maxDIVARewardUSDInfo = await divaOracleTellor.getMaxDIVARewardUSDInfo();
      expect(maxDIVARewardUSDInfo.startTimeMaxDIVARewardUSD).to.eq(
        (await getLastBlockTimestamp()) + activationDelay.toNumber()
      );
      expect(maxDIVARewardUSDInfo.previousMaxDIVARewardUSD).to.eq(
        maxDIVARewardUSD
      );
      expect(maxDIVARewardUSDInfo.maxDIVARewardUSD).to.eq(newMaxDIVARewardUSD1);

      // Set next block timestamp as after of `startTimeMaxDIVARewardUSD`
      await setNextBlockTimestamp(
        maxDIVARewardUSDInfo.startTimeMaxDIVARewardUSD.toNumber() + 1
      );

      // Set max DIVA reward USD for second update
      const newMaxDIVARewardUSD2 = parseUnits("30");

      // ---------
      // Act: Call `updateMaxDIVARewardUSD` function (second update)
      // ---------
      await divaOracleTellor.updateMaxDIVARewardUSD(newMaxDIVARewardUSD2);

      // ---------
      // Assert: Check that the max DIVA reward USD info is updated in DIVAOracleTellor correctly
      // ---------
      maxDIVARewardUSDInfo = await divaOracleTellor.getMaxDIVARewardUSDInfo();
      expect(maxDIVARewardUSDInfo.startTimeMaxDIVARewardUSD).to.eq(
        (await getLastBlockTimestamp()) + activationDelay.toNumber()
      );
      expect(maxDIVARewardUSDInfo.previousMaxDIVARewardUSD).to.eq(
        newMaxDIVARewardUSD1
      );
      expect(maxDIVARewardUSDInfo.maxDIVARewardUSD).to.eq(newMaxDIVARewardUSD2);
    });

    // -------------------------------------------
    // Reverts
    // -------------------------------------------

    it("Should revert if triggered by an account other than the contract owner", async () => {
      // ---------
      // Act & Assert: Confirm that function call reverts if called by an account other than the contract owner
      // ---------
      await expect(
        divaOracleTellor.connect(user2).updateMaxDIVARewardUSD(parseUnits("20"))
      ).to.be.revertedWith(
        `NotContractOwner("${user2.address}", "${user1.address}")`
      );
    });

    it("Should revert if there is pending max DIVA reward USD update", async () => {
      // ---------
      // Arrange: Update max DIVA reward USD
      // ---------
      // Call `updateMaxDIVARewardUSD` function
      const tx = await divaOracleTellor.updateMaxDIVARewardUSD(
        parseUnits("20")
      );
      const receipt = await tx.wait();
      const startTimeMaxDIVARewardUSD = receipt.events.find(
        (item) => item.event === "MaxDIVARewardUSDUpdated"
      ).args.startTimeMaxDIVARewardUSD;

      // Set next block timestamp as before of `startTimeMaxDIVARewardUSD`
      nextBlockTimestamp = (await getLastBlockTimestamp()) + 1;
      await setNextBlockTimestamp(nextBlockTimestamp);
      expect(nextBlockTimestamp).to.lt(startTimeMaxDIVARewardUSD);

      // ---------
      // Act & Assert: Confirm that `updateMaxDIVARewardUSD` function will fail
      // ---------
      await expect(
        divaOracleTellor.updateMaxDIVARewardUSD(parseUnits("30"))
      ).to.be.revertedWith(
        `PendingMaxDIVARewardUSDUpdate(${nextBlockTimestamp}, ${startTimeMaxDIVARewardUSD.toNumber()})`
      );
    });

    // ---------
    // Events
    // ---------

    it("Should emit a `MaxDIVARewardUSDUpdated` event", async () => {
      // ---------
      // Arrange: Set next block timestamp and new max DIVA reward USD
      // ---------
      newMaxDIVARewardUSD = parseUnits("20");
      nextBlockTimestamp = (await getLastBlockTimestamp()) + 1;
      await setNextBlockTimestamp(nextBlockTimestamp);

      // ---------
      // Act: Call `updateMaxDIVARewardUSD` function
      // ---------
      const tx = await divaOracleTellor.updateMaxDIVARewardUSD(
        newMaxDIVARewardUSD
      );
      const receipt = await tx.wait();

      // ---------
      // Assert: Confirm that a `MaxDIVARewardUSDUpdated` event is emitted with the correct values
      // ---------
      const maxDIVARewardUSDUpdatedEvent = receipt.events.find(
        (item) => item.event === "MaxDIVARewardUSDUpdated"
      ).args;
      expect(maxDIVARewardUSDUpdatedEvent.from).to.eq(user1.address);
      expect(maxDIVARewardUSDUpdatedEvent.maxDIVARewardUSD).to.eq(
        newMaxDIVARewardUSD
      );
      expect(maxDIVARewardUSDUpdatedEvent.startTimeMaxDIVARewardUSD).to.eq(
        nextBlockTimestamp + activationDelay.toNumber()
      );
    });
  });

  describe("updateExcessDIVARewardRecipient", async () => {
    it("Should update excess DIVA reward recipient info after deployment", async () => {
      // ---------
      // Arrange: Check the excess DIVA reward recipient info before updating
      // ---------
      excessDIVARewardRecipientInfo =
        await divaOracleTellor.getExcessDIVARewardRecipientInfo();
      expect(excessDIVARewardRecipientInfo.startTimeExcessDIVARewardRecipient).to.eq(0);
      expect(excessDIVARewardRecipientInfo.previousExcessDIVARewardRecipient).to.eq(
        ethers.constants.AddressZero
      );
      expect(excessDIVARewardRecipientInfo.excessDIVARewardRecipient).to.eq(
        excessDIVARewardRecipient.address
      );

      // ---------
      // Act: Call `updateExcessDIVARewardRecipient` function
      // ---------
      await divaOracleTellor.updateExcessDIVARewardRecipient(user2.address);

      // ---------
      // Assert: Check that the excess DIVA reward recipient info is updated in DIVAOracleTellor correctly
      // ---------
      excessDIVARewardRecipientInfo =
        await divaOracleTellor.getExcessDIVARewardRecipientInfo();
      expect(excessDIVARewardRecipientInfo.startTimeExcessDIVARewardRecipient).to.eq(
        (await getLastBlockTimestamp()) + activationDelay.toNumber()
      );
      expect(excessDIVARewardRecipientInfo.previousExcessDIVARewardRecipient).to.eq(
        excessDIVARewardRecipient.address
      );
      expect(excessDIVARewardRecipientInfo.excessDIVARewardRecipient).to.eq(user2.address);
    });

    it("Should be able to update excess DIVA reward recipient info after pending period passes", async () => {
      // ---------
      // Arrange: Update excess DIVA reward recipient
      // ---------
      // Call `updateExcessDIVARewardRecipient` function (first update)
      await divaOracleTellor.updateExcessDIVARewardRecipient(user2.address);

      // Get the excess DIVA reward recipient info before second updating
      excessDIVARewardRecipientInfo =
        await divaOracleTellor.getExcessDIVARewardRecipientInfo();
      expect(excessDIVARewardRecipientInfo.startTimeExcessDIVARewardRecipient).to.eq(
        (await getLastBlockTimestamp()) + activationDelay.toNumber()
      );
      expect(excessDIVARewardRecipientInfo.previousExcessDIVARewardRecipient).to.eq(
        excessDIVARewardRecipient.address
      );
      expect(excessDIVARewardRecipientInfo.excessDIVARewardRecipient).to.eq(user2.address);

      // Set next block timestamp as after of `startTimeExcessDIVARewardRecipient`
      await setNextBlockTimestamp(
        excessDIVARewardRecipientInfo.startTimeExcessDIVARewardRecipient.toNumber() + 1
      );

      // ---------
      // Act: Call `updateExcessDIVARewardRecipient` function (second update)
      // ---------
      await divaOracleTellor.updateExcessDIVARewardRecipient(user3.address);

      // ---------
      // Assert: Check that the excess DIVA reward recipient info is updated in DIVAOracleTellor correctly
      // ---------
      excessDIVARewardRecipientInfo =
        await divaOracleTellor.getExcessDIVARewardRecipientInfo();
      expect(excessDIVARewardRecipientInfo.startTimeExcessDIVARewardRecipient).to.eq(
        (await getLastBlockTimestamp()) + activationDelay.toNumber()
      );
      expect(excessDIVARewardRecipientInfo.previousExcessDIVARewardRecipient).to.eq(
        user2.address
      );
      expect(excessDIVARewardRecipientInfo.excessDIVARewardRecipient).to.eq(user3.address);
    });

    // -------------------------------------------
    // Reverts
    // -------------------------------------------

    it("Should revert if triggered by an account other than the contract owner", async () => {
      // ---------
      // Act & Assert: Confirm that function call reverts if called by an account other than the contract owner
      // ---------
      await expect(
        divaOracleTellor.connect(user2).updateExcessDIVARewardRecipient(user2.address)
      ).to.be.revertedWith(
        `NotContractOwner("${user2.address}", "${user1.address}")`
      );
    });

    it("Should revert if new `excessDIVARewardRecipient` is zero address", async () => {
      // ---------
      // Act & Assert: Confirm that `updateExcessDIVARewardRecipient` function will fail with zero address
      // ---------
      await expect(
        divaOracleTellor.updateExcessDIVARewardRecipient(ethers.constants.AddressZero)
      ).to.be.revertedWith("ZeroExcessDIVARewardRecipient()");
    });

    it("Should revert if there is pending excess DIVA reward recipient update", async () => {
      // ---------
      // Arrange: Update excess DIVA reward recipient
      // ---------
      // Call `updateExcessDIVARewardRecipient` function
      const tx = await divaOracleTellor.updateExcessDIVARewardRecipient(
        user2.address
      );
      const receipt = await tx.wait();
      const startTimeExcessDIVARewardRecipient = receipt.events.find(
        (item) => item.event === "ExcessDIVARewardRecipientUpdated"
      ).args.startTimeExcessDIVARewardRecipient;

      // Set next block timestamp as before of `startTimeExcessDIVARewardRecipient`
      nextBlockTimestamp = (await getLastBlockTimestamp()) + 1;
      await setNextBlockTimestamp(nextBlockTimestamp);
      expect(nextBlockTimestamp).to.lt(startTimeExcessDIVARewardRecipient);

      // ---------
      // Act & Assert: Confirm that `updateExcessDIVARewardRecipient` function will fail
      // ---------
      await expect(
        divaOracleTellor.updateExcessDIVARewardRecipient(user3.address)
      ).to.be.revertedWith(
        `PendingExcessDIVARewardRecipientUpdate(${nextBlockTimestamp}, ${startTimeExcessDIVARewardRecipient.toNumber()})`
      );
    });

    // ---------
    // Events
    // ---------

    it("Should emit an `ExcessDIVARewardRecipientUpdated` event", async () => {
      // ---------
      // Arrange: Set next block timestamp
      // ---------
      nextBlockTimestamp = (await getLastBlockTimestamp()) + 1;
      await setNextBlockTimestamp(nextBlockTimestamp);

      // ---------
      // Act: Call `updateExcessDIVARewardRecipient` function
      // ---------
      const tx = await divaOracleTellor.updateExcessDIVARewardRecipient(
        user2.address
      );
      const receipt = await tx.wait();

      // ---------
      // Assert: Confirm that an `ExcessDIVARewardRecipientUpdated` event is emitted with the correct values
      // ---------
      const excessDIVARewardRecipientUpdatedEvent = receipt.events.find(
        (item) => item.event === "ExcessDIVARewardRecipientUpdated"
      ).args;
      expect(excessDIVARewardRecipientUpdatedEvent.from).to.eq(user1.address);
      expect(excessDIVARewardRecipientUpdatedEvent.excessDIVARewardRecipient).to.eq(
        user2.address
      );
      expect(excessDIVARewardRecipientUpdatedEvent.startTimeExcessDIVARewardRecipient).to.eq(
        nextBlockTimestamp + activationDelay.toNumber()
      );
    });
  });

  describe("revokePendingExcessDIVARewardRecipientUpdate", async () => {
    let newExcessDIVARewardRecipient;

    beforeEach(async () => {
      // Set new excess DIVA reward recipient
      newExcessDIVARewardRecipient = user2;

      // Confirm that new excess DIVA reward recipient is not equal to the current one
      excessDIVARewardRecipientInfo =
        await divaOracleTellor.getExcessDIVARewardRecipientInfo();
      expect(excessDIVARewardRecipientInfo.excessDIVARewardRecipient).to.not.eq(
        newExcessDIVARewardRecipient.address
      );

      // Call `updateExcessDIVARewardRecipient` function
      await divaOracleTellor.updateExcessDIVARewardRecipient(
        newExcessDIVARewardRecipient.address
      );
    });

    it("Should revoke pending excees DIVA reward recipient update", async () => {
      // ---------
      // Arrange: Check the excess DIVA reward recipient info before revoking
      // ---------
      excessDIVARewardRecipientInfo =
        await divaOracleTellor.getExcessDIVARewardRecipientInfo();
      expect(excessDIVARewardRecipientInfo.startTimeExcessDIVARewardRecipient).to.eq(
        (await getLastBlockTimestamp()) + activationDelay.toNumber()
      );
      expect(excessDIVARewardRecipientInfo.excessDIVARewardRecipient).to.eq(
        newExcessDIVARewardRecipient.address
      );

      // ---------
      // Act: Call `revokePendingExcessDIVARewardRecipientUpdate` function
      // ---------
      await divaOracleTellor.revokePendingExcessDIVARewardRecipientUpdate();

      // ---------
      // Assert: Check that the excess DIVA reward recipient info is revoked in DIVAOracleTellor correctly
      // ---------
      excessDIVARewardRecipientInfo =
        await divaOracleTellor.getExcessDIVARewardRecipientInfo();
      expect(excessDIVARewardRecipientInfo.startTimeExcessDIVARewardRecipient).to.eq(
        await getLastBlockTimestamp()
      );
      expect(excessDIVARewardRecipientInfo.excessDIVARewardRecipient).to.eq(
        excessDIVARewardRecipient.address
      );
    });

    // -------------------------------------------
    // Reverts
    // -------------------------------------------

    it("Should revert with `NotContractOwner` if triggered by an account other than the contract owner", async () => {
      // ---------
      // Act & Assert: Confirm that function call reverts if called by an account other than the contract owner
      // ---------
      const caller = user2;
      const currentOwner = await diva.getOwner();
      expect(caller).to.not.eq(currentOwner);
      await expect(
        divaOracleTellor
          .connect(caller)
          .revokePendingExcessDIVARewardRecipientUpdate()
      ).to.be.revertedWith(
        `NotContractOwner("${caller.address}", "${currentOwner}")`
      );
    });

    it("Should revert with `ExcessDIVARewardRecipientAlreadyActive` if new excess DIVA reward recipient is already active", async () => {
      // ---------
      // Arrange: Set next block timestamp
      // ---------
      // Get start time for excess DIVA reward recipient
      const startTimeExcessDIVARewardRecipient = (
        await divaOracleTellor.getExcessDIVARewardRecipientInfo()
      ).startTimeExcessDIVARewardRecipient.toNumber();

      // Set next block timestamp as after of `startTimeExcessDIVARewardRecipient`
      nextBlockTimestamp = startTimeExcessDIVARewardRecipient + 1;
      await setNextBlockTimestamp(nextBlockTimestamp);

      // ---------
      // Act & Assert: Confirm that `revokePendingExcessDIVARewardRecipientUpdate` function will fail
      // ---------
      await expect(
        divaOracleTellor.revokePendingExcessDIVARewardRecipientUpdate()
      ).to.be.revertedWith(
        `ExcessDIVARewardRecipientAlreadyActive(${nextBlockTimestamp}, ${startTimeExcessDIVARewardRecipient})`
      );
    });

    // ---------
    // Events
    // ---------

    it("Should emit a `PendingExcessDIVARewardRecipientUpdateRevoked` event", async () => {
      // ---------
      // Act: Call `revokePendingExcessDIVARewardRecipientUpdate` function
      // ---------
      const tx = await divaOracleTellor
        .connect(user1)
        .revokePendingExcessDIVARewardRecipientUpdate();
      const receipt = await tx.wait();

      // ---------
      // Assert: Confirm that a `PendingExcessDIVARewardRecipientUpdateRevoked` event is emitted with the correct values
      // ---------
      const pendingExcessDIVARewardRecipientUpdateRevokedEvent = receipt.events.find(
        (item) => item.event === "PendingExcessDIVARewardRecipientUpdateRevoked"
      ).args;
      expect(pendingExcessDIVARewardRecipientUpdateRevokedEvent.revokedBy).to.eq(
        user1.address
      );
      expect(
        pendingExcessDIVARewardRecipientUpdateRevokedEvent.revokedExcessDIVARewardRecipient
      ).to.eq(user2.address);
      expect(
        pendingExcessDIVARewardRecipientUpdateRevokedEvent.restoredExcessDIVARewardRecipient
      ).to.eq(excessDIVARewardRecipient.address);
    });
  });

  describe("revokePendingMaxDIVARewardUSDUpdate", async () => {
    let newMaxDIVARewardUSD;

    beforeEach(async () => {
      // Set new max USD DIVA reward
      newMaxDIVARewardUSD = parseUnits("20");

      // Confirm that new max USD DIVA reward is not equal to the current one
      maxDIVARewardUSDInfo = await divaOracleTellor.getMaxDIVARewardUSDInfo();
      expect(maxDIVARewardUSDInfo.maxDIVARewardUSD).to.not.eq(
        newMaxDIVARewardUSD
      );

      // Call `updateMaxDIVARewardUSD` function
      await divaOracleTellor.updateMaxDIVARewardUSD(newMaxDIVARewardUSD);
    });

    it("Should revoke pending max USD DIVA reward update", async () => {
      // ---------
      // Arrange: Check max USD DIVA reward info before updating
      // ---------
      maxDIVARewardUSDInfo = await divaOracleTellor.getMaxDIVARewardUSDInfo();
      expect(maxDIVARewardUSDInfo.startTimeMaxDIVARewardUSD).to.eq(
        (await getLastBlockTimestamp()) + activationDelay.toNumber()
      );
      expect(maxDIVARewardUSDInfo.maxDIVARewardUSD).to.eq(newMaxDIVARewardUSD);

      // ---------
      // Act: Call `revokePendingMaxDIVARewardUSDUpdate` function
      // ---------
      await divaOracleTellor.revokePendingMaxDIVARewardUSDUpdate();

      // ---------
      // Assert: Check that max USD DIVA reward info is updated correctly and returns
      // the previous one (`maxDIVARewardUSD` is the default value)
      // ---------
      maxDIVARewardUSDInfo = await divaOracleTellor.getMaxDIVARewardUSDInfo();
      expect(maxDIVARewardUSDInfo.startTimeMaxDIVARewardUSD).to.eq(
        await getLastBlockTimestamp()
      );
      expect(maxDIVARewardUSDInfo.maxDIVARewardUSD).to.eq(maxDIVARewardUSD);
    });

    // -------------------------------------------
    // Reverts
    // -------------------------------------------

    it("Should revert with `NotContractOwner` if triggered by an account other than the contract owner", async () => {
      // ---------
      // Act & Assert: Confirm that function call reverts if called by an account other than the contract owner
      // ---------
      const caller = user2;
      const currentOwner = await diva.getOwner();
      await expect(
        divaOracleTellor.connect(caller).revokePendingMaxDIVARewardUSDUpdate()
      ).to.be.revertedWith(
        `NotContractOwner("${caller.address}", "${currentOwner}")`
      );
    });

    it("Should revert with `MaxDIVARewardUSDAlreadyActive` if new max USD DIVA reward is already active", async () => {
      // ---------
      // Arrange: Set next block timestamp
      // ---------
      // Get start time for max DIVA reward USD
      const startTimeMaxDIVARewardUSD = (
        await divaOracleTellor.getMaxDIVARewardUSDInfo()
      ).startTimeMaxDIVARewardUSD.toNumber();

      // Set next block timestamp as after of `startTimeMaxDIVARewardUSD`
      nextBlockTimestamp = startTimeMaxDIVARewardUSD + 1;
      await setNextBlockTimestamp(nextBlockTimestamp);

      // ---------
      // Act & Assert: Confirm that `revokePendingMaxDIVARewardUSDUpdate` function will fail
      // ---------
      await expect(
        divaOracleTellor.revokePendingMaxDIVARewardUSDUpdate()
      ).to.be.revertedWith(
        `MaxDIVARewardUSDAlreadyActive(${nextBlockTimestamp}, ${startTimeMaxDIVARewardUSD})`
      );
    });

    // ---------
    // Events
    // ---------

    it("Should emit a `PendingMaxDIVARewardUSDUpdateRevoked` event", async () => {
      // ---------
      // Act: Call `revokePendingMaxDIVARewardUSDUpdate` function
      // ---------
      const tx = await divaOracleTellor.revokePendingMaxDIVARewardUSDUpdate();
      const receipt = await tx.wait();

      // ---------
      // Assert: Confirm that a `PendingMaxDIVARewardUSDUpdateRevoked` event is emitted with the correct values
      // ---------
      const pendingMaxDIVARewardUSDUpdateRevokedEvent = receipt.events.find(
        (item) => item.event === "PendingMaxDIVARewardUSDUpdateRevoked"
      ).args;
      expect(pendingMaxDIVARewardUSDUpdateRevokedEvent.revokedBy).to.eq(
        user1.address
      );
      expect(
        pendingMaxDIVARewardUSDUpdateRevokedEvent.revokedMaxDIVARewardUSD
      ).to.eq(newMaxDIVARewardUSD);
      expect(
        pendingMaxDIVARewardUSDUpdateRevokedEvent.restoredMaxDIVARewardUSD
      ).to.eq(maxDIVARewardUSD);
    });
  });
});
