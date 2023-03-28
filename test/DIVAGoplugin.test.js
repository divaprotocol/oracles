const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const DATA_FEED_ABI = require("../contracts/abi/InternalAbi.json");
const {
  advanceTime,
  getLastBlockTimestamp,
  setNextBlockTimestamp,
} = require("../utils/utils");
const {
  TEN_MINS,
  DIVA_ADDRESS,
  PLI_ADDRESS,
  GOPLUGIN_DATA_FEED_ADDRESSES,
} = require("../utils/constants");

const {
  erc20AttachFixture,
  erc20DeployFixture,
} = require("./fixtures/MockERC20Fixture");

const network = "apothem";
const dataFeedPair = "XDC/USDT";
const collateralTokenDecimals = 6;

describe("DIVAGoplugin", () => {
  let collateralTokenInstance;
  let owner, user1, user2, user3;

  let divaGoplugin;
  let divaAddress = DIVA_ADDRESS[network];
  let pliAddress = PLI_ADDRESS[network];
  let pliToken;
  let dataFeedAddress = GOPLUGIN_DATA_FEED_ADDRESSES[network][dataFeedPair];
  let dataFeed;
  let minDepositAmount;

  let poolId;
  let poolParams;
  let feesParams;
  let finalReferenceValue;
  let settlementFeeAmount;

  let nextBlockTimestamp;

  before(async () => {
    [owner, user1, user2, user3] = await ethers.getSigners();

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
    minDepositAmount = await divaGoplugin.getMinDepositAmount();
    expect(minDepositAmount).to.eq(parseUnits("1"));

    // Get PLI token instance
    pliToken = await erc20AttachFixture(pliAddress);

    // Transfer PLI token to user2
    const ownerPLIBalance = await pliToken.balanceOf(owner.address);
    expect(ownerPLIBalance).to.gt(0);
    await pliToken
      .connect(owner)
      .transfer(user2.address, ownerPLIBalance.div(2));

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

    dataFeed = await ethers.getContractAt(DATA_FEED_ABI, dataFeedAddress);
  });

  beforeEach(async () => {
    // Create an expired contingent pool that uses DIVAGoplugin as the data provider
    const tx = await createContingentPool();
    const receipt = await tx.wait();
    poolId = receipt.events?.find((x) => x.event === "PoolIssued")?.args
      ?.poolId;
    poolParams = await diva.getPoolParameters(poolId);
    feesParams = await diva.getFees(poolParams.indexFees);
  });

  // Function to create contingent pools pre-populated with default values that can be overwritten depending on the test case
  const createContingentPool = async ({
    referenceAsset = dataFeedAddress,
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
    let user2PLIBalanceBefore;

    // ---------
    // Functionality
    // ---------

    it("Should request final reference value to DIVAGoplugin (DIVAGoplugin contract has enough PLI token on itself)", async () => {
      // ---------
      // Arrange: Check that there's no final reference value request
      // ---------
      expect(await divaGoplugin.getLastRequestedTimestamp(poolId)).to.eq(0);

      // Transfer PLI token from user2 to DIVAGoplugin
      await pliToken
        .connect(user2)
        .transfer(divaGoplugin.address, minDepositAmount);

      // Check PLI token balance of DIVAGoplugin contract
      const divaGopluginPLIBalanceBefore = await pliToken.balanceOf(
        divaGoplugin.address
      );
      expect(divaGopluginPLIBalanceBefore).to.be.gte(minDepositAmount);

      // Get PLI token balance of user2 before request final reference value
      user2PLIBalanceBefore = await pliToken.balanceOf(user2.address);

      // ---------
      // Act: Call `requestFinalReferenceValue` function after exactly pool expiry time has passed
      // ---------
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await divaGoplugin.connect(user2).requestFinalReferenceValue(poolId);

      // ---------
      // Assert: Check that final reference value is requested
      // ---------
      expect(await divaGoplugin.getLastRequestedTimestamp(poolId)).to.eq(
        await getLastBlockTimestamp()
      );
      // Confirm that PLI token balance of user2 hasn't been changed
      expect(await pliToken.balanceOf(user2.address)).to.eq(
        user2PLIBalanceBefore
      );
      // Confirm that PLI token balance of DIVAGoplugin has been reduced
      expect(await pliToken.balanceOf(divaGoplugin.address)).to.eq(
        divaGopluginPLIBalanceBefore.sub(minDepositAmount)
      );
    });

    it("Should request final reference value to DIVAGoplugin (Not enough PLI token on DIVAGoplugin contract)", async () => {
      // ---------
      // Arrange: Check that there's no final reference value request
      // ---------
      expect(await divaGoplugin.getLastRequestedTimestamp(poolId)).to.eq(0);

      // Get PLI token balance of user2 before request final reference value
      user2PLIBalanceBefore = await pliToken.balanceOf(user2.address);

      // Calc diff between `minDepositAmount` and deposited amount
      const depositedAmount = (await dataFeed.plidbs(divaGoplugin.address))
        .totalcredits;
      expect(depositedAmount).to.be.lt(minDepositAmount);
      const diff = minDepositAmount.sub(depositedAmount);

      const pliBalance = await pliToken.balanceOf(divaGoplugin.address);
      // Check PLI token balance of DIVAGoplugin contract
      expect(pliBalance).to.be.lt(diff);
      // Approve PLI token of user2 to DIVAGoplugin
      await pliToken
        .connect(user2)
        .approve(divaGoplugin.address, diff.sub(pliBalance));

      // ---------
      // Act: Call `requestFinalReferenceValue` function after exactly pool expiry time has passed
      // ---------
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await divaGoplugin.connect(user2).requestFinalReferenceValue(poolId);

      // ---------
      // Assert: Check that final reference value is requested
      // ---------
      expect(await divaGoplugin.getLastRequestedTimestamp(poolId)).to.eq(
        await getLastBlockTimestamp()
      );
      // Confirm that PLI token balance of user2 hasn't been changed
      expect(await pliToken.balanceOf(user2.address)).to.eq(
        user2PLIBalanceBefore.sub(diff)
      );
      // Confirm that PLI token balance of DIVAGoplugin has been reduced
      expect(await pliToken.balanceOf(divaGoplugin.address)).to.eq(0);
    });

    // ---------
    // Reverts
    // ---------

    it("Should revert if triggered before pool expiry", async () => {
      // ---------
      // Arrange: Set next block timestamp as before pool expiry time
      // ---------
      nextBlockTimestamp = poolParams.expiryTime.sub(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());

      // ---------
      // Act & Assert: Confirm that `requestFinalReferenceValue` function will
      // revert if called before pool expiry
      // ---------
      await expect(
        divaGoplugin.connect(user2).requestFinalReferenceValue(poolId)
      ).to.be.revertedWith("PoolNotExpired()");
    });

    it("Should revert if final reference value is requested already", async () => {
      // ---------
      // Arrange: Request final reference value
      // ---------
      // Calc diff between `minDepositAmount` and deposited amount
      const depositedAmount = (await dataFeed.plidbs(divaGoplugin.address))
        .totalcredits;
      expect(depositedAmount).to.be.lt(minDepositAmount);
      const diff = minDepositAmount.sub(depositedAmount);

      const pliBalance = await pliToken.balanceOf(divaGoplugin.address);
      // Check PLI token balance of DIVAGoplugin contract
      expect(pliBalance).to.be.lt(diff);
      // Approve PLI token of user2 to DIVAGoplugin
      await pliToken
        .connect(user2)
        .approve(divaGoplugin.address, diff.sub(pliBalance));

      // Call `requestFinalReferenceValue` function after exactly pool expiry time has passed
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await divaGoplugin.connect(user2).requestFinalReferenceValue(poolId);

      // ---------
      // Act & Assert: Confirm that `requestFinalReferenceValue` function will
      // revert if final reference value is requested already
      // ---------
      await expect(
        divaGoplugin.connect(user2).requestFinalReferenceValue(poolId)
      ).to.be.revertedWith("FinalReferenceValueAlreadyRequested()");
    });

    it("Should revert if there is no enough PLI token on DIVAGoplugin and user", async () => {
      // ---------
      // Arrange: Check that there's no final reference value request
      // ---------

      // Get PLI token balance of user3 before request final reference value
      const user3PLIBalanceBefore = await pliToken.balanceOf(user3.address);

      // Calc diff between `minDepositAmount` and deposited amount
      const depositedAmount = (await dataFeed.plidbs(divaGoplugin.address))
        .totalcredits;
      expect(depositedAmount).to.be.lt(minDepositAmount);
      const diff = minDepositAmount.sub(depositedAmount);

      const pliBalance = await pliToken.balanceOf(divaGoplugin.address);
      // Check PLI token balance of DIVAGoplugin contract
      expect(pliBalance).to.be.lt(diff);
      // Approve PLI token of user3 to DIVAGoplugin
      await pliToken
        .connect(user3)
        .approve(divaGoplugin.address, diff.sub(pliBalance));

      // Check the PLI token on DIVAGoplugin and user3 is not enough
      expect(pliBalance.add(user3PLIBalanceBefore)).to.be.lt(diff);

      // ---------
      // Act & Assert: Confirm that `requestFinalReferenceValue` function will
      // revert if called before pool expiry
      // ---------
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await expect(
        divaGoplugin.connect(user3).requestFinalReferenceValue(poolId)
      ).to.be.revertedWith("SafeERC20: low-level call failed");
    });

    // ---------
    // Events
    // ---------

    it("Should emit a `FinalReferenceValueRequested` event", async () => {
      // ---------
      // Arrange: Check that there's no final reference value request
      // ---------
      expect(await divaGoplugin.getLastRequestedTimestamp(poolId)).to.eq(0);

      // Calc diff between `minDepositAmount` and deposited amount
      const depositedAmount = (await dataFeed.plidbs(divaGoplugin.address))
        .totalcredits;
      expect(depositedAmount).to.be.lt(minDepositAmount);
      const diff = minDepositAmount.sub(depositedAmount);

      const pliBalance = await pliToken.balanceOf(divaGoplugin.address);
      // Check PLI token balance of DIVAGoplugin contract
      expect(pliBalance).to.be.lt(diff);
      // Approve PLI token of user2 to DIVAGoplugin
      await pliToken
        .connect(user2)
        .approve(divaGoplugin.address, diff.sub(pliBalance));

      // ---------
      // Act: Call `requestFinalReferenceValue` function after exactly pool expiry time has passed
      // ---------
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      const tx = await divaGoplugin
        .connect(user2)
        .requestFinalReferenceValue(poolId);
      const receipt = await tx.wait();

      // ---------
      // Assert: Confirm that a `FinalReferenceValueRequested` event is emitted with the correct values
      // ---------
      const finalReferenceValueRequestedEvent = receipt.events.find(
        (item) => item.event === "FinalReferenceValueRequested"
      );
      expect(finalReferenceValueRequestedEvent.args.poolId).to.eq(poolId);
      expect(finalReferenceValueRequestedEvent.args.requestedTimestamp).to.eq(
        await getLastBlockTimestamp()
      );
      expect(finalReferenceValueRequestedEvent.args.requestId).to.eq(
        await divaGoplugin.getRequestId(poolId)
      );
    });
  });

  describe("setFinalReferenceValue", async () => {
    beforeEach(async () => {
      // Transfer PLI token from user2 to DIVAGoplugin
      await pliToken
        .connect(user2)
        .transfer(divaGoplugin.address, minDepositAmount);
    });

    // ---------
    // Functionality
    // ---------

    it("Should set the value from Goplugin Feed as the final reference value in DIVA Protocol and leave fee claims in DIVA unclaimed", async () => {
      // ---------
      // Arrange: Get value from Goplugin Feed for `poolId` and check token balance
      // ---------

      // Request final reference value for `poolId` after exactly pool expiry time has passed
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await divaGoplugin.connect(user2).requestFinalReferenceValue(poolId);

      // Wait 20 seconds
      await advanceTime(20);
      finalReferenceValue = await divaGoplugin.getGoPluginValue(poolId);

      // Calc settlement fee
      settlementFeeAmount = poolParams.collateralBalance
        .mul(feesParams.settlementFee)
        .div(parseUnits("1"));

      // Check collateral token balance for DIVAGoplugin
      expect(
        await collateralTokenInstance.balanceOf(divaGoplugin.address)
      ).to.eq(0);

      // ---------
      // Act: Call `setFinalReferenceValue` function inside DIVAGoplugin contract
      // ---------
      await divaGoplugin.connect(user1).setFinalReferenceValue(poolId);

      // ---------
      // Assert: Confirm that `finalReferenceValue`, `statusFinalReferenceValue` and feeClaim in DIVA Protocol are updated
      // but collateral token balance remains unchanged
      // ---------
      // Check that `finalReferenceValue` and `statusFinalReferenceValue` are updated in DIVA Protocol
      poolParams = await diva.getPoolParameters(poolId);
      expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue);
      expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed

      // Check that the fee claim was allocated to the DIVAGoplugin in DIVA Protocol
      expect(
        await diva.getClaim(collateralTokenInstance.address, owner.address)
      ).to.eq(settlementFeeAmount);

      // Check that the DIVAGoplugin's collateral token balance is unchanged (as the DIVA fee claim resides inside DIVA Protocol)
      expect(
        await collateralTokenInstance.balanceOf(divaGoplugin.address)
      ).to.eq(0);
    });

    // ---------
    // Reverts
    // ---------

    it("Should revert if called without requesting final reference value", async () => {
      // ---------
      // Arrange: Check that there's no final reference value requested
      // ---------
      expect(await divaGoplugin.getLastRequestedTimestamp(poolId)).to.eq(0);

      // ---------
      // Act & Assert: Confirm that `setFinalReferenceValue` function will
      // revert if called without requesting final reference value
      // ---------
      await expect(
        divaGoplugin.connect(user1).setFinalReferenceValue(poolId)
      ).to.be.revertedWith("FinalReferenceValueNotRequested()");
    });

    it("Should revert if called before submit of final reference value", async () => {
      // ---------
      // Arrange: Request final reference value
      // ---------

      // Request final reference value for `poolId` after exactly pool expiry time has passed
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
      await divaGoplugin.connect(user2).requestFinalReferenceValue(poolId);

      // Check that the final reference value is not submitted yet
      expect(await divaGoplugin.getGoPluginValue(poolId)).to.eq(0);

      // ---------
      // Act & Assert: Confirm that `setFinalReferenceValue` function will
      // revert if called before submit of final reference value
      // ---------
      await expect(
        divaGoplugin.connect(user1).setFinalReferenceValue(poolId)
      ).to.be.revertedWith("FinalReferenceValueNotReported()");
    });
  });
});
