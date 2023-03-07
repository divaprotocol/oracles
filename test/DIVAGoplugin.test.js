const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const {
  getLastBlockTimestamp,
  setNextBlockTimestamp,
} = require("../utils/utils");
const { TEN_MINS, DIVA_ADDRESS, PLI_ADDRESS } = require("../utils/constants");

const {
  erc20AttachFixture,
  erc20DeployFixture,
} = require("./fixtures/MockERC20Fixture");

const network = "apothem";
const collateralTokenDecimals = 6;

describe("DIVAGoplugin", () => {
  let collateralTokenInstance;
  let owner, user1, user2;

  let divaGoplugin;
  let divaAddress = DIVA_ADDRESS[network];
  let pliAddress = PLI_ADDRESS[network];
  let pliToken;

  let feePerRequest;

  let poolId;
  let poolParams;
  let feesParams;
  let finalReferenceValue;
  let settlementFeeAmount;

  let nextBlockTimestamp;

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();

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
    feePerRequest = await divaGoplugin.getFeePerRequest();
    expect(feePerRequest).to.eq(parseUnits("0.1"));

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
      // Arrange: Check that there's no final reference value request
      // ---------
      expect(await divaGoplugin.getLastRequestedBlocktimestamp(poolId)).to.eq(
        0
      );
      // Approve PLI token of user2 to DIVAGoplugin
      await pliToken
        .connect(user2)
        .approve(divaGoplugin.address, feePerRequest);

      // ---------
      // Act: Call `requestFinalReferenceValue` function
      // ---------
      await divaGoplugin.connect(user2).requestFinalReferenceValue(poolId);

      // ---------
      // Assert: Check that final reference value is requested
      // ---------
      expect(await divaGoplugin.getLastRequestedBlocktimestamp(poolId)).to.eq(
        await getLastBlockTimestamp()
      );
    });
  });

  describe("setFinalReferenceValue", async () => {
    beforeEach(async () => {
      // Request final reference value for `poolId`
      await pliToken
        .connect(user2)
        .approve(divaGoplugin.address, feePerRequest);
      await divaGoplugin.connect(user2).requestFinalReferenceValue(poolId);
    });

    it("Should set the value from Goplugin Feed as the final reference value in DIVA Protocol and leave fee claims in DIVA unclaimed", async () => {
      // ---------
      // Arrange: Get value from Goplugin Feed for `poolId` and check token balance
      // ---------
      finalReferenceValue = await divaGoplugin.getGopluginValue(poolId);

      // Calc settlement fee
      settlementFeeAmount = poolParams.collateralBalance
        .mul(feesParams.settlementFee)
        .div(parseUnits("1"));

      // Check collateral token balance for DIVAGoplugin
      expect(
        await collateralTokenInstance.balanceOf(divaGoplugin.address)
      ).to.eq(0);

      // ---------
      // Act: Call `setFinalReferenceValue` function inside DIVAGoplugin
      // contract after exactly pool expiry time has passed
      // ---------
      nextBlockTimestamp = poolParams.expiryTime.add(1);
      await setNextBlockTimestamp(nextBlockTimestamp.toNumber());
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
        await diva.getClaim(
          collateralTokenInstance.address,
          divaGoplugin.address
        )
      ).to.eq(settlementFeeAmount);

      // Check that the DIVAGoplugin's collateral token balance is unchanged (as the DIVA fee claim resides inside DIVA Protocol)
      expect(
        await collateralTokenInstance.balanceOf(divaGoplugin.address)
      ).to.eq(0);
    });
  });
});
