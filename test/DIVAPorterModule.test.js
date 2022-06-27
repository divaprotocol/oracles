const { expect } = require("chai");
const { ethers } = require("hardhat");
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture");
const { parseEther, parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const { addresses } = require("../utils/constants");

const network = "goerli"; // should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 6;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

describe("DIVAPorterModule", () => {
  let divaPorterModule;
  let divaAddress = addresses[network];
  let bondFactory;
  let bondAddress;
  let latestPoolId;
  let poolParams;
  let erc20;

  beforeEach(async () => {
    // Get user
    [user1] = await ethers.getSigners();

    // Get DIVA protocol contract
    diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

    // Deploy Bond factory contract
    const mockBondFactory = await ethers.getContractFactory("MockBondFactory");
    bondFactory = await mockBondFactory.deploy();

    // Deploy DIVA Porter module contract
    const divaPorterModuleFactory = await ethers.getContractFactory(
      "DIVAPorterModule"
    );
    divaPorterModule = await divaPorterModuleFactory.deploy(
      bondFactory.address
    );

    // Create DummyToken for the collateral token
    erc20 = await erc20DeployFixture(
      "DummyToken",
      "DCT",
      parseEther("1000000000"),
      user1.address,
      collateralTokenDecimals
    );
    // Approve DummyToken to DIVA Porter module contract
    await erc20.approve(divaPorterModule.address, parseEther("1000000000"));

    // Create Bond contract using BondFactory contract
    const tx = await bondFactory.createBond("DummyBond", "DBD", erc20.address);
    const receipt = await tx.wait();
    bondAddress = receipt.events?.find((x) => x.event === "BondCreated")?.args
      .newBond;
  });

  describe("createContingentPool", async () => {
    it("Should throw an error when user passes a non-bond address for referenceAsset", async () => {
      await expect(
        divaPorterModule.createContingentPool(divaAddress, [
          divaPorterModule.address, // Non Porter Bond address
          parseEther("40000"), // floor
          parseEther("43000"), // inflection
          parseEther("46000"), // cap
          parseEther("0.5"), // gradient
          parseUnits("100", collateralTokenDecimals), // collateral amount
          erc20.address, // collateral token
          divaPorterModule.address, // data provider
          parseUnits("300", collateralTokenDecimals), // capacity
        ])
      ).to.be.revertedWith("DIVAPorterModule: invalid Bond address");
    });

    it("Should create contingent pool on DIVA protocol", async () => {
      // ---------
      // Act: Call createContingentPool function inside DIVAPorterModule
      // ---------
      await divaPorterModule.createContingentPool(divaAddress, [
        bondAddress, // Porter Bond address
        parseEther("40000"), // floor
        parseEther("43000"), // inflection
        parseEther("46000"), // cap
        parseEther("0.5"), // gradient
        parseUnits("100", collateralTokenDecimals), // collateral amount
        erc20.address, // collateral token
        divaPorterModule.address, // data provider
        parseUnits("300", collateralTokenDecimals), // capacity
      ]);

      // ---------
      // Assert: new pool is created with Bond address as referenceAsset
      // ---------
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.referenceAsset).to.eq(bondAddress.toLowerCase()); // check if referenceAsset is equal to bondAddress
    });
  });

  describe("setFinalReferenceValue", async () => {
    beforeEach(async () => {
      // Create congingent pool using DIVA Porter module
      await divaPorterModule.createContingentPool(divaAddress, [
        bondAddress, // Porter Bond address
        parseEther("40000"), // floor
        parseEther("43000"), // inflection
        parseEther("46000"), // cap
        parseEther("0.5"), // gradient
        parseUnits("100", collateralTokenDecimals), // collateral amount
        erc20.address, // collateral token
        divaPorterModule.address, // data provider
        parseUnits("300", collateralTokenDecimals), // capacity
      ]);

      // Wait till the pool end
      await delay(10000);
    });

    it("Should set a unpaid amount from Bond as the final reference value in DIVA Protocol", async () => {
      // ---------
      // Arrange: Confirm that finalRereferenceValue and statusFinalReferenceValue are not yet set on DIVA Protocol
      // and the pool was not yet settled on DIVA Porter module.
      // ---------
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);

      const poolIsSettled = await divaPorterModule.poolIsSettled(latestPoolId);
      expect(poolIsSettled).to.eq(false);

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAPorterModule
      // ---------
      await divaPorterModule.setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Assert: statusFinalReferenceValue is updated accordingly in DIVA Protocol
      // ---------
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed
    });

    it("Should revert if the poool is already settled", async () => {
      // ---------
      // Arrange: Confirm that finalRereferenceValue and statusFinalReferenceValue are not yet set on DIVA Protocol
      // and the pool was not yet settled on DIVA Porter module.
      // and set a unpaid amount from Bond as the final reference value in DIVA Protocol.
      // ---------
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);

      const poolIsSettled = await divaPorterModule.poolIsSettled(latestPoolId);
      expect(poolIsSettled).to.eq(false);

      await divaPorterModule.setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Assert: try to call setFinalReferenceValue func
      // ---------
      await expect(
        divaPorterModule.setFinalReferenceValue(divaAddress, latestPoolId)
      ).to.be.revertedWith("DIVAPorterModule: pool is already settled");
    });
  });
});
