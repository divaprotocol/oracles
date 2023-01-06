const { expect } = require("chai");
const { ethers } = require("hardhat");
const DIVA_ABI = require("../contracts/abi/DIVA.json");
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture");
const { parseUnits } = require("@ethersproject/units");
const { getLastTimestamp, setNextTimestamp } = require("../utils/utils");
const {
  ONE_HOUR,
  TEN_MINS,
  DIVA_ADDRESS,
  TELLOR_PLAYGROUND_ADDRESS,
} = require("../utils/constants"); //  DIVA Protocol v1.0.0

const network = "goerli"; // for tellorPlayground address; should be the same as in hardhat -> forking -> url settings in hardhat.config.js
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

describe("DIVAOracleTellor", () => {
  let collateralToken;
  let userStartTokenBalance;
  let user1, user2, user3, reporter, excessFeeRecipient, tipper1, tipper2;

  let divaOracleTellor;
  let tellorPlayground;
  let tellorPlaygroundAddress = TELLOR_PLAYGROUND_ADDRESS[network];
  let divaAddress = DIVA_ADDRESS[network];
  let referenceAsset = "BTC/USD";

  let maxFeeAmountUSD = parseUnits("10");
  let newMaxFeeAmountUSD;

  let minPeriodUndisputed = ONE_HOUR;
  let newMinPeriodUndisputed;

  let poolExpiryTime;
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

  beforeEach(async () => {
    [user1, user2, user3, reporter, excessFeeRecipient, tipper1, tipper2] =
      await ethers.getSigners();

    // Reset block
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            // blockNumber: Choose a value after the block timestamp where contracts used in these tests (DIVA and Tellor) were deployed; align blocknumber accordingly in test script
            // blockNumber: 10932590, // Rinkeby
            // blockNumber: 12750642, // Ropsten
            blockNumber: 8133146, // Goerli
          },
        },
      ],
    });

    // Deploy DIVAOracleTellor contract
    const divaOracleTellorFactory = await ethers.getContractFactory(
      "DIVAOracleTellor"
    );
    divaOracleTellor = await divaOracleTellorFactory.deploy(
      tellorPlaygroundAddress,
      excessFeeRecipient.address,
      minPeriodUndisputed,
      maxFeeAmountUSD,
      divaAddress
    );
    // Check challengeable
    expect(await divaOracleTellor.challengeable()).to.eq(false);

    // Get TellorPlayground contract
    tellorPlayground = await ethers.getContractAt(
      "TellorPlayground",
      tellorPlaygroundAddress
    );

    // Get DIVA contract
    diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

    // Set user start token balance
    userStartTokenBalance = parseUnits("1000000");

    // Deploy collateral token and approve it to DIVA contract
    collateralToken = await erc20DeployFixture(
      "DummyToken",
      "DCT",
      userStartTokenBalance,
      user1.address,
      collateralTokenDecimals
    );
    await collateralToken.approve(diva.address, userStartTokenBalance);

    // Create an expired contingent pool that uses Tellor as the data provider
    poolExpiryTime = (await getLastTimestamp()) + TEN_MINS;
    const tx = await diva.createContingentPool([
      referenceAsset, // reference asset
      poolExpiryTime, // expiryTime
      parseUnits("40000"), // floor
      parseUnits("60000"), // inflection
      parseUnits("80000"), // cap
      parseUnits("0.7", collateralTokenDecimals).toString(), // gradient
      parseUnits("100", collateralTokenDecimals), // collateral amount
      collateralToken.address, // collateral token
      divaOracleTellor.address, // data provider
      parseUnits("200", collateralTokenDecimals).toString(), // capacity
      user1.address, // longRecipient
      user1.address, // shortRecipient
      ethers.constants.AddressZero,
    ]);
    const receipt = await tx.wait();

    latestPoolId = receipt.events?.find((x) => x.event === "PoolIssued")?.args
      ?.poolId;
    poolParams = await diva.getPoolParameters(latestPoolId);

    feesParams = await diva.getFees(latestPoolId);

    // Get chain id
    chainId = (await ethers.provider.getNetwork()).chainId;

    // Prepare Tellor value submission
    [queryData, queryId] = getQueryDataAndId(
      latestPoolId,
      divaAddress,
      chainId
    );

    // Deploy tipping tokens
    tippingToken1 = await erc20DeployFixture(
      "TippingToken1",
      "TPT1",
      userStartTokenBalance,
      tipper1.address,
      tippingTokenDecimals
    );
    tippingToken2 = await erc20DeployFixture(
      "TippingToken2",
      "TPT2",
      userStartTokenBalance,
      tipper2.address,
      tippingTokenDecimals
    );

    // Set tipping amounts
    tippingAmount1 = parseUnits("1000", tippingTokenDecimals);
    tippingAmount2 = parseUnits("2000", tippingTokenDecimals);

    // Approve tipping tokens to DIVAOracleTellor with tipper1, tipper2 addresses
    await tippingToken1
      .connect(tipper1)
      .approve(divaOracleTellor.address, ethers.constants.MaxUint256);
    await tippingToken2
      .connect(tipper2)
      .approve(divaOracleTellor.address, ethers.constants.MaxUint256);
  });

  describe("setFinalReferenceValue functions", async () => {
    beforeEach(async () => {
      // Add tips on DIVAOracleTellor
      await divaOracleTellor
        .connect(tipper1)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);
      await divaOracleTellor
        .connect(tipper2)
        .addTip(latestPoolId, tippingAmount2, tippingToken2.address);
    });

    describe("setFinalReferenceValue", async () => {
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
        lastBlockTimestamp = await getLastTimestamp();
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

      it("Should set a reported Tellor value as the final reference value in DIVA Protocol and leave tips and fee claims in DIVA unclaimed", async () => {
        // ---------
        // Arrange: Confirm params and submit values to tellorPlayground
        // ---------
        // Get tips and balances for tippingToken1
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Get tips and balances for tippingToken2
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check collateral token balance for reporter
        expect(await collateralToken.balanceOf(reporter.address)).to.eq(0);

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
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
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
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId);

        // ---------
        // Assert: Confirm that finalReferenceValue, statusFinalReferenceValue and feeClaim in DIVA Protocol are updated
        // but tipping token and collateral token balances remain unchanged
        // ---------
        // Check that finalReferenceValue and statusFinalReferenceValue are updated in DIVA Protocol
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
        expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

        // Check that the fee claim was allocated to the reporter in DIVA Protocol
        expect(
          await diva.getClaim(collateralToken.address, reporter.address)
        ).to.eq(settlementFeeAmount);

        // Check that tips and balances for tippinToken1 are unchanged
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Check that tips and balances for tippinToken2 are unchanged
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check that the reporter's collateral token balance is unchanged (as the DIVA fee claim resides inside DIVA Protocol)
        expect(await collateralToken.balanceOf(reporter.address)).to.eq(0);
      });

      it("Should take the second value if the first one was submitted before expiryTime and the second one afterwards", async () => {
        // ---------
        // Arrange: Create a contingent pool with expiry time in the future, prepare the submission to tellorPlayground
        // and submit two values, one before and one after expiration
        // ---------
        const tx = await diva.createContingentPool([
          referenceAsset, // reference asset
          poolExpiryTime, // expiryTime
          parseUnits("40000"), // floor
          parseUnits("60000"), // inflection
          parseUnits("80000"), // cap
          parseUnits("0.7", collateralTokenDecimals).toString(), // gradient
          parseUnits("100", collateralTokenDecimals), // collateral amount
          collateralToken.address, // collateral token
          divaOracleTellor.address, // data provider
          parseUnits("200", collateralTokenDecimals).toString(), // capacity
          user1.address, // longRecipient
          user1.address, // shortRecipient
          ethers.constants.AddressZero,
        ]);
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

        // First reporter submission prior to expiration
        finalReferenceValue1 = parseUnits("42000");
        collateralToUSDRate1 = parseUnits("1.14");
        oracleValue1 = encodeOracleValue(
          finalReferenceValue1,
          collateralToUSDRate1
        );
        nextBlockTimestamp = poolParams.expiryTime.sub(1);
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
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
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue2, 0, queryData);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed` has passed
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed; // has to be `minPeriodDisputed` after the time of the second submission (assumed to be 1 second after expiration)
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId);

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
        // Arrange: Create a contingent pool with expiry time in the future, prepare the submission to tellorPlayground
        // and submit two values, begin dispute for first one
        // ---------
        const tx = await diva.createContingentPool([
          referenceAsset, // reference asset
          poolExpiryTime, // expiryTime
          parseUnits("40000"), // floor
          parseUnits("60000"), // inflection
          parseUnits("80000"), // cap
          parseUnits("0.7", collateralTokenDecimals).toString(), // gradient
          parseUnits("100", collateralTokenDecimals), // collateral amount
          collateralToken.address, // collateral token
          divaOracleTellor.address, // data provider
          parseUnits("200", collateralTokenDecimals).toString(), // capacity
          user1.address, // longRecipient
          user1.address, // shortRecipient
          ethers.constants.AddressZero,
        ]);
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

        nextBlockTimestamp = poolParams.expiryTime.add(1);
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());

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
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed; // has to be `minPeriodDisputed` after the time of the second submission (assumed to be 1 second after expiration)
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId);

        // ---------
        // Assert: Confirm that the second value was set as the final
        // ---------
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(await poolParams.statusFinalReferenceValue).to.eq(3);
        expect(await poolParams.finalReferenceValue).to.eq(
          finalReferenceValue2
        );
      });

      it("Allocates all the settlement fee to reporter if it is below maxFeeAmountUSD", async () => {
        // ---------
        // Arrange: Confirm that user1's fee claim balance is zero, report value and calculate USD denominated fee
        // ---------
        // Confirm that user1's fee claim balance is zero
        expect(
          await diva.getClaim(collateralToken.address, user1.address)
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
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in collateral token and USD denominated fee
        const [settlementFeeAmount, settlementFeeAmountUSD] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        );
        expect(settlementFeeAmountUSD).to.be.lte(maxFeeAmountUSD);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed`
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(latestPoolId);

        // ---------
        // Assert: Confirm that the reporter receives the full settlement fee payment (in collateral asset) and 0 goes to excess fee recipient
        // ---------
        expect(
          await diva.getClaim(collateralToken.address, reporter.address)
        ).to.eq(settlementFeeAmount);
        expect(
          await diva.getClaim(
            collateralToken.address,
            excessFeeRecipient.address
          )
        ).to.eq(0);
      });

      it("Should split the fee between reporter and excess fee recipient if fee amount exceeds maxFeeAmountUSD", async () => {
        // ---------
        // Arrange: Create a contingent pool where settlement fee exceeds maxFeeAmountUSD
        // ---------
        poolExpiryTime = (await getLastTimestamp()) + TEN_MINS;
        const tx = await diva.createContingentPool([
          referenceAsset, // reference asset
          poolExpiryTime, // expiryTime
          parseUnits("40000"), // floor
          parseUnits("60000"), // inflection
          parseUnits("80000"), // cap
          parseUnits("0.7", collateralTokenDecimals).toString(), // gradient
          parseUnits("100000", collateralTokenDecimals), // collateral amount
          collateralToken.address, // collateral token
          divaOracleTellor.address, // data provider
          parseUnits("200000", collateralTokenDecimals).toString(), // capacity
          user1.address, // longRecipient
          user1.address, // shortRecipient
          ethers.constants.AddressZero,
        ]);
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
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in both collateral token and USD
        const [feeAmount, feeAmountUSD] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        ); // feeAmount is expressed as an integer with collateral token decimals and feeAmountUSD with 18 decimals

        // Confirm that implied USD value of fee exceeds maxFeeAmountUSD
        expect(feeAmountUSD).to.be.gte(maxFeeAmountUSD);

        // Calc max fee amount in collateral token
        const maxFeeAmount = maxFeeAmountUSD
          .mul(parseUnits("1"))
          .div(collateralToUSDRate)
          .div(parseUnits("1", 18 - collateralTokenDecimals)); // in collateral token decimals

        // Get reporter's and excess fee recipient's fee claim before the final reference value is set
        const feeClaimReporterBefore = await diva.getClaim(
          collateralToken.address,
          reporter.address
        );
        const feeClaimExcessFeeRecipientBefore = await diva.getClaim(
          collateralToken.address,
          excessFeeRecipient.address
        );
        expect(feeClaimReporterBefore).to.eq(0);
        expect(feeClaimExcessFeeRecipientBefore).to.eq(0);

        // Set random user that is going to trigger the `setFinalReferenceValue` function after the value has been submitted to the Tellor oracle
        // and confirm that the diva claim balance is zero
        const randomUser = user3;
        const feeClaimRandomUserBefore = await diva.getClaim(
          collateralToken.address,
          randomUser.address
        );
        expect(feeClaimRandomUserBefore).to.eq(0);

        // Confirm that the random user is not the DIVA treasury address
        const governanceParameters = await diva.getGovernanceParameters();
        expect(randomUser).to.not.eq(governanceParameters.treasury);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed`
        // from a random user account
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(randomUser)
          .setFinalReferenceValue(latestPoolId); // triggered by a random user

        // ---------
        // Assert: Confirm that the reporter and excess fee recipient are allocated the correct amount of fees and
        // user2 (who triggered the setFinalReferenceFunction) and the divaOracleTellor contract are not
        // allocated any fees
        // ---------
        const feeClaimReporterAfter = await diva.getClaim(
          collateralToken.address,
          reporter.address
        );
        const feeClaimExcessFeeRecipientAfter = await diva.getClaim(
          collateralToken.address,
          excessFeeRecipient.address
        );
        const feeClaimRandomUserAfter = await diva.getClaim(
          collateralToken.address,
          randomUser.address
        );

        expect(feeClaimReporterAfter).to.eq(
          feeClaimReporterBefore.add(maxFeeAmount)
        );
        expect(feeClaimExcessFeeRecipientAfter).to.eq(
          feeClaimExcessFeeRecipientBefore.add(feeAmount.sub(maxFeeAmount))
        );
        expect(feeClaimRandomUserAfter).to.eq(0);
        expect(
          await diva.getClaim(collateralToken.address, divaOracleTellor.address)
        ).to.eq(0);
      });

      it("Should allocate all fees to reporter if collateralToUSDRate = 0 (should typically be disputed by the Tellor mechanism)", async () => {
        // ---------
        // Arrange: Create a contingent pool where settlement fee exceeds maxFeeAmountUSD and report zero collateralToUSDRate
        // ---------
        poolExpiryTime = (await getLastTimestamp()) + TEN_MINS;
        const tx = await diva.createContingentPool([
          referenceAsset, // reference asset
          poolExpiryTime, // expiryTime
          parseUnits("40000"), // floor
          parseUnits("60000"), // inflection
          parseUnits("80000"), // cap
          parseUnits("0.7", collateralTokenDecimals).toString(), // gradient
          parseUnits("100000", collateralTokenDecimals), // collateral amount
          collateralToken.address, // collateral token
          divaOracleTellor.address, // data provider
          parseUnits("200000", collateralTokenDecimals).toString(), // capacity
          user1.address, // longRecipient
          user1.address, // shortRecipient
          ethers.constants.AddressZero,
        ]);
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

        // Report value to tellor playground with collateralToUSDRate = 0
        finalReferenceValue = parseUnits("42000");
        collateralToUSDRate = parseUnits("0");
        oracleValue = encodeOracleValue(
          finalReferenceValue,
          collateralToUSDRate
        );
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // Calculate settlement fee expressed in both collateral token and USD
        const [feeAmount] = calcSettlementFee(
          poolParams.collateralBalance,
          feesParams.settlementFee,
          collateralTokenDecimals,
          collateralToUSDRate
        ); // feeAmount is expressed as an integer with collateral token decimals and feeAmountUSD with 18 decimals

        // Get reporter's and excess fee recipient's fee claim before the final reference value is set
        const feeClaimReporterBefore = await diva.getClaim(
          collateralToken.address,
          reporter.address
        );
        const feeClaimExcessFeeRecipientBefore = await diva.getClaim(
          collateralToken.address,
          excessFeeRecipient.address
        );
        expect(feeClaimReporterBefore).to.eq(0);
        expect(feeClaimExcessFeeRecipientBefore).to.eq(0);

        // Set random user that is going to trigger the `setFinalReferenceValue` function after the value has been submitted to the Tellor oracle
        // and confirm that the diva claim balance is zero
        const randomUser = user3;
        const feeClaimRandomUserBefore = await diva.getClaim(
          collateralToken.address,
          randomUser.address
        );
        expect(feeClaimRandomUserBefore).to.eq(0);

        // Confirm that the random user is not the DIVA treasury address
        const governanceParameters = await diva.getGovernanceParameters();
        expect(randomUser).to.not.eq(governanceParameters.treasury);

        // ---------
        // Act: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after `minPeriodUndisputed`
        // from a random user account
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(randomUser)
          .setFinalReferenceValue(latestPoolId); // triggered by a random user

        // ---------
        // Assert: Confirm that the reporter and excess fee recipient are allocated the correct amount of fees and
        // user2 (who triggered the setFinalReferenceFunction) and the divaOracleTellor contract are not
        // allocated any fees
        // ---------
        const feeClaimReporterAfter = await diva.getClaim(
          collateralToken.address,
          reporter.address
        );
        const feeClaimExcessFeeRecipientAfter = await diva.getClaim(
          collateralToken.address,
          excessFeeRecipient.address
        );
        const feeClaimRandomUserAfter = await diva.getClaim(
          collateralToken.address,
          randomUser.address
        );

        expect(feeClaimReporterAfter).to.eq(feeAmount);
        expect(feeClaimExcessFeeRecipientAfter).to.eq(0);
        expect(feeClaimRandomUserAfter).to.eq(0);
        expect(
          await diva.getClaim(collateralToken.address, divaOracleTellor.address)
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
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // ---------
        // Act & Assert: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract shortly after
        // `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp =
          (await getLastTimestamp()) + minPeriodUndisputed - 1;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await expect(
          divaOracleTellor.connect(user2).setFinalReferenceValue(latestPoolId)
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
          divaOracleTellor.connect(user2).setFinalReferenceValue(latestPoolId)
        ).to.be.revertedWith("NoOracleSubmissionAfterExpiryTime()");
      });

      it("Should revert if a value has been reported prior to expiryTime only", async () => {
        // ---------
        // Arrange: Create a non-expired pool and submit one value prior to expiration
        // ---------
        const tx = await diva.createContingentPool([
          referenceAsset, // reference asset
          poolExpiryTime, // expiryTime
          parseUnits("40000"), // floor
          parseUnits("60000"), // inflection
          parseUnits("80000"), // cap
          parseUnits("0.7", collateralTokenDecimals).toString(), // gradient
          parseUnits("100", collateralTokenDecimals), // collateral amount
          collateralToken.address, // collateral token
          divaOracleTellor.address, // data provider
          parseUnits("200", collateralTokenDecimals).toString(), // capacity
          user1.address, // longRecipient
          user1.address, // shortRecipient
          ethers.constants.AddressZero,
        ]);
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
          divaOracleTellor.connect(user2).setFinalReferenceValue(latestPoolId)
        ).to.be.revertedWith("NoOracleSubmissionAfterExpiryTime()");
      });
    });

    describe("setFinalReferenceValueAndClaimTipsAndDIVAFee", async () => {
      it("Should set a reported Tellor value as the final reference value in DIVA Protocol and claim tips and DIVA fee", async () => {
        // ---------
        // Arrange: Confirm params and submit values to tellorPlayground
        // ---------
        // Get tips and balances for tippingToken1
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Get tips and balances for tippingToken2
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check collateral token balance for reporter
        expect(await collateralToken.balanceOf(reporter.address)).to.eq(0);

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
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
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
        // Act: Call `setFinalReferenceValueAndClaimTipsAndDIVAFee` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValueAndClaimTipsAndDIVAFee(latestPoolId, [
            tippingToken1.address,
            tippingToken2.address,
          ]);

        // ---------
        // Assert: Confirm that finalReferenceValue and statusFinalReferenceValue in DIVA Protocol as well as
        // token balances are updated correctly
        // ---------
        // Check finalReferenceValue and statusFinalReferenceValue
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
        expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

        // Check that tips and balances for tippinToken1 are updated correctly
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
        ).to.eq(0);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          0
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
          tippingAmount1
        );

        // Check that tips and balances for tippinToken2 are updated correctly
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
        ).to.eq(0);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          0
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
          tippingAmount2
        );

        // Check that reporter received the DIVA fee
        expect(await collateralToken.balanceOf(reporter.address)).to.eq(
          settlementFeeAmount
        );

        // Check that reporter's fee claim on DIVA Protocol dropped to zero
        expect(
          await diva.getClaim(collateralToken.address, reporter.address)
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
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
        await tellorPlayground
          .connect(reporter)
          .submitValue(queryId, oracleValue, 0, queryData);

        // ---------
        // Act: Call `setFinalReferenceValueAndClaimTipsAndDIVAFee` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        const tx = await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValueAndClaimTipsAndDIVAFee(latestPoolId, [
            tippingToken1.address,
            tippingToken2.address,
          ]);
        const response = await tx.wait();

        // ---------
        // Assert: Confirm that a FinalReferenceValueSet event and TipClaimed events are emitted with the correct values
        // ---------
        // Check FinalReferenceValueSet event
        const timestampRetrieved =
          await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0);
        const finalReferenceValueSetEvent = response.events.find(
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
        const tipClaimedEvents = response.events.filter(
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

    describe("setFinalReferenceValueAndClaimDIVAFee", async () => {
      it("Should set a reported Tellor value as the final reference value in DIVA Protocol and claim DIVA fee but leave tips unchanged", async () => {
        // ---------
        // Arrange: Confirm params and submit values to tellorPlayground
        // ---------
        // Get tips and balances for tippingToken1
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Get tips and balances for tippingToken2
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check collateral token balance for reporter
        expect(await collateralToken.balanceOf(reporter.address)).to.eq(0);

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
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
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
        // Act: Call `setFinalReferenceValueAndClaimDIVAFee` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValueAndClaimDIVAFee(latestPoolId);

        // ---------
        // Assert: Confirm that finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol
        // the fee claim is transferred to the reporter but fees remain unclaimed
        // ---------
        // Check that finalReferenceValue and statusFinalReferenceValue are updated in DIVA Protocol
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
        expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

        // Check that reporter's fee claim on DIVA Protocol dropped to zero
        expect(
          await diva.getClaim(collateralToken.address, reporter.address)
        ).to.eq(0);

        // Check that the reporter's collateral token balance increased to `settlementFeeAmount`
        expect(await collateralToken.balanceOf(reporter.address)).to.eq(
          settlementFeeAmount
        );

        // Check tips and balances for tippinToken1 are unchanged
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Check tips and balances for tippinToken2  are unchanged
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);
      });
    });

    describe("setFinalReferenceValueAndClaimTips", async () => {
      it("Should set a reported Tellor value as the final reference value in DIVA Protocol and claim tips but not DIVA fee", async () => {
        // ---------
        // Arrange: Confirm params and submit values to tellorPlayground
        // ---------
        // Get tips and balances for tippingToken1
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
        ).to.eq(tippingAmount1);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount1
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

        // Get tips and balances for tippingToken2
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
        ).to.eq(tippingAmount2);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          tippingAmount2
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

        // Check collateral token balance for reporter
        expect(await collateralToken.balanceOf(reporter.address)).to.eq(0);

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
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
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
        // Act: Call `setFinalReferenceValueAndClaimTips` function inside DIVAOracleTellor
        // contract after exactly `minPeriodUndisputed` period has passed
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
        await setNextTimestamp(ethers.provider, nextBlockTimestamp);
        await divaOracleTellor
          .connect(user2)
          .setFinalReferenceValueAndClaimTips(latestPoolId, [
            tippingToken1.address,
            tippingToken2.address,
          ]);

        // ---------
        // Assert: Confirm that finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol,
        // claims are transferred to reporter but DIVA fee remains unclaimed in the DIVA Protocol
        // ---------
        // Check finalReferenceValue and statusFinalReferenceValue
        poolParams = await diva.getPoolParameters(latestPoolId);
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
        expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

        // Check tips and balances for tippinToken1 were updated correctly
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
        ).to.eq(0);
        expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
          0
        );
        expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
          tippingAmount1
        );

        // Check that tips and balances for tippinToken2 were updated correctly
        expect(
          await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
        ).to.eq(0);
        expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
          0
        );
        expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
          tippingAmount2
        );

        // Check the reporter's fee claim on DIVA Protocol is unchanged
        expect(
          await diva.getClaim(collateralToken.address, reporter.address)
        ).to.eq(settlementFeeAmount);

        // Check that the reporter's collateral token balance is unchanged
        expect(await collateralToken.balanceOf(reporter.address)).to.eq(0);
      });
    });
  });

  describe("addTip", async () => {
    it("Should add tip to DIVAOracleTellor", async () => {
      // ---------
      // Arrange: Check that there's no tip added for latestPoolId
      // ---------
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(0);
      expect(
        (await divaOracleTellor.getTippingTokens([latestPoolId]))[0].length
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);

      // ---------
      // Act: Add tip
      // ---------
      await divaOracleTellor
        .connect(tipper1)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);

      // ---------
      // Assert: Check that tip is added on divaOracleTellor correctly
      // ---------
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(tippingAmount1);
      expect(
        (await divaOracleTellor.getTippingTokens([latestPoolId]))[0][0]
      ).to.eq(tippingToken1.address);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
    });

    it("Should add second tip with same tipping token after add first tip to DIVAOracleTellor", async () => {
      // ---------
      // Arrange: Add first tip and set second tipping amount
      // ---------
      await divaOracleTellor
        .connect(tipper1)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);

      const secondTippingAmount = parseUnits("3000", tippingTokenDecimals);

      // ---------
      // Act: Add second tip in the same tipping token as the first tip
      // ---------
      await divaOracleTellor
        .connect(tipper1)
        .addTip(latestPoolId, secondTippingAmount, tippingToken1.address);

      // ---------
      // Assert: Check that tip is increased on divaOracleTellor correctly
      // ---------
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(secondTippingAmount.add(tippingAmount1));
      expect(
        (await divaOracleTellor.getTippingTokens([latestPoolId]))[0].length
      ).to.eq(1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        secondTippingAmount.add(tippingAmount1)
      );
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
      oracleValue = encodeOracleValue(finalReferenceValue, collateralToUSDRate);

      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId);

      // ---------
      // Act & Assert: Confirm that tip function will fail if called after `setFinalReferenceValue` function is called
      // ---------
      await expect(
        divaOracleTellor
          .connect(tipper1)
          .addTip(latestPoolId, tippingAmount1, tippingToken1.address)
      ).to.be.revertedWith("AlreadyConfirmedPool()");
    });

    // ---------
    // Events
    // ---------

    it("Should emit a TipAdded event", async () => {
      // ---------
      // Act: Add tip
      // ---------
      const tx = await divaOracleTellor
        .connect(tipper1)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);
      const response = await tx.wait();

      // ---------
      // Assert: Confirm that a TipAdded event is emitted with the correct values
      // ---------
      const tipAddedEvent = response.events.find(
        (item) => item.event === "TipAdded"
      );
      expect(tipAddedEvent.args.poolId).to.eq(latestPoolId);
      expect(tipAddedEvent.args.tippingToken).to.eq(tippingToken1.address);
      expect(tipAddedEvent.args.amount).to.eq(tippingAmount1);
      expect(tipAddedEvent.args.tipper).to.eq(tipper1.address);
    });
  });

  describe("claim functions", async () => {
    beforeEach(async () => {
      // Add tips
      await divaOracleTellor
        .connect(tipper1)
        .addTip(latestPoolId, tippingAmount1, tippingToken1.address);
      await divaOracleTellor
        .connect(tipper2)
        .addTip(latestPoolId, tippingAmount2, tippingToken2.address);

      // Prepare Tellor value submission
      [queryData, queryId] = getQueryDataAndId(
        latestPoolId,
        divaAddress,
        chainId
      );

      finalReferenceValue = parseUnits("42000");
      collateralToUSDRate = parseUnits("1.14");
      oracleValue = encodeOracleValue(finalReferenceValue, collateralToUSDRate);
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);
    });

    it("Should claim tips after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and check tips
      // ---------
      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId);

      // Check tips and balances for tippingToken1 before calling `claimTips`
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `claimTips`
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token
      const [settlementFeeAmount] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check fee claim in DIVA
      expect(
        await diva.getClaim(collateralToken.address, reporter.address)
      ).to.eq(settlementFeeAmount);

      // ---------
      // Act: Call `claimTips` function
      // ---------
      await divaOracleTellor.claimTips(latestPoolId, [
        tippingToken1.address,
        tippingToken2.address,
      ]);

      // ---------
      // Assert: Check tips are paid to reporter but DIVA fee claims remain untouched
      // ---------
      // Check that tips are paid out to reporter
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
        tippingAmount1
      );
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
      ).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
        tippingAmount2
      );

      // Confirm that DIVA fee remains unchanged
      expect(
        await diva.getClaim(collateralToken.address, reporter.address)
      ).to.eq(settlementFeeAmount);
    });

    it("Should claim DIVA fee after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and calc settlementFeeAmount
      // ---------
      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId);

      // Check tips and balances for tippingToken1 before calling `claimTips`
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `claimTips`
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token
      const [settlementFeeAmount] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check fee claim in DIVA
      expect(
        await diva.getClaim(collateralToken.address, reporter.address)
      ).to.eq(settlementFeeAmount);

      // ---------
      // Act: Call `claimDIVAFee` function
      // ---------
      await divaOracleTellor.claimDIVAFee(latestPoolId);

      // ---------
      // Assert: Check that DIVA fee was claimed but tips remain untouched
      // ---------
      // Check that DIVA fee was claimed and sent to reporter
      expect(await collateralToken.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount
      );
      expect(
        await diva.getClaim(collateralToken.address, reporter.address)
      ).to.eq(0);

      // Check that tips and balances for tippingToken1 are unchanged
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 are unchanged
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);
    });

    it("Should claim tips and DIVA fee after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and check tips
      // ---------
      // Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId);

      // Check tips and balances for tippingToken1 before calling `claimTips`
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(tippingAmount1);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `claimTips`
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
      ).to.eq(tippingAmount2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token
      const [settlementFeeAmount] = calcSettlementFee(
        poolParams.collateralBalance,
        feesParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      );

      // Check fee claim in DIVA
      expect(
        await diva.getClaim(collateralToken.address, reporter.address)
      ).to.eq(settlementFeeAmount);

      // ---------
      // Act: Call claimTipsAndDIVAFee function
      // ---------
      await divaOracleTellor.claimTipsAndDIVAFee(latestPoolId, [
        tippingToken1.address,
        tippingToken2.address,
      ]);

      // ---------
      // Assert: Check that tips and DIVA fees were paid out to the reporter
      // ---------
      // Confirm that tips were paid out to the reporter
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken1.address)
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
        tippingAmount1
      );
      expect(
        await divaOracleTellor.getTip(latestPoolId, tippingToken2.address)
      ).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
        tippingAmount2
      );

      // Confirm that DIVA fee were paid out to the reporter
      expect(await collateralToken.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount
      );
      expect(
        await diva.getClaim(collateralToken.address, reporter.address)
      ).to.eq(0);
    });

    // ---------
    // Revert
    // ---------

    it("Should revert if users try to claim tips and DIVA fee for not confirmed pool", async () => {
      // ---------
      // Act & Assert: Confirm that `claimTipsAndDIVAFee` function will fail if called before `setFinalReferenceValue` function is called
      // ---------
      await expect(
        divaOracleTellor.claimTipsAndDIVAFee(latestPoolId, [
          tippingToken1.address,
          tippingToken2.address,
        ])
      ).to.be.revertedWith("NotConfirmedPool()");
    });

    // ---------
    // Events
    // ---------

    it("Should emit TipClaimed events", async () => {
      // ---------
      // Arrange: Call `setFinalReferenceValue` function inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(latestPoolId);

      // ---------
      // Act: Call claimTipsAndDIVAFee function
      // ---------
      const tx = await divaOracleTellor.claimTipsAndDIVAFee(latestPoolId, [
        tippingToken1.address,
        tippingToken2.address,
      ]);
      const response = await tx.wait();

      // ---------
      // Assert: Confirm that a TipClaimed events are emitted with the correct values
      // ---------
      const tipClaimedEvents = response.events.filter(
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

  describe("batch version claim functions", async () => {
    let poolId1, poolId2;
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
      feesParams1 = await diva.getFees(poolId1);

      // Create an expired contingent pool that uses Tellor as the data provider
      poolExpiryTime = (await getLastTimestamp()) + TEN_MINS;
      const tx = await diva.createContingentPool([
        referenceAsset, // reference asset
        poolExpiryTime, // expiryTime
        parseUnits("40000"), // floor
        parseUnits("60000"), // inflection
        parseUnits("80000"), // cap
        parseUnits("0.7", collateralTokenDecimals).toString(), // gradient
        parseUnits("100", collateralTokenDecimals), // collateral amount
        collateralToken.address, // collateral token
        divaOracleTellor.address, // data provider
        parseUnits("200", collateralTokenDecimals).toString(), // capacity
        user1.address, // longRecipient
        user1.address, // shortRecipient
        ethers.constants.AddressZero,
      ]);
      const receipt = await tx.wait();

      // Set poolId2
      poolId2 = receipt.events?.find((x) => x.event === "PoolIssued")?.args
        ?.poolId;
      poolParams2 = await diva.getPoolParameters(poolId2);
      feesParams2 = await diva.getFees(poolId2);

      // Add tips for poolId1
      await divaOracleTellor
        .connect(tipper1)
        .addTip(poolId1, tippingAmount1ForPoolId1, tippingToken1.address);
      await divaOracleTellor
        .connect(tipper2)
        .addTip(poolId1, tippingAmount2ForPoolId1, tippingToken2.address);

      // Add tips for poolId2
      await divaOracleTellor
        .connect(tipper1)
        .addTip(poolId2, tippingAmount1ForPoolId2, tippingToken1.address);
      await divaOracleTellor
        .connect(tipper2)
        .addTip(poolId2, tippingAmount2ForPoolId2, tippingToken2.address);

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
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);

      finalReferenceValue = parseUnits("42000");
      collateralToUSDRate = parseUnits("1.14");
      oracleValue = encodeOracleValue(finalReferenceValue, collateralToUSDRate);
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

    it("Should batch claim tips after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and check tips
      // ---------
      // Call `setFinalReferenceValue` function for poolId1 and poolId2 inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor.connect(user2).setFinalReferenceValue(poolId1);
      await divaOracleTellor.connect(user2).setFinalReferenceValue(poolId2);

      // Check tips and balances for tippingToken1 before calling `batchClaimTips`
      expect(
        await divaOracleTellor.getTip(poolId1, tippingToken1.address)
      ).to.eq(tippingAmount1ForPoolId1);
      expect(
        await divaOracleTellor.getTip(poolId2, tippingToken1.address)
      ).to.eq(tippingAmount1ForPoolId2);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `batchClaimTips`
      expect(
        await divaOracleTellor.getTip(poolId1, tippingToken2.address)
      ).to.eq(tippingAmount2ForPoolId1);
      expect(
        await divaOracleTellor.getTip(poolId2, tippingToken2.address)
      ).to.eq(tippingAmount2ForPoolId2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // ---------
      // Act: Call `batchClaimTips` function
      // ---------
      await divaOracleTellor.batchClaimTips(
        [poolId1, poolId2],
        [tippingToken1.address, tippingToken2.address]
      );

      // ---------
      // Assert: Check tips are paid to reporter
      // ---------
      expect(
        await divaOracleTellor.getTip(poolId1, tippingToken1.address)
      ).to.eq(0);
      expect(
        await divaOracleTellor.getTip(poolId2, tippingToken1.address)
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(
        await divaOracleTellor.getTip(poolId1, tippingToken2.address)
      ).to.eq(0);
      expect(
        await divaOracleTellor.getTip(poolId2, tippingToken2.address)
      ).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );
    });

    it("Should batch claim tips and DIVA fee after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value and check tips
      // ---------
      // Call `setFinalReferenceValue` function for poolId1 and poolId2 inside DIVAOracleTellor contract after exactly `minPeriodUndisputed` period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor.connect(user2).setFinalReferenceValue(poolId1);
      await divaOracleTellor.connect(user2).setFinalReferenceValue(poolId2);

      // Check tips and balances for tippingToken1 before calling `batchClaimTips`
      expect(
        await divaOracleTellor.getTip(poolId1, tippingToken1.address)
      ).to.eq(tippingAmount1ForPoolId1);
      expect(
        await divaOracleTellor.getTip(poolId2, tippingToken1.address)
      ).to.eq(tippingAmount1ForPoolId2);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(0);

      // Check tips and balances for tippingToken2 before calling `batchClaimTips`
      expect(
        await divaOracleTellor.getTip(poolId1, tippingToken2.address)
      ).to.eq(tippingAmount2ForPoolId1);
      expect(
        await divaOracleTellor.getTip(poolId2, tippingToken2.address)
      ).to.eq(tippingAmount2ForPoolId2);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(0);

      // Calculate settlement fee expressed in collateral token
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

      // Check fee claim in DIVA
      expect(
        await diva.getClaim(collateralToken.address, reporter.address)
      ).to.eq(settlementFeeAmount1.add(settlementFeeAmount2));

      // ---------
      // Act: Call claimTipsAndDIVAFee function
      // ---------
      await divaOracleTellor.batchClaimTipsAndDIVAFee(
        [poolId1, poolId2],
        [tippingToken1.address, tippingToken2.address]
      );

      // ---------
      // Assert: Check that tips and DIVA fees were paid out to the reporter
      // ---------
      // Confirm that tips were paid out to the reporter
      expect(
        await divaOracleTellor.getTip(poolId1, tippingToken1.address)
      ).to.eq(0);
      expect(
        await divaOracleTellor.getTip(poolId2, tippingToken1.address)
      ).to.eq(0);
      expect(await tippingToken1.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken1.balanceOf(reporter.address)).to.eq(
        tippingAmount1ForPoolId1.add(tippingAmount1ForPoolId2)
      );
      expect(
        await divaOracleTellor.getTip(poolId1, tippingToken2.address)
      ).to.eq(0);
      expect(
        await divaOracleTellor.getTip(poolId2, tippingToken2.address)
      ).to.eq(0);
      expect(await tippingToken2.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken2.balanceOf(reporter.address)).to.eq(
        tippingAmount2ForPoolId1.add(tippingAmount2ForPoolId2)
      );

      // Confirm that DIVA fee were paid out to the reporter
      expect(await collateralToken.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount1.add(settlementFeeAmount2)
      );
      expect(
        await diva.getClaim(collateralToken.address, reporter.address)
      ).to.eq(0);
    });
  });

  describe("setMinPeriodUndisputed", async () => {
    it("Should set minPeriodUndisputed", async () => {
      // ---------
      // Arrange: Set newMinPeriodUndisputed
      // ---------
      newMinPeriodUndisputed = ONE_HOUR + TEN_MINS;

      // ---------
      // Act: Call setMinPeriodUndisputed function
      // ---------
      await divaOracleTellor.setMinPeriodUndisputed(newMinPeriodUndisputed);

      // ---------
      // Assert: Check that minPeriodUndisputed is updated on divaOracleTellor correctly
      // ---------
      expect(await divaOracleTellor.getMinPeriodUndisputed()).to.eq(
        newMinPeriodUndisputed
      );
    });

    // ---------
    // Reverts
    // ---------

    it("Should revert if new minPeriodUndisputed is smaller than 3600", async () => {
      // ---------
      // Arrange: Set newMinPeriodUndisputed smaller than 3600
      // ---------
      newMinPeriodUndisputed = ONE_HOUR - 1;

      // ---------
      // Act & Assert: Confirm that setMinPeriodUndisputed function will fail
      // ---------
      await expect(
        divaOracleTellor.setMinPeriodUndisputed(newMinPeriodUndisputed)
      ).to.be.revertedWith("OutOfRange()");
    });

    it("Should revert if new minPeriodUndisputed is bigger than 64800", async () => {
      // ---------
      // Arrange: Set newMinPeriodUndisputed bigger than 64800
      // ---------
      newMinPeriodUndisputed = 18 * ONE_HOUR + 1;

      // ---------
      // Act & Assert: Confirm that setMinPeriodUndisputed function will fail
      // ---------
      await expect(
        divaOracleTellor.setMinPeriodUndisputed(newMinPeriodUndisputed)
      ).to.be.revertedWith("OutOfRange()");
    });
  });

  describe("setMaxFeeAmountUSD", async () => {
    it("Should set maxFeeAmountUSD", async () => {
      // ---------
      // Arrange: Set newMaxFeeAmountUSD
      // ---------
      newMaxFeeAmountUSD = parseUnits("20");

      // ---------
      // Act: Call setMaxFeeAmountUSD function
      // ---------
      await divaOracleTellor.setMaxFeeAmountUSD(newMaxFeeAmountUSD);

      // ---------
      // Assert: Check that maxFeeAmountUSD is updated on divaOracleTellor correctly
      // ---------
      expect(await divaOracleTellor.getMaxFeeAmountUSD()).to.eq(
        newMaxFeeAmountUSD
      );
    });
  });

  describe("setExcessFeeRecipient", async () => {
    it("Should set excessFeeRecipient", async () => {
      // ---------
      // Arrange: Confirm that user2 is not current excessFeeRecipient
      // ---------
      expect(await divaOracleTellor.getExcessFeeRecipient()).not.eq(
        user2.address
      );

      // ---------
      // Act: Call setExcessFeeRecipient function
      // ---------
      await divaOracleTellor.setExcessFeeRecipient(user2.address);

      // ---------
      // Assert: Check that excessFeeRecipient is updated on divaOracleTellor correctly
      // ---------
      expect(await divaOracleTellor.getExcessFeeRecipient()).to.eq(
        user2.address
      );
    });

    // ---------
    // Revert
    // ---------

    it("Should revert if new excessFeeRecipient is zero address", async () => {
      // ---------
      // Act & Assert: Confirm that setExcessFeeRecipient function will fail with zero address
      // ---------
      await expect(
        divaOracleTellor.setExcessFeeRecipient(ethers.constants.AddressZero)
      ).to.be.revertedWith("ZeroExcessFeeRecipient()");
    });
  });
});
