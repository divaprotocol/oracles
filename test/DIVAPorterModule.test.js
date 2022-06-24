const { expect } = require("chai");
const { ethers } = require("hardhat");
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture");
const { parseEther, parseUnits } = require("@ethersproject/units");
const { constants } = require("ethers");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const { addresses } = require("../utils/constants"); //  DIVA Protocol v0.9.0

const network = "ropsten"; // for tellorPlayground address; should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 6;

function getExpiryInSeconds(offsetInSeconds) {
  return Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); // 60*60 = 1h; 60*60*24 = 1d, 60*60*24*365 = 1y
}

describe("DIVAPorterModule", () => {
  let divaPorterModule;
  let divaAddress = addresses[network];
  let bondFactory;
  let bondAddress;

  beforeEach(async () => {
    [user1] = await ethers.getSigners();

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
      diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

      erc20 = await erc20DeployFixture(
        "DummyToken",
        "DCT",
        parseEther("1000000000"),
        user1.address,
        collateralTokenDecimals
      );
      await erc20.approve(divaAddress, parseEther("1000000000"));

      const tx = await bondFactory.createBond(
        "DummyBond",
        "DBD",
        erc20.address
      );
      const receipt = await tx.wait();
      bondAddress = receipt.events?.find((x) => x.event === "BondCreated")?.args
        .newBond;
    });

    // it("Should throw error when user pass non-bond address for referenceAsset", async () => {
    //   await expect(
    //     divaPorterModule.createContingentPool(divaAddress, [
    //       divaPorterModule.address, // Non Porter Bond address
    //       parseEther("40000"), // floor
    //       parseEther("43000"), // inflection
    //       parseEther("46000"), // cap
    //       parseUnits("100", 18), // collateral balance
    //       parseEther("200"), // supplyPositionToken
    //       erc20.address, // collateral token
    //       divaPorterModule.address, // data provider
    //       0, // capacity
    //     ])
    //   ).to.be.revertedWith("DIVAPorterModule: invalid Bond address");
    // });

    it("Should create contingent pool on DIVA protocol", async () => {
      console.log("bondFactory.address", bondFactory.address);
      console.log("bondAddress", bondAddress);
      console.log("erc20.address", erc20.address);
      console.log("divaPorterModule.address", divaPorterModule.address);
      console.log("divaAddress", divaAddress);

      try {
        // await divaPorterModule.createContingentPool(divaAddress, [
        //   bondAddress, // Porter Bond address
        //   parseEther("40000"), // floor
        //   parseEther("43000"), // inflection
        //   parseEther("46000"), // cap
        //   parseUnits("100", 15), // gradient
        //   parseEther("0.2"), // collateralAmount
        //   erc20.address, // collateral token
        //   divaPorterModule.address, // data provider
        //   parseEther("300"), // capacity
        // ]);

        const tx = await diva.createContingentPool([
          "BTC/USD",
          getExpiryInSeconds(7200), // Expiry in 2h
          parseEther("1198.53"),
          parseEther("1605.33"),
          parseEther("2001.17"),
          parseEther("0.33"),
          parseUnits("15001.358", collateralTokenDecimals),
          erc20.address,
          divaPorterModule.address,
          constants.MaxUint256, // Uncapped
        ]);
        const receipt = await tx.wait();
        const poolId = receipt.events?.find((x) => x.event === "PoolIssued")
          ?.args.poolId;
        console.log(receipt.events);
      } catch (error) {
        console.error(error);
      }

      // ---------
      // Assert: finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol
      // ---------
      latestPoolId = await diva.getLatestPoolId();
      console.log(latestPoolId);
      poolParams = await diva.getPoolParameters(latestPoolId);
      console.log(poolParams);
      expect(poolParams.referenceAsset).to.eq(bondAddress); // check if referenceAsset is equal to bondAddress
    });
  });
});
