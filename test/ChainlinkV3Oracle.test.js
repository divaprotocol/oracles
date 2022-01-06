const { expect } = require("chai");
const { ethers } = require("hardhat");
const { chainlinkV3OracleAttachFixture } = require("./fixtures/ChainlinkV3OracleFixture")
const { chainlinkV3OracleFactoryDeployFixture } = require("./fixtures/ChainlinkV3OracleFactoryFixture")
const { erc20DeployFixture, erc20AttachFixture } = require("./fixtures/MockERC20Fixture")
const { BigNumber, providers } = require('ethers')
// import { mineBlock } from './utils'
const { parseEther } = require('@ethersproject/units')
const Diamond_ABI = require('../contracts/abi/Diamond.json');

// Config for testing
// KOVAN (ETH/USD)
// https://kovan.etherscan.io/address/0x9326BFA02ADD2366b30bacB125260Af641031331#readContract
// roundId: 36893488147419114079
// price: 345813000000
// startedAt: 1641495392 
// updatedAt: 1641495392
// answeredInRound: 36893488147419114079
// blockNumber before that timestamp: 29133202
// blockNumber at that timestamp: 29133203 (note that Kovan network is forked as of block 29134000)
// blockNumber after that timestamp: 29133204

// MAINNET (ETH/USD) (change to ALCHEMY_URL_MAINNET in hardhat.config and parameters in script if you want to work with a mainnet fork)
// https://etherscan.io/address/0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419#readContract
// roundId: 92233720368547774243
// price: 400959124073
// startedAt: 1640069735
// updatedAt: 1640069735
// answeredInRound: 92233720368547774243


/**
 * Note that this test was constructed such that the expiry date of the contingent pools equals the timestamp implied by the given Chainlink roundId.
 * In reality, it's very unlikely that there will be a Chainlink data point at exactly the expiry timestamp of the pool.
 * It's not straightforward to verify whether a given roundId is the closest to a given expiry timestamp.   
 * Hence, DO NOT use the ChainlinkV3Oracle in production.
 */
