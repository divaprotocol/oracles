const { expect } = require("chai");
const { ethers } = require("hardhat");
const DIVA_ABI = require("../contracts/abi/DIVA.json");
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture");
const { parseEther, parseUnits } = require("@ethersproject/units");
const {
  getLastTimestamp,
  setNextTimestamp,
  ONE_HOUR,
  TEN_MINS,
} = require("./utils.js");
const { addresses, tellorPlaygroundAddresses } = require("../utils/constants"); //  DIVA Protocol v1.0.0
const {
  // finalReferenceValueSetEvents,
  // tipAddedEvents,
  // tipClaimedEvents,
} = require("./events");

const network = "ropsten"; // for tellorPlayground address; should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 6;
const tippingTokenDecimals = 6;

function calcSettlementFee(
  collateralBalance, // Basis for fee calcuation
  fee, // Settlement fee percent expressed as an integer with 18 decimals
  collateralTokenDecimals,
  collateralToUSDRate // USD value of one unit of collateral token
) {
  // Fee amount in collateral token decimals
  feeAmount = collateralBalance.mul(fee).div(parseEther("1"));

  // Fee amount in USD expressed as integer with 18 decimals
  feeAmountUSD = feeAmount
    .mul(parseUnits("1", 18 - collateralTokenDecimals))
    .mul(collateralToUSDRate)
    .div(parseEther("1"));

  return {
    feeAmount, // expressed as integer with collateral token decimals
    feeAmountUSD, // expressed as integer with 18 decimals
  };
}

