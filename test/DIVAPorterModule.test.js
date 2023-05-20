const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  erc20DeployFixture,
  erc20AttachFixture,
} = require("./fixtures/MockERC20Fixture");
const { parseUnits } = require("@ethersproject/units");

const DIVA_ABI = require("../contracts/abi/DIVA.json");
const BOND_ABI = require("../contracts/abi/Bond.json");
const BOND_FACTORY_ABI = require("../contracts/abi/BondFactory.json");
const { DIVA_ADDRESS, BOND_FACTORY } = require("../utils/constants");
const {
  setNextBlockTimestamp,
  getLastBlockTimestamp,
} = require("../utils/utils");

const network = "goerli"; // should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 6;
const paymentTokenDecimals = 18;
const tokenAmount = "100000000000000";

describe("DIVAPorterModule", () => {
  let user1, issuer, longRecipient, shortRecipient;
  let divaPorterModule;
  let divaAddress = DIVA_ADDRESS[network];
  let bondFactoryAddr = BOND_FACTORY.address[network];
  let bondFactoryAdmin = BOND_FACTORY.admin[network];
  let bondAddress;
  let bond;
  let poolId;
  let poolParams;
  let collateralToken, bondCollateralToken;
  let paymentToken;
  let gracePeriodEnd;
  let bondTotalSupply;
  let createContingentPoolParams;

  beforeEach(async () => {
    // Get users
    [user1, issuer, longRecipient, shortRecipient] = await ethers.getSigners();

    // Get DIVA protocol contract
    diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

    // Impersonate bondFactoryAdmin
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [bondFactoryAdmin],
    });

    // Generate signer of BondFactory admin
    const bondFactoryAdminSigner = await ethers.getSigner(bondFactoryAdmin);

    // Fund the bondFactoryAdmin account with sufficient ETH
    await hre.network.provider.send("hardhat_setBalance", [
      bondFactoryAdmin,
      "0x100000000000000000000",
    ]);

    // Get BondFactory contract
    const bondFactory = await ethers.getContractAt(
      BOND_FACTORY_ABI,
      bondFactoryAddr
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
      collateralTokenDecimals,
      "0"
    );

    // Approve CollateralToken to DIVA Porter module contract
    await collateralToken.approve(
      divaPorterModule.address,
      parseUnits(tokenAmount, collateralTokenDecimals)
    );

    // Deploy CollateralToken for Bond
    bondCollateralToken = await erc20DeployFixture(
      "BondCollateralToken",
      "BCT",
      parseUnits(tokenAmount, collateralTokenDecimals),
      issuer.address,
      collateralTokenDecimals,
      "0"
    );

    // Deploy PaymentToken
    paymentToken = await erc20DeployFixture(
      "PaymentToken",
      "PAT",
      parseUnits(tokenAmount, paymentTokenDecimals),
      issuer.address,
      paymentTokenDecimals,
      "0"
    );

    // Grant allowed token role for payment token and collateral token in order to use them for creating bonds.
    // Only needed if `isTokenAllowListEnabled` is true (which it is in the current contract).
    // Check out the contract: https://github.com/porter-finance/v1-core/blob/main/contracts/BondFactory.sol#L150
    await bondFactory
      .connect(bondFactoryAdminSigner)
      .grantRole(BOND_FACTORY.roles.allowedToken, paymentToken.address);
    await bondFactory
      .connect(bondFactoryAdminSigner)
      .grantRole(BOND_FACTORY.roles.allowedToken, bondCollateralToken.address);

    // Grant issuerRole to issuer
    await bondFactory
      .connect(bondFactoryAdminSigner)
      .grantRole(BOND_FACTORY.roles.issuerRole, issuer.address);
    // Approve CollateralToken to BondFactory contract with issuer
    await bondCollateralToken
      .connect(issuer)
      .approve(
        bondFactory.address,
        parseUnits(tokenAmount, collateralTokenDecimals)
      );

    // Create Bond contract using BondFactory contract
    const currentBlockTimestamp = await getLastBlockTimestamp();
    const tx = await bondFactory.connect(issuer).createBond(
      "DummyBond", // name
      "DBD", // symbol
      currentBlockTimestamp + 1000, // maturity
      paymentToken.address, // paymentToken
      bondCollateralToken.address, // collateralToken
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

    createContingentPoolParams = {
      referenceAsset: bondAddress, // Porter Bond address
      inflection: parseUnits("600", collateralTokenDecimals), // inflection
      gradient: parseUnits("0.5", collateralTokenDecimals), // gradient
      collateralAmount: parseUnits("100", collateralTokenDecimals), // collateral amount
      collateralToken: collateralToken.address, // collateral token
      capacity: parseUnits("300", collateralTokenDecimals), // capacity
      longRecipient: longRecipient.address, // address of long token recipient
      shortRecipient: shortRecipient.address, // address of short token recipient
      permissionedERC721Token: ethers.constants.AddressZero, // Address of ERC721 token
    };
  });

  describe("createContingentPool", async () => {
    it("Should create contingent pool on DIVA protocol", async () => {
      // ---------
      // Act: Call createContingentPool function inside DIVA Porter module
      // ---------
      // Extract the returned poolId using `callStatic`. Note that this does not
      // modify state.
      poolId = await divaPorterModule.callStatic.createContingentPool(
        divaAddress,
        createContingentPoolParams
      );
      
      // Actually execute the tx. 
      await divaPorterModule.createContingentPool(
        divaAddress,
        createContingentPoolParams
      );

      // Note: It was not possible to extract the "PoolIssued" event, most likely because
      // `diva.createContingentPool` is called via the Porter wrapper function.
      // That's why the poolId is obtained via the `callStatic` method.

      // ---------
      // Assert: Confirm that new pool is created with correct params
      // ---------
      poolParams = await diva.getPoolParameters(poolId);

      const shortTokenInstance = await erc20AttachFixture(
        await poolParams.shortToken
      );
      const longTokenInstance = await erc20AttachFixture(
        await poolParams.longToken
      );
      expect(poolParams.referenceAsset).to.eq(bondAddress.toLowerCase());
      expect(poolParams.expiryTime).to.eq(gracePeriodEnd.toNumber());
      expect(poolParams.dataProvider).to.eq(divaPorterModule.address);
      expect(poolParams.floor).to.eq(0);
      expect(poolParams.cap).to.eq(bondTotalSupply);
      expect(await shortTokenInstance.balanceOf(shortRecipient.address)).to.eq(
        createContingentPoolParams.collateralAmount
      );
      expect(await longTokenInstance.balanceOf(longRecipient.address)).to.eq(
        createContingentPoolParams.collateralAmount
      );
    });

    // ---------
    // Reverts
    // ---------
    it("Should revert if user passes a non-bond address for referenceAsset", async () => {
      // ---------
      // Arrange: Set referenceAsset as non-bond address
      // ---------
      createContingentPoolParams.referenceAsset = divaPorterModule.address;

      // ---------
      // Act & Assert: Confirm that the createContingentPool function will fail if called with non-bond address as referenceAsset
      // ---------
      await expect(
        divaPorterModule.createContingentPool(
          divaAddress,
          createContingentPoolParams
        )
      ).to.be.revertedWith("DIVAPorterModule: invalid Bond address");
    });
  });

  describe("setFinalReferenceValue", async () => {
    beforeEach(async () => {
      // Create congingent pool using DIVA Porter module.
      // Extract the returned poolId using `callStatic`. Note that this does not
      // modify state.
      poolId = await divaPorterModule.callStatic.createContingentPool(
        divaAddress,
        createContingentPoolParams
      );
      
      // Actually execute the tx. 
      await divaPorterModule.createContingentPool(
        divaAddress,
        createContingentPoolParams
      );

      // Get the pool parameters
      poolParams = await diva.getPoolParameters(poolId);

      // Wait till the pool end
      await setNextBlockTimestamp(gracePeriodEnd.toNumber());
    });

    it("Should set an unpaid amount from Bond as the final reference value in DIVA Protocol", async () => {
      // ---------
      // Arrange: Confirm that finalRereferenceValue and statusFinalReferenceValue are not yet set on DIVA Protocol
      // and the pool was not yet settled on DIVA Porter module.
      // ---------
      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);

      const poolIsSettled = await divaPorterModule.poolIsSettled(poolId);
      expect(poolIsSettled).to.eq(false);

      const amountUnpaid = await bond.amountUnpaid();

      // ---------
      // Act: Call setFinalReferenceValue function inside DIVAPorterModule
      // ---------
      await divaPorterModule.setFinalReferenceValue(divaAddress, poolId);

      // ---------
      // Assert: Confirm that statusFinalReferenceValue is updated accordingly in DIVA Protocol
      // and finalReferenceValue is udpated as amountUnpaid
      // and payout amounts (net of fees) are correct
      // ---------
      poolParams = await diva.getPoolParameters(poolId);
      expect(poolParams.statusFinalReferenceValue).to.eq(3); // 3 = Confirmed
      expect(poolParams.finalReferenceValue).to.eq(
        amountUnpaid.mul(parseUnits("1", 18 - paymentTokenDecimals))
      ); // DIVA Protocol expects the final value to be represented as an integer with 18 decimals
      expect(poolParams.payoutLong).to.eq(
        parseUnits("0.997", collateralTokenDecimals)
      ); // (1- 0.3% fee)
      expect(poolParams.payoutShort).to.eq(
        parseUnits("0", collateralTokenDecimals)
      );
    });

    // ---------
    // Reverts
    // ---------
    it("Should revert if the pool is already settled", async () => {
      // ---------
      // Arrange: Settle pool using amountUnpaid from Porter Bond contract
      // ---------
      expect(poolParams.finalReferenceValue).to.eq(0);
      expect(poolParams.statusFinalReferenceValue).to.eq(0);

      const poolIsSettled = await divaPorterModule.poolIsSettled(poolId);
      expect(poolIsSettled).to.eq(false);

      await divaPorterModule.setFinalReferenceValue(divaAddress, poolId);

      // ---------
      // Act & Assert: Confirm that the setFinalReferenceValue function will fail if called after the pool has been already settled
      // ---------
      await expect(
        divaPorterModule.setFinalReferenceValue(divaAddress, poolId)
      ).to.be.revertedWith("DIVAPorterModule: pool is already settled");
    });
  });
});