describe('ChainlinkV3Oracle', () => {
  let chainlinkV3OracleFactory;
  let addresses;
  let deployer;
  let user1;
  let user2;
  let oracle;
  let getExpiryInSeconds;
  let chainlinkOracle;
  let divaDiamond;
  let round_id = '36893488147419114079';
  let price = 345813000000;
  let expiry = 1641495392; // timestamp of the available Chainlink data point (implied by the round Id)
  let chainlinkAddress = '0x9326BFA02ADD2366b30bacB125260Af641031331'; // oracle address for ETH/USD on Kovan
  let divaKovanAddress = '0x93640bd8fEa53919A102ad2EEA4c503E640eDDAd';
  let oracleAssetName = 'ETH/USD'

  getExpiryInSeconds = (offsetInSeconds) =>
        Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); 

  beforeEach(async () => {
      [deployer, user1, user2, oracle] = await ethers.getSigners();
      chainlinkV3OracleFactory = await chainlinkV3OracleFactoryDeployFixture();

      const txCreateOracle = await chainlinkV3OracleFactory.createChainlinkV3Oracle(chainlinkAddress, oracleAssetName);
      await txCreateOracle.wait();
      addresses = await chainlinkV3OracleFactory.getChainlinkV3Oracles();
      chainlinkOracle = await chainlinkV3OracleAttachFixture(addresses[0])
  });
  
  describe('Initialization', async () => {
    it('Should initialize', async () => {
      expect(await chainlinkOracle.challengeable()).to.be.false;
      expect(await chainlinkOracle.priceFeed()).to.eq(chainlinkAddress);
      expect(await chainlinkOracle.getAsset()).to.eq(oracleAssetName);
    })
  })
  
  describe('getHistoricalPrice', async () => {
    it('Should return the price for a given round Id', async () => {
      const historicalPrice = await chainlinkOracle.getHistoricalPrice(round_id);
      console.log("historical price: " + historicalPrice)
      expect(historicalPrice[0]).to.eq(round_id);
      expect(historicalPrice[1]).to.eq(price);
      expect(historicalPrice[2]).to.eq(expiry);
      expect(historicalPrice[3]).to.eq(expiry);
      expect(historicalPrice[4]).to.eq(round_id);
    })
  })

  describe('getLatestPrice', async () => {
    it('Should get the latest price', async () => {
      const latestPrice = await chainlinkOracle.getLatestPrice()
      console.log("roundId: " + latestPrice[0])
      console.log("latest price: " + latestPrice[1])
      console.log("startedAt: " + latestPrice[2])
      console.log("timestamp: " + latestPrice[3])
      console.log("answeredInRound: " + latestPrice[4])
    })
  })
  
  describe('setFinalReferenceValueById', async () => {
    let erc20;
    let chainlinkOracle;
    let userStartCollateralTokenBalance;

    beforeEach(async () => {
      divaDiamond = await ethers.getContractAt(Diamond_ABI, divaKovanAddress);
      userStartCollateralTokenBalance = parseEther("1000000");
      initialCollateralTokenAllowance = parseEther("1000000");
      
      erc20 = await erc20DeployFixture("DummyToken", "DCT", userStartCollateralTokenBalance); 
      const approveTx = await erc20.approve(divaDiamond.address, initialCollateralTokenAllowance);
      await approveTx.wait();
      chainlinkOracle = await chainlinkV3OracleAttachFixture(addresses[0])
    })

    it('Should set final reference value equal to inflection when triggered after submission period and no was input provided', async () => {
      const longAgo = 1634864960; // corresponds to roundId = '36893488147419112854' on Kovan
      let tx = await divaDiamond.createContingentPool(
        [
          parseEther("17"), // inflection
          parseEther("33"), // cap
          parseEther("10"), // floor
          parseEther("100"), // collateral balance short
          parseEther("100"), // collateral balance long
          longAgo, // expiry
          parseEther("111.556"), // short token supply
          parseEther("222.11245"), // long token supply
          "ETH Gas Price", // reference asset
          erc20.address, // collateral token
          chainlinkOracle.address // data feed provider
        ] 
      ); 
      await tx.wait();
      const latestPoolId = await divaDiamond.getLatestPoolId()
      const poolParamsBefore = await divaDiamond.getPoolParametersById(latestPoolId)
      expect(poolParamsBefore.statusFinalReferenceValue).to.eq(0)
      expect(poolParamsBefore.finalReferenceValue).to.eq(0)
      
      // Random user (here user1) sets final reference value
      await chainlinkOracle.connect(user1).setFinalReferenceValue(divaKovanAddress, '36893488147419112854', latestPoolId)

      const poolParamsAfter = await divaDiamond.getPoolParametersById(latestPoolId)
      expect(poolParamsAfter.statusFinalReferenceValue).to.eq(3)
      expect(poolParamsAfter.finalReferenceValue).to.eq(parseEther("17")) 
    })  

    it('Should set final reference value equal to 3458.13 when triggered within the submission period', async () => {
      let tx = await divaDiamond.createContingentPool(
        [
          parseEther("17"), // inflection
          parseEther("33"), // cap
          parseEther("10"), // floor
          parseEther("100"), // collateral balance short
          parseEther("100"), // collateral balance long
          expiry, // expiry
          parseEther("111.556"), // short token supply
          parseEther("222.11245"), // long token supply
          "ETH Gas Price", // reference asset
          erc20.address, // collateral token
          chainlinkOracle.address // data feed provider
        ] 
      ); 
      await tx.wait();
      const latestPoolId = await divaDiamond.getLatestPoolId()
      const poolParamsBefore = await divaDiamond.getPoolParametersById(latestPoolId)
      expect(poolParamsBefore.statusFinalReferenceValue).to.eq(0)
      expect(poolParamsBefore.finalReferenceValue).to.eq(0)

      // Random user (here user1) triggers setFinalReferenceValue
      await chainlinkOracle.connect(user1).setFinalReferenceValue(divaKovanAddress, round_id, latestPoolId)

      const poolParamsAfter = await divaDiamond.getPoolParametersById(latestPoolId)
      expect(poolParamsAfter.statusFinalReferenceValue).to.eq(3)
      expect(poolParamsAfter.finalReferenceValue).to.eq(BigNumber.from(price).mul(BigNumber.from(10).pow(18-8))) // ETH/USD value from Chainlink has 8 decimals, but DIVA is converting it to 18 decimals

      // Another user (here user2) tries to trigger setFinalReferenceValue after the value has already been set
      await expect(chainlinkOracle.connect(user2).setFinalReferenceValue(divaKovanAddress, round_id, latestPoolId)).to.be.revertedWith("Settlement: Final reference value is already submitted/confirmed"); 
    })   

    it('Should revert with message "Settlement: No permission to set the reference value" if a pool that has different data feed provider was provided', async () => {
      const nonAuthorizedDataProvider = oracle.address;
      
      let tx = await divaDiamond.createContingentPool(
        [
          parseEther("17"), // inflection
          parseEther("33"), // cap
          parseEther("10"), // floor
          parseEther("100"), // collateral balance short
          parseEther("100"), // collateral balance long
          expiry, // expiry
          parseEther("111.556"), // short token supply
          parseEther("222.11245"), // long token supply
          "ETH Gas Price", // reference asset
          erc20.address, // collateral token
          nonAuthorizedDataProvider // data feed provider
        ] 
      ); 
      await tx.wait();
      const latestPoolId = await divaDiamond.getLatestPoolId()
      const poolParamsBefore = await divaDiamond.getPoolParametersById(latestPoolId)
      expect(poolParamsBefore.statusFinalReferenceValue).to.eq(0)
      expect(poolParamsBefore.finalReferenceValue).to.eq(0)
      expect(poolParamsBefore.dataFeedProvider).to.not.eq(user1.address)

      // Random user (here user1) triggers setFinalReferenceValue for a pool that has different data feed provider
      await expect(chainlinkOracle.connect(user1).setFinalReferenceValue(divaKovanAddress, round_id, latestPoolId)).to.be.revertedWith("Settlement: No permission to set the reference value") // roundId = '36893488147419112854' => price 412900500000 (4'129.005)

    }) 

    // TODO: Test where it's DIVA's turn to provide the value after submission period expired without any input
    // TODO: it should now allow to submit a negative value
    // TODO: it should not allow to submit a value that has more than 18 decimals

  })
    
});