describe("DIVAOracleTellor", () => {
  let collateralToken;
  let userStartTokenBalance;
  let initialCollateralTokenAllowance;
  let user1, user2, reporter, excessFeeRecipient, tipper;

  let divaOracleTellor;
  let tellorPlayground;
  let tellorPlaygroundAddress = tellorPlaygroundAddresses[network]; // Kovan: '0x320f09D9f92Cfa0e9C272b179e530634D873aeFa' deployed in Kovan block 29245508, // Ropsten: '0xF281e2De3bB71dE348040b10B420615104359c10' deployed in Ropsten block 11834223
  let divaAddress = addresses[network];
  let referenceAsset = "BTC/USD";
  let maxFeeAmountUSD = parseEther("10");
  let minPeriodUndisputed = ONE_HOUR;

  let poolExpiryTime;
  let latestPoolId;
  let poolParams;

  let tippingToken;
  let tippingAmount;

  let chainId;
  let finalReferenceValue, collateralToUSDRate;
  let abiCoder, queryData, queryId, oracleValue;

  beforeEach(async () => {
    [user1, user2, reporter, excessFeeRecipient, tipper] =
      await ethers.getSigners();

    // Reset block
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            // blockNumber: 10932590, // Rinkeby; choose a value after the block timestamp where contracts used in these tests (DIVA and Tellor) were deployed; align blocknumber accordingly in test script
            blockNumber: 12750642, // Ropsten; choose a value after the block timestamp where contracts used in these tests (DIVA and Tellor) were deployed; align blocknumber accordingly in test script
          },
        },
      ],
    });

    userStartTokenBalance = parseEther("1000000");
    collateralToken = await erc20DeployFixture(
      "DummyToken",
      "DCT",
      userStartTokenBalance,
      user1.address,
      collateralTokenDecimals
    );

    const divaOracleTellorFactory = await ethers.getContractFactory(
      "DIVAOracleTellor"
    );
    divaOracleTellor = await divaOracleTellorFactory.deploy(
      tellorPlaygroundAddress,
      excessFeeRecipient.address,
      minPeriodUndisputed,
      maxFeeAmountUSD
    );
    tellorPlayground = await ethers.getContractAt(
      "TellorPlayground",
      tellorPlaygroundAddress
    );

    diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
    initialCollateralTokenAllowance = parseEther("1000000");
    await collateralToken.approve(
      diva.address,
      initialCollateralTokenAllowance
    );

    // Create an expired contingent pool that uses Tellor as the data provider // Create an expired contingent pool that uses Tellor as the data provider
    poolExpiryTime = (await getLastTimestamp()) + TEN_MINS;
    await diva.createContingentPool([
      referenceAsset, // reference asset
      poolExpiryTime, // expiryTime
      parseEther("40000"), // floor
      parseEther("60000"), // inflection
      parseEther("80000"), // cap
      parseEther("0.7").toString(),
      parseUnits("100", collateralTokenDecimals), // collateral amount
      collateralToken.address, // collateral token
      divaOracleTellor.address, // data provider
      parseUnits("200", collateralTokenDecimals).toString(), // capacity
    ]);

    latestPoolId = await diva.getLatestPoolId();
    poolParams = await diva.getPoolParameters(latestPoolId);

    // Get chain id
    chainId = (await ethers.provider.getNetwork()).chainId;

    // Calculate settlement fee expressed in collateral token
    settlementFeeAmount = poolParams.collateralBalance
      .mul(parseUnits("1", 18 - collateralTokenDecimals))
      .mul(poolParams.settlementFee)
      .div(parseEther("1"))
      .div(parseUnits("1", 18 - collateralTokenDecimals));

    // Prepare Tellor value submission
    abiCoder = new ethers.utils.AbiCoder();
    queryDataArgs = abiCoder.encode(
      ["uint256", "address", "uint256"],
      [latestPoolId, divaAddress, chainId]
    );
    queryData = abiCoder.encode(
      ["string", "bytes"],
      ["DIVAProtocol", queryDataArgs]
    );
    queryId = ethers.utils.keccak256(queryData);

    // deploy tipping token
    tippingToken = await erc20DeployFixture(
      "TippingToken",
      "TPT",
      userStartTokenBalance,
      tipper.address,
      tippingTokenDecimals
    );

    // Set tipping amount
    tippingAmount = parseUnits("1000", tippingTokenDecimals);

    // Approve tipping token to divaOracleTellor with tipper address
    await tippingToken
      .connect(tipper)
      .approve(divaOracleTellor.address, tippingAmount);
  });

  describe("setFinalReferenceValue", async () => {
    it("Should add a value to TellorPlayground", async () => {
      // ---------
      // Arrange: Prepare values and submit to tellorPlayground
      // ---------
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
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
      const tellorDataTimestamp = await tellorPlayground.timestamps(queryId, 0);
      const tellorValue = await tellorPlayground.values(
        queryId,
        tellorDataTimestamp
      );
      const formattedTellorValue = abiCoder.decode(
        ["uint256", "uint256"],
        tellorValue
      );
      expect(tellorDataTimestamp).to.eq(lastBlockTimestamp);
      expect(formattedTellorValue[0]).to.eq(finalReferenceValue);
      expect(formattedTellorValue[1]).to.eq(collateralToUSDRate);
    });

    it("Should set a reported Tellor value as the final reference value in DIVA Protocol", async () => {
      // ---------
      // Arrange: Confirm that finalRereferenceValue and statusFinalReferenceValue are not yet set and submit values to tellorPlayground
      // ---------
      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);
      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Assert: finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol
      // ---------
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
      expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed
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
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // ---------
      // Act & Assert: Call setFinalReferenceValue function inside DIVAOracleTellor contract shortly after minPeriodUndisputed period has passed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed - 1;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await expect(
        divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(divaAddress, latestPoolId)
      ).to.be.revertedWith("DIVAOracleTellor: _minPeriodUndisputed not passed");
    });

    it("Should revert if no value was reported yet", async () => {
      // ---------
      // Arrange: Confirm that no value has been reported yet
      // ---------
      expect(
        await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0)
      ).to.eq(0);

      // ---------
      // Act & Assert: Confirm that setFinalReferenceValue function will revert if called when no value has been reported yet
      // ---------
      await expect(
        divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(divaAddress, latestPoolId)
      ).to.be.revertedWith("DIVAOracleTellor: no oracle submission");
    });

    it("Should revert if a value has been reported prior to expiryTime only", async () => {
      // ---------
      // Arrange: Create a non-expired pool and submit one value prior to expiration
      // ---------
      await diva.createContingentPool([
        referenceAsset, // reference asset
        poolExpiryTime, // expiryTime
        parseEther("40000"), // floor
        parseEther("60000"), // inflection
        parseEther("80000"), // cap
        parseEther("0.7").toString(),
        parseUnits("100", collateralTokenDecimals), // collateral amount
        collateralToken.address, // collateral token
        divaOracleTellor.address, // data provider
        parseUnits("200", collateralTokenDecimals).toString(), // capacity
      ]);
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);

      // Prepare value submission to tellorPlayground
      // Re-construct as latestPoolId changed in this test
      queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [latestPoolId, divaAddress, chainId]
      );
      queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
      );
      queryId = ethers.utils.keccak256(queryData);
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
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
      // Act & Assert: Confirm that setFinalReferenceValue function will revert if the only value reported is before expiryTime
      // ---------
      await expect(
        divaOracleTellor
          .connect(user2)
          .setFinalReferenceValue(divaAddress, latestPoolId)
      ).to.be.revertedWith(
        "DIVAOracleTellor: no oracle submission after expiry time"
      );
    });

    it("Should take the second value if the first one was submitted before expiryTime and the second one afterwards", async () => {
      // ---------
      // Arrange: Create a contingent pool with expiry time in the future, prepare the submission to tellorPlayground
      // and submit two values, one before and one after expiration
      // ---------
      await diva.createContingentPool([
        referenceAsset, // reference asset
        poolExpiryTime, // expiryTime
        parseEther("40000"), // floor
        parseEther("60000"), // inflection
        parseEther("80000"), // cap
        parseEther("0.7").toString(),
        parseUnits("100", collateralTokenDecimals), // collateral amount
        collateralToken.address, // collateral token
        divaOracleTellor.address, // data provider
        parseUnits("200", collateralTokenDecimals).toString(), // capacity
      ]);
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);

      // Prepare value submission to tellorPlayground
      // Re-construct as latestPoolId changed in this test
      queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [latestPoolId, divaAddress, chainId]
      );
      queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
      );
      queryId = ethers.utils.keccak256(queryData);

      // First reporter submission prior to expiration
      finalReferenceValue1 = parseEther("42000");
      collateralToUSDRate1 = parseEther("1.14");
      oracleValue1 = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue1, collateralToUSDRate1]
      );
      nextBlockTimestamp = poolParams.expiryTime.sub(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue1, 0, queryData);

      // Second reporter submission after expiration
      finalReferenceValue2 = parseEther("42500");
      collateralToUSDRate2 = parseEther("1.15");
      oracleValue2 = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue2, collateralToUSDRate2]
      );
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue2, 0, queryData);

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAOracleTellor contract after minPeriodUndisputed has passed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed; // has to be minPeriodDisputed after the time of the second submission (assumed to be 1 second after expiration)
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Assert: Confirm that the second value was set as the final
      // ---------
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(await poolParams.statusFinalReferenceValue).to.eq(3);
      expect(await poolParams.finalReferenceValue).to.eq(parseEther("42500"));
    });

    it("Allocates all the settlement fee to the excess recipient if it is below maxFeeAmountUSD", async () => {
      // ---------
      // Arrange: Confirm that user1's fee claim balance is zero, report value and calculate USD denominated fee
      // ---------
      // Confirm that user1's fee claim balance is zero
      expect(
        await diva.getClaims(collateralToken.address, user1.address)
      ).to.eq(0);

      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );

      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // Calculate USD denominated fee
      settlementFeeAmountUSD = settlementFeeAmount
        .mul(parseUnits("1", 18 - collateralTokenDecimals))
        .mul(collateralToUSDRate)
        .div(parseEther("1"));
      expect(settlementFeeAmountUSD).to.be.lte(maxFeeAmountUSD);

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAOracleTellor contract after minPeriodUndisputed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Assert: Confirm that the reporter receives the full settlement fee payment (in collateral asset) and 0 goes to excess fee recipient
      // ---------
      expect(
        await diva.getClaims(collateralToken.address, reporter.address)
      ).to.eq(settlementFeeAmount);
      expect(
        await diva.getClaims(
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
      await diva.createContingentPool([
        referenceAsset, // reference asset
        poolExpiryTime, // expiryTime
        parseEther("40000"), // floor
        parseEther("60000"), // inflection
        parseEther("80000"), // cap
        parseEther("0.7").toString(),
        parseUnits("100000", collateralTokenDecimals), // collateral amount
        collateralToken.address, // collateral token
        divaOracleTellor.address, // data provider
        parseUnits("200000", collateralTokenDecimals).toString(), // capacity
      ]);
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);

      // Prepare value submission to tellorPlayground
      // Re-construct as latestPoolId changed in this test
      queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [latestPoolId, divaAddress, chainId]
      );
      queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
      );
      queryId = ethers.utils.keccak256(queryData);

      // Report value to tellor playground
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // Calculate settlement fee expressed in both collateral token and USD
      const { feeAmount, feeAmountUSD } = calcSettlementFee(
        poolParams.collateralBalance,
        poolParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      ); // feeAmount is expressed as an integer with collateral token decimals and feeAmountUSD with 18 decimals

      // Confirm that implied USD value of fee exceeds maxFeeAmountUSD
      expect(feeAmountUSD).to.be.gte(maxFeeAmountUSD);

      // Calc max fee amount in collateral token
      const maxFeeAmount = maxFeeAmountUSD
        .mul(parseEther("1"))
        .div(collateralToUSDRate)
        .div(parseUnits("1", 18 - collateralTokenDecimals)); // in collateral token decimals

      // Get reporter's and excess fee recipient's fee claim before
      const feeClaimReporterBefore = await diva.getClaims(
        collateralToken.address,
        user1.address
      );
      const feeClaimExcessFeeRecipientBefore = await diva.getClaims(
        collateralToken.address,
        excessFeeRecipient.address
      );

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAOracleTellor contract after minPeriodUndisputed
      // from a random user account (user2)
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId); // triggered by a random user2

      // ---------
      // Assert: Confirm that the reporter and excess fee recipient are allocated the correct amount of fees and
      // user2 (who triggered the setFinalReferenceFunction) and the divaOracleTellor contract are not
      // allocated any fees
      // ---------
      const feeClaimReporterAfter = await diva.getClaims(
        collateralToken.address,
        reporter.address
      );
      const feeClaimExcessFeeRecipientAfter = await diva.getClaims(
        collateralToken.address,
        excessFeeRecipient.address
      );

      expect(feeClaimReporterAfter).to.eq(
        feeClaimReporterBefore.add(maxFeeAmount)
      );
      expect(feeClaimExcessFeeRecipientAfter).to.eq(
        feeClaimExcessFeeRecipientBefore.add(feeAmount.sub(maxFeeAmount))
      );
      expect(
        await diva.getClaims(collateralToken.address, user2.address)
      ).to.eq(0);
      expect(
        await diva.getClaims(collateralToken.address, divaOracleTellor.address)
      ).to.eq(0);
    });

    it("Should allocate all fees to reporter if collateralToUSDRate = 0 (should typically be disputed by the Tellor mechanism)", async () => {
      // ---------
      // Arrange: Create a contingent pool where settlement fee exceeds maxFeeAmountUSD and report zero collateralToUSDRate
      // ---------
      poolExpiryTime = (await getLastTimestamp()) + TEN_MINS;
      await diva.createContingentPool([
        referenceAsset, // reference asset
        poolExpiryTime, // expiryTime
        parseEther("40000"), // floor
        parseEther("60000"), // inflection
        parseEther("80000"), // cap
        parseEther("0.7").toString(),
        parseUnits("100000", collateralTokenDecimals), // collateral amount
        collateralToken.address, // collateral token
        divaOracleTellor.address, // data provider
        parseUnits("200000", collateralTokenDecimals).toString(), // capacity
      ]);
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);

      // Prepare value submission to tellorPlayground
      // Re-construct as latestPoolId changed in this test
      queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [latestPoolId, divaAddress, chainId]
      );
      queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
      );
      queryId = ethers.utils.keccak256(queryData);

      // Report value to tellor playground with collateralToUSDRate = 0
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("0");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // Calculate settlement fee expressed in both collateral token and USD
      const { feeAmount } = calcSettlementFee(
        poolParams.collateralBalance,
        poolParams.settlementFee,
        collateralTokenDecimals,
        collateralToUSDRate
      ); // feeAmount is expressed as an integer with collateral token decimals and feeAmountUSD with 18 decimals

      // Get reporter's and excess fee recipient's fee claim before
      const feeClaimReporterBefore = await diva.getClaims(
        collateralToken.address,
        user1.address
      );
      const feeClaimExcessFeeRecipientBefore = await diva.getClaims(
        collateralToken.address,
        excessFeeRecipient.address
      );

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAOracleTellor contract after minPeriodUndisputed
      // from a random user account (user2)
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId); // triggered by a random user2

      // ---------
      // Assert: Confirm that the reporter and excess fee recipient are allocated the correct amount of fees and
      // user2 (who triggered the setFinalReferenceFunction) and the divaOracleTellor contract are not
      // allocated any fees
      // ---------
      const feeClaimReporterAfter = await diva.getClaims(
        collateralToken.address,
        reporter.address
      );
      const feeClaimExcessFeeRecipientAfter = await diva.getClaims(
        collateralToken.address,
        excessFeeRecipient.address
      );

      expect(feeClaimReporterAfter).to.eq(feeAmount);
      expect(feeClaimExcessFeeRecipientAfter).to.eq(0);
      expect(
        await diva.getClaims(collateralToken.address, user2.address)
      ).to.eq(0);
      expect(
        await diva.getClaims(collateralToken.address, divaOracleTellor.address)
      ).to.eq(0);
    });

    // ---------
    // Events
    // ---------

    it("Should emit a FinalReferenceValueSet event", async () => {
      // ---------
      // Arrange: Submit values to tellorPlayground
      // ---------
      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      const tx = await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);
      const response = await tx.wait();

      // ---------
      // Assert: Confirm that a FinalReferenceValueSet event is emitted with the correct values
      // ---------
      const timestampRetrieved =
        await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0);
      // const events = await finalReferenceValueSetEvents(divaOracleTellor);
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
    });
  });

  describe("setFinalReferenceValueAndClaimTips", async () => {
    beforeEach(async () => {
      // Add tip
      await divaOracleTellor
        .connect(tipper)
        .tip(latestPoolId, tippingAmount, tippingToken.address);
    });

    it("Should set a reported Tellor value as the final reference value in DIVA Protocol and claim tips from DIVAOracleTellor", async () => {
      // ---------
      // Arrange: Confirm that finalRereferenceValue, statusFinalReferenceValue and tipping token balances
      // and submit values to tellorPlayground
      // ---------
      expect(
        await divaOracleTellor.getTips(latestPoolId, tippingToken.address)
      ).to.eq(tippingAmount);
      expect(await tippingToken.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount
      );
      expect(await tippingToken.balanceOf(reporter.address)).to.eq(0);

      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);
      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // ---------
      // Act: Call setFinalReferenceValueAndClaimTips function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValueAndClaimTips(divaAddress, latestPoolId, [
          tippingToken.address,
        ]);

      // ---------
      // Assert: finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol
      // and check tipping token balances of divaOracleTellor and reporter, and tips on divaOracleTellor
      // ---------
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
      expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed
      expect(
        await divaOracleTellor.getTips(latestPoolId, tippingToken.address)
      ).to.eq(0);
      expect(await tippingToken.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken.balanceOf(reporter.address)).to.eq(
        tippingAmount
      );
    });

    // ---------
    // Reverts
    // ---------
    it("Should revert if called before minPeriodUndisputed", async () => {
      // ---------
      // Arrange: Confirm that finalRereferenceValue and statusFinalReferenceValue are not yet set and submit values to tellorPlayground
      // ---------
      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // ---------
      // Act & Assert: Call setFinalReferenceValueAndClaimTips function inside DIVAOracleTellor contract shortly after minPeriodUndisputed period has passed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed - 1;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await expect(
        divaOracleTellor
          .connect(user2)
          .setFinalReferenceValueAndClaimTips(divaAddress, latestPoolId, [
            tippingToken.address,
          ])
      ).to.be.revertedWith("DIVAOracleTellor: _minPeriodUndisputed not passed");
    });

    it("Should revert if no value was reported yet", async () => {
      // ---------
      // Arrange: Confirm that no value has been reported yet
      // ---------
      expect(
        await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0)
      ).to.eq(0);

      // ---------
      // Act & Assert: Confirm that setFinalReferenceValueAndClaimTips function will revert if called when no value has been reported yet
      // ---------
      await expect(
        divaOracleTellor
          .connect(user2)
          .setFinalReferenceValueAndClaimTips(divaAddress, latestPoolId, [
            tippingToken.address,
          ])
      ).to.be.revertedWith("DIVAOracleTellor: no oracle submission");
    });

    it("Should revert if a value has been reported prior to expiryTime only", async () => {
      // ---------
      // Arrange: Create a non-expired pool and submit one value prior to expiration
      // ---------
      await diva.createContingentPool([
        referenceAsset, // reference asset
        poolExpiryTime, // expiryTime
        parseEther("40000"), // floor
        parseEther("60000"), // inflection
        parseEther("80000"), // cap
        parseEther("0.7").toString(),
        parseUnits("100", collateralTokenDecimals), // collateral amount
        collateralToken.address, // collateral token
        divaOracleTellor.address, // data provider
        parseUnits("200", collateralTokenDecimals).toString(), // capacity
      ]);
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);

      // Prepare value submission to tellorPlayground
      // Re-construct as latestPoolId changed in this test
      queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [latestPoolId, divaAddress, chainId]
      );
      queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
      );
      queryId = ethers.utils.keccak256(queryData);
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
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
      // Act & Assert: Confirm that setFinalReferenceValueAndClaimTips function will revert if the only value reported is before expiryTime
      // ---------
      await expect(
        divaOracleTellor
          .connect(user2)
          .setFinalReferenceValueAndClaimTips(divaAddress, latestPoolId, [
            tippingToken.address,
          ])
      ).to.be.revertedWith(
        "DIVAOracleTellor: no oracle submission after expiry time"
      );
    });

    // ---------
    // Events
    // ---------

    it("Should emit a FinalReferenceValueSet event and TipClaimed events", async () => {
      // ---------
      // Arrange: Submit values to tellorPlayground
      // ---------
      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // ---------
      // Act: Call setFinalReferenceValueAndClaimTips function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      // ---------
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      const tx = await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValueAndClaimTips(divaAddress, latestPoolId, [
          tippingToken.address,
        ]);
      const response = await tx.wait();

      // ---------
      // Assert: Confirm that a FinalReferenceValueSet event and TipClaimed events are emitted with the correct values
      // ---------
      const timestampRetrieved =
        await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0);
      // const events = await finalReferenceValueSetEvents(divaOracleTellor);
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

      const tipClaimedEvents = response.events.filter(
        (item) => item.event === "TipClaimed"
      );
      expect(tipClaimedEvents[0].args.poolId).to.eq(latestPoolId);
      expect(tipClaimedEvents[0].args.recipient).to.eq(reporter.address);
      expect(tipClaimedEvents[0].args.tippingToken).to.eq(tippingToken.address);
      expect(tipClaimedEvents[0].args.amount).to.eq(tippingAmount);
    });
  });

  describe("tip", async () => {
    beforeEach(async () => {
      // Get pool id
      latestPoolId = await diva.getLatestPoolId();
    });

    it("Should add tip to DIVAOracleTellor", async () => {
      // ---------
      // Act: Add tip
      // ---------
      await divaOracleTellor
        .connect(tipper)
        .tip(latestPoolId, tippingAmount, tippingToken.address);

      // ---------
      // Assert: Check that tip is added on divaOracleTellor correctly
      // ---------
      expect(
        await divaOracleTellor.getTips(latestPoolId, tippingToken.address)
      ).to.eq(tippingAmount);
      expect((await divaOracleTellor.getTippingTokens(latestPoolId))[0]).to.eq(
        tippingToken.address
      );
      expect(await tippingToken.balanceOf(divaOracleTellor.address)).to.eq(
        tippingAmount
      );
    });

    // ---------
    // Revert
    // ---------

    it("Should revert if users want to add tip on the already confirmed pool", async () => {
      // ---------
      // Arrange: Set final reference value on DIVAOracleTellor
      // ---------
      // Prepare value submission to tellorPlayground
      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);

      // Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Act & Assert: Confirm that tip function will fail if called after setFinalReferenceValue function is called
      // ---------
      await expect(
        divaOracleTellor
          .connect(tipper)
          .tip(latestPoolId, tippingAmount, tippingToken.address)
      ).to.be.revertedWith("DIVAOracleTellor: already confirmed pool");
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
        .tip(latestPoolId, tippingAmount, tippingToken.address);
      const response = await tx.wait();

      // ---------
      // Assert: Confirm that a TipAdded event is emitted with the correct values
      // ---------
      // const events = await tipAddedEvents(divaOracleTellor);
      const tipAddedEvent = response.events.find(
        (item) => item.event === "TipAdded"
      );
      expect(tipAddedEvent.args.poolId).to.eq(latestPoolId);
      expect(tipAddedEvent.args.tippingToken).to.eq(tippingToken.address);
      expect(tipAddedEvent.args.amount).to.eq(tippingAmount);
      expect(tipAddedEvent.args.tipper).to.eq(tipper.address);
    });
  });

  describe("claimTips", async () => {
    beforeEach(async () => {
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);

      // Add tip
      await divaOracleTellor
        .connect(tipper)
        .tip(latestPoolId, tippingAmount, tippingToken.address);

      // Prepare Tellor value submission
      abiCoder = new ethers.utils.AbiCoder();
      queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [latestPoolId, divaAddress, chainId]
      );
      queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
      );
      queryId = ethers.utils.keccak256(queryData);

      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);
    });

    it("Should claim tips after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value
      // ---------
      // Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Act: Call claimTips function
      // ---------
      await divaOracleTellor.claimTips(latestPoolId, [tippingToken.address]);

      // ---------
      // Assert: Check tipping token balances of divaOracleTellor and reporter, and tips on divaOracleTellor
      // ---------
      expect(
        await divaOracleTellor.getTips(latestPoolId, tippingToken.address)
      ).to.eq(0);
      expect(await tippingToken.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken.balanceOf(reporter.address)).to.eq(
        tippingAmount
      );
    });

    // ---------
    // Revert
    // ---------

    it("Should revert if users try to claim tips for not confirmed pool", async () => {
      // ---------
      // Act & Assert: Confirm that claimTips function will fail if called before setFinalReferenceValue function is called
      // ---------
      await expect(
        divaOracleTellor.claimTips(latestPoolId, [tippingToken.address])
      ).to.be.revertedWith("DIVAOracleTellor: not confirmed pool");
    });

    // ---------
    // Events
    // ---------

    it("Should emit TipClaimed events", async () => {
      // ---------
      // Arrange: Set final reference value
      // ---------
      // Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Act: Call claimTips function
      // ---------
      const tx = await divaOracleTellor.claimTips(latestPoolId, [
        tippingToken.address,
      ]);
      const response = await tx.wait();

      // ---------
      // Assert: Confirm that a TipClaimed events are emitted with the correct values
      // ---------
      // const events = await tipClaimedEvents(divaOracleTellor);
      const tipClaimedEvents = response.events.filter(
        (item) => item.event === "TipClaimed"
      );
      expect(tipClaimedEvents[0].args.poolId).to.eq(latestPoolId);
      expect(tipClaimedEvents[0].args.recipient).to.eq(reporter.address);
      expect(tipClaimedEvents[0].args.tippingToken).to.eq(tippingToken.address);
      expect(tipClaimedEvents[0].args.amount).to.eq(tippingAmount);
    });
  });

  describe("claimDIVAFee", async () => {
    beforeEach(async () => {
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);

      // Prepare Tellor value submission
      abiCoder = new ethers.utils.AbiCoder();
      queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [latestPoolId, divaAddress, chainId]
      );
      queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
      );
      queryId = ethers.utils.keccak256(queryData);

      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);
    });

    it("Should claim DIVA fee after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value
      // ---------
      // Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Act: Call claimDIVAFee function
      // ---------
      await divaOracleTellor.claimDIVAFee(latestPoolId, divaAddress);

      // ---------
      // Assert: Check collateral token balance of reporter
      // ---------
      expect(await collateralToken.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount
      );
    });

    // ---------
    // Revert
    // ---------

    it("Should revert if users try to claim diva fee for not confirmed pool", async () => {
      // ---------
      // Act & Assert: Confirm that claimDIVAFee function will fail if called before setFinalReferenceValue function is called
      // ---------
      await expect(
        divaOracleTellor.claimDIVAFee(latestPoolId, divaAddress)
      ).to.be.revertedWith("DIVAOracleTellor: not confirmed pool");
    });
  });

  describe("claimTipsAndDIVAFee", async () => {
    beforeEach(async () => {
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);

      // Add tip
      await divaOracleTellor
        .connect(tipper)
        .tip(latestPoolId, tippingAmount, tippingToken.address);

      // Prepare Tellor value submission
      abiCoder = new ethers.utils.AbiCoder();
      queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [latestPoolId, divaAddress, chainId]
      );
      queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
      );
      queryId = ethers.utils.keccak256(queryData);

      finalReferenceValue = parseEther("42000");
      collateralToUSDRate = parseEther("1.14");
      oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
      );
      // Submit value to Tellor playground contract
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber());
      await tellorPlayground
        .connect(reporter)
        .submitValue(queryId, oracleValue, 0, queryData);
    });

    it("Should claim tpis and DIVA fee after final reference value is set", async () => {
      // ---------
      // Arrange: Set final reference value
      // ---------
      // Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Act: Call claimTipsAndDIVAFee function
      // ---------
      await divaOracleTellor.claimTipsAndDIVAFee(
        latestPoolId,
        [tippingToken.address],
        divaAddress
      );

      // ---------
      // Assert: Check token balances of divaOracleTellor and reporter, and tips on divaOracleTellor
      // ---------
      expect(
        await divaOracleTellor.getTips(latestPoolId, tippingToken.address)
      ).to.eq(0);
      expect(await tippingToken.balanceOf(divaOracleTellor.address)).to.eq(0);
      expect(await tippingToken.balanceOf(reporter.address)).to.eq(
        tippingAmount
      );
      expect(await collateralToken.balanceOf(reporter.address)).to.eq(
        settlementFeeAmount
      );
    });

    // ---------
    // Revert
    // ---------

    it("Should revert if users try to claim tips and DIVA fee for not confirmed pool", async () => {
      // ---------
      // Act & Assert: Confirm that claimTipsAndDIVAFee function will fail if called before setFinalReferenceValue function is called
      // ---------
      await expect(
        divaOracleTellor.claimTipsAndDIVAFee(
          latestPoolId,
          [tippingToken.address],
          divaAddress
        )
      ).to.be.revertedWith("DIVAOracleTellor: not confirmed pool");
    });

    // ---------
    // Events
    // ---------

    it("Should emit TipClaimed events", async () => {
      // ---------
      // Arrange: Set final reference value
      // ---------
      // Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed
      nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed;
      await setNextTimestamp(ethers.provider, nextBlockTimestamp);
      await divaOracleTellor
        .connect(user2)
        .setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Act: Call claimTipsAndDIVAFee function
      // ---------
      const tx = await divaOracleTellor.claimTipsAndDIVAFee(
        latestPoolId,
        [tippingToken.address],
        divaAddress
      );
      const response = await tx.wait();

      // ---------
      // Assert: Confirm that a TipClaimed events are emitted with the correct values
      // ---------
      // const events = await tipClaimedEvents(divaOracleTellor);
      const tipClaimedEvents = response.events.filter(
        (item) => item.event === "TipClaimed"
      );
      expect(tipClaimedEvents[0].args.poolId).to.eq(latestPoolId);
      expect(tipClaimedEvents[0].args.recipient).to.eq(reporter.address);
      expect(tipClaimedEvents[0].args.tippingToken).to.eq(tippingToken.address);
      expect(tipClaimedEvents[0].args.amount).to.eq(tippingAmount);
    });
  });

  describe("setMinPeriodUndisputed", async () => {
    it("Should set minPeriodUndisputed", async () => {
      // ---------
      // Arrange: Set minPeriodUndisputed
      // ---------
      minPeriodUndisputed = ONE_HOUR + TEN_MINS;

      // ---------
      // Act: Call setMinPeriodUndisputed function
      // ---------
      await divaOracleTellor.setMinPeriodUndisputed(minPeriodUndisputed);

      // ---------
      // Assert: Check that minPeriodUndisputed is updated on divaOracleTellor correctly
      // ---------
      expect(await divaOracleTellor.getMinPeriodUndisputed()).to.eq(
        minPeriodUndisputed
      );
    });

    // ---------
    // Reverts
    // ---------

    it("Should revert if new minPeriodUndisputed is smaller than 3600", async () => {
      // ---------
      // Arrange: Set minPeriodUndisputed smaller than 3600
      // ---------
      minPeriodUndisputed = ONE_HOUR - 1;

      // ---------
      // Act & Assert: Confirm that setMinPeriodUndisputed function will fail
      // ---------
      await expect(
        divaOracleTellor.setMinPeriodUndisputed(minPeriodUndisputed)
      ).to.be.revertedWith("DIVAOracleTellor: out of range");
    });

    it("Should revert if new minPeriodUndisputed is bigger than 64800", async () => {
      // ---------
      // Arrange: Set minPeriodUndisputed smaller than 64800
      // ---------
      minPeriodUndisputed = 18 * ONE_HOUR + 1;

      // ---------
      // Act & Assert: Confirm that setMinPeriodUndisputed function will fail
      // ---------
      await expect(
        divaOracleTellor.setMinPeriodUndisputed(minPeriodUndisputed)
      ).to.be.revertedWith("DIVAOracleTellor: out of range");
    });
  });

  describe("setMaxFeeAmountUSD", async () => {
    it("Should set maxFeeAmountUSD", async () => {
      // ---------
      // Arrange: Set maxFeeAmountUSD
      // ---------
      maxFeeAmountUSD = parseEther("10");

      // ---------
      // Act: Call setMaxFeeAmountUSD function
      // ---------
      await divaOracleTellor.setMaxFeeAmountUSD(maxFeeAmountUSD);

      // ---------
      // Assert: Check that maxFeeAmountUSD is updated on divaOracleTellor correctly
      // ---------
      expect(await divaOracleTellor.getMaxFeeAmountUSD()).to.eq(
        maxFeeAmountUSD
      );
    });
  });

  describe("setExcessFeeRecipient", async () => {
    it("Should set excessFeeRecipient", async () => {
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
      ).to.be.revertedWith(
        "DIVAOracleTellor: excessFeeRecipient cannot be zero address"
      );
    });
  });
});
