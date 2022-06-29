const { expect } = require("chai");
const { ethers } = require("hardhat");
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture");
const { parseEther, parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const BOND_ABI = require("../contracts/abi/Bond.json");
const BOND_FACTORY_ABI = require("../contracts/abi/BondFactory.json");
const { addresses, bondFactoryInfo } = require("../utils/constants");
const { setNextTimestamp, getLastTimestamp } = require("./utils.js");

const network = "rinkeby"; // should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 6;
const paymentTokenDecimals = 6;
const tokenAmount = "1000000000";
const transferAmount = "100000000";

describe("DIVAPorterModule", () => {
  let divaPorterModule;
  let divaAddress = addresses[network];
  let bondFactoryAddr = bondFactoryInfo.address[network];
  let bondAddress;
  let bond;
  let latestPoolId;
  let poolParams;
  let collateralToken;
  let paymentToken;
  let gracePeriodEnd;
  let bondTotalSupply;

  beforeEach(async () => {
    // Get user
    [user1] = await ethers.getSigners();

    // Get DIVA protocol contract
    diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

    // Get BondFactory contract using signer of issuer role account
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [bondFactoryInfo.issuer],
    });
    const signer = await ethers.getSigner(bondFactoryInfo.issuer);
    bondFactory = await ethers.getContractAt(
      BOND_FACTORY_ABI,
      bondFactoryAddr,
      signer
    );

    // Deploy DIVA Porter module contract
    const divaPorterModuleFactory = await ethers.getContractFactory(
      "DIVAPorterModule"
    );
    divaPorterModule = await divaPorterModuleFactory.deploy(
      bondFactory.address
    );

    // Deploy CollateralToken
    collateralToken = await erc20DeployFixture(
      "CollateralToken",
      "COT",
      parseUnits(tokenAmount, collateralTokenDecimals),
      user1.address,
      collateralTokenDecimals
    );

    // Approve CollateralToken to DIVA Porter module contract
    await collateralToken.approve(
      divaPorterModule.address,
      parseUnits(tokenAmount, collateralTokenDecimals)
    );

    // Transfer CollateralToken to issuer of BondFactory
    await collateralToken.transfer(
      bondFactoryInfo.issuer,
      parseUnits(transferAmount, collateralTokenDecimals)
    );

    // Approve CollateralToken to BondFactory contract with issuer role signer
    await collateralToken
      .connect(signer)
      .approve(
        bondFactory.address,
        parseUnits(transferAmount, collateralTokenDecimals)
      );

    // Deploy PaymentToken
    paymentToken = await erc20DeployFixture(
      "PaymentToken",
      "PAT",
      parseUnits(tokenAmount, paymentTokenDecimals),
      user1.address,
      paymentTokenDecimals
    );

    // Grant allowed token role for payment token and collateral token in order to use them for creating bonds
    // Only needed if `isTokenAllowListEnabled` is true (which it is in the current contract)
    // Check out the contract: https://github.com/porter-finance/v1-core/blob/main/contracts/BondFactory.sol#L150
    await bondFactory.grantRole(
      bondFactoryInfo.roles.allowedToken,
      paymentToken.address
    );
    // Using same collateral token as for createContingentPool for simplicity
    await bondFactory.grantRole(
      bondFactoryInfo.roles.allowedToken,
      collateralToken.address
    );

    // Create Bond contract using BondFactory contract
    const currentBlockTimestamp = await getLastTimestamp();
    const tx = await bondFactory.createBond(
      "DummyBond", // name
      "DBD", // symbol
      currentBlockTimestamp + 1000, // maturity
      paymentToken.address, // paymentToken
      collateralToken.address, // collateralToken
      parseUnits("2000", collateralTokenDecimals), // collateralTokenAmount
      parseUnits("1000", collateralTokenDecimals), // convertibleTokenAmount
      parseUnits("1000", paymentTokenDecimals) // bonds
    );
    const receipt = await tx.wait();
    
    // Get address of the bond created
    bondAddress = receipt.events?.find((x) => x.event === "BondCreated")?.args
      .newBond;

    // Connect to the created bond contract 
    bond = await ethers.getContractAt(BOND_ABI, bondAddress);

    // Read grace period and supply details from the bond contract
    gracePeriodEnd = await bond.gracePeriodEnd();
    bondTotalSupply = await bond.totalSupply();
  });

  describe("createContingentPool", async () => {
    it("Should throw an error when user passes a non-bond address for referenceAsset", async () => {
      const invalidReferenceAsset = divaPorterModule.address;

      await expect(
        divaPorterModule.createContingentPool(divaAddress, [
          invalidReferenceAsset, // Non Porter Bond address
          parseUnits("600", collateralTokenDecimals), // inflection
          parseEther("0.5"), // gradient
          parseUnits("100", collateralTokenDecimals), // collateral amount
          collateralToken.address, // collateral token
          parseUnits("300", collateralTokenDecimals), // capacity
        ])
      ).to.be.revertedWith("DIVAPorterModule: invalid Bond address");
    });

    it("Should create contingent pool on DIVA protocol", async () => {
      // ---------
      // Act: Call createContingentPool function inside DIVA Porter module
      // ---------
      await divaPorterModule.createContingentPool(divaAddress, [
        bondAddress, // Porter Bond address
        parseUnits("600", collateralTokenDecimals), // inflection
        parseEther("0.5"), // gradient
        parseUnits("100", collateralTokenDecimals), // collateral amount
        collateralToken.address, // collateral token
        parseUnits("300", collateralTokenDecimals), // capacity
      ]);

      // ---------
      // Assert: Confirm that new pool is created with Bond address as referenceAsset
      // and expiryTime is equal to periodEnd of Bond
      // and dataProvider is equal to DIVA Porter module address
      // and floor is equal to 0
      // and cap is equal to totalSupply of Bond contract
      // ---------
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.referenceAsset).to.eq(bondAddress.toLowerCase());
      expect(poolParams.expiryTime).to.eq(gracePeriodEnd.toNumber());
      expect(poolParams.dataProvider).to.eq(divaPorterModule.address);
      expect(poolParams.floor).to.eq(0);
      expect(poolParams.cap).to.eq(bondTotalSupply);
    });
  });

  describe("setFinalReferenceValue", async () => {
    beforeEach(async () => {
      // Create congingent pool using DIVA Porter module
      await divaPorterModule.createContingentPool(divaAddress, [
        bondAddress, // Porter Bond address
        parseUnits("600", collateralTokenDecimals), // inflection
        parseEther("0.5"), // gradient
        parseUnits("100", collateralTokenDecimals), // collateral amount
        collateralToken.address, // collateral token
        parseUnits("300", collateralTokenDecimals), // capacity
      ]);

      // Wait till the pool end
      await setNextTimestamp(ethers.provider, gracePeriodEnd.toNumber());
    });

    it("Should set an unpaid amount from Bond as the final reference value in DIVA Protocol", async () => {
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

      const amountUnpaid = await bond.amountUnpaid();

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAPorterModule
      // ---------
      await divaPorterModule.setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Assert: Confirm that statusFinalReferenceValue is updated accordingly in DIVA Protocol
      // and finalReferenceValue is udpated as amountUnpaid
      // ---------
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed
      expect(poolParams.finalReferenceValue).to.eq(
        amountUnpaid.mul(parseUnits("1", 18 - paymentTokenDecimals))
      ); // DIVA Protocol expects the final value to be represented as an integer with 18 decimals
      
      // TODO: 
      // expect(poolParams.payoutLong).to.eq(0);
      // expect(poolParams.payoutShort).to.eq(1*0.997); // You have to deduct settlement + protocol fee of combined 0.3% (0.003)

    });

    // ---------
    // Reverts
    // ---------
    it("Should revert if the pool is already settled", async () => {
      // ---------
      // Arrange: Settle pool using amountUnpaid from Porter Bond contract
      // ---------
      latestPoolId = await diva.getLatestPoolId();
      poolParams = await diva.getPoolParameters(latestPoolId);
      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);

      const poolIsSettled = await divaPorterModule.poolIsSettled(latestPoolId);
      expect(poolIsSettled).to.eq(false);

      await divaPorterModule.setFinalReferenceValue(divaAddress, latestPoolId);

      // ---------
      // Act & Assert: Confirm that the setFinalReferenceValue function will fail if called after the pool has been already settled
      // ---------
      await expect(
        divaPorterModule.setFinalReferenceValue(divaAddress, latestPoolId)
      ).to.be.revertedWith("DIVAPorterModule: pool is already settled");
    });
  });
});
