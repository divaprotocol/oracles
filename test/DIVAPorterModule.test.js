const { expect } = require("chai");
const { ethers } = require("hardhat");
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture");
const { parseEther, parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const { addresses } = require("../utils/constants");

const network = "ropsten"; // should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 6;

describe("DIVAPorterModule", () => {
  let divaPorterModule;
  let divaAddress = addresses[network];
  let bondFactory;
  let bondAddress;
  let latestPoolId;
  let poolParams;

  beforeEach(async () => {
    [user1] = await ethers.getSigners();

    diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

    const mockBondFactory = await ethers.getContractFactory("MockBondFactory");
    bondFactory = await mockBondFactory.deploy();

    const divaPorterModuleFactory = await ethers.getContractFactory(
      "DIVAPorterModule"
    );
    divaPorterModule = await divaPorterModuleFactory.deploy(
      bondFactory.address
    );
  });

  describe("createContingentPool", async () => {
    let erc20;

    beforeEach(async () => {
      // Create DummyToken for the collateral token
      erc20 = await erc20DeployFixture(
        "DummyToken",
        "DCT",
        parseEther("1000000000"),
        user1.address,
        collateralTokenDecimals
      );
      await erc20.approve(divaAddress, parseEther("1000000000"));

      // Create Bond contract using BondFactory contract
      const tx = await bondFactory.createBond(
        "DummyBond",
        "DBD",
        erc20.address
      );
      const receipt = await tx.wait();
      bondAddress = receipt.events?.find((x) => x.event === "BondCreated")?.args
        .newBond;
    });

    it("Should throw error when user pass non-bond address for referenceAsset", async () => {
      await expect(
        divaPorterModule.createContingentPool(divaAddress, [
          divaPorterModule.address, // Non Porter Bond address
          parseEther("40000"), // floor
          parseEther("43000"), // inflection
          parseEther("46000"), // cap
          parseUnits("100", 18), // collateral balance
          parseEther("200"), // supplyPositionToken
          erc20.address, // collateral token
          divaPorterModule.address, // data provider
          0, // capacity
        ])
      ).to.be.revertedWith("DIVAPorterModule: invalid Bond address");
    });

    it("Should create contingent pool on DIVA protocol", async () => {
      // ---------
      // Act: Call createContingentPool function inside DIVAPorterModule
      // ---------
      try {
        await divaPorterModule.createContingentPool(divaAddress, [
          bondAddress, // Porter Bond address
          parseEther("40000"), // floor
          parseEther("43000"), // inflection
          parseEther("46000"), // cap
          parseUnits("100", 15), // gradient
          parseEther("0.2"), // collateralAmount
          erc20.address, // collateral token
          divaPorterModule.address, // data provider
          parseEther("300"), // capacity
        ]);
      } catch (error) {
        console.error(error);
      }

      // ---------
      // Assert: finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol
      // ---------
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.referenceAsset).to.eq(bondAddress); // check if referenceAsset is equal to bondAddress
    });
  });

  describe("setFinalReferenceValue", async () => {
    it("Should set a unpaid amount from Bond as the final reference value in DIVA Protocol", async () => {
      // ---------
      // Arrange: Confirm that pool is already settled or not.
      // ---------
      const poolIsSettled = await divaPorterModule.poolIsSettled(latestPoolId);
      expect(poolIsSettled).to.eq(false);

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAPorterModule
      // ---------
      await divaPorterModule.setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Assert: finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol
      // ---------
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed
    });
  });
});
