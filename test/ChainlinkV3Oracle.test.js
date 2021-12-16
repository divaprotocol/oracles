const { expect } = require("chai");
const { ethers } = require("hardhat");
const { chainlinkV3OracleAttachFixture } = require("./fixtures/ChainlinkV3OracleFixture")
const { chainlinkV3OracleFactoryDeployFixture } = require("./fixtures/ChainlinkV3OracleFactoryFixture")
const { erc20DeployFixture, erc20AttachFixture } = require("./fixtures/ERC20TokenFixture")
const { BigNumber, providers } = require('ethers')
const { parseEther } = require('@ethersproject/units')

const { abi: Pool_ABI } = require('../contracts/abi/PoolFacet.json');
const { abi: Getter_ABI } = require('../contracts/abi/GetterFacet.json');

describe('ChainlinkV3Oracle', () => {
  let chainlinkV3OracleFactory;
  let addresses;
  let chainlinkAddress;
  let poolFacet;
  let divaKovanAddress;
  let deployer;
  let user1;
  let user2;
  let oracle;
  let getExpiryInSeconds;


  getExpiryInSeconds = (offsetInSeconds) =>
        Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); // 60*60 = 1h; 60*60*24 = 1d, 60*60*24*365 = 1y

  // getPastExpiry = (secondsAgo) => Math.floor(Date.now() / 1000 - secondsAgo).toString();

  beforeEach(async () => {
      [deployer, user1, user2, oracle] = await ethers.getSigners();
      chainlinkV3OracleFactory = await chainlinkV3OracleFactoryDeployFixture();
      chainlinkAddress = '0x9326BFA02ADD2366b30bacB125260Af641031331'; // oracle address for ETH/USD on Kovan
      divaKovanAddress = '0x93640bd8fEa53919A102ad2EEA4c503E640eDDAd';

      const txCreateOracle = await chainlinkV3OracleFactory.createChainlinkV3Oracle(chainlinkAddress);
      await txCreateOracle.wait();
      addresses = await chainlinkV3OracleFactory.getChainlinkV3Oracles();
  });
  
  describe.only('Initialization', async () => {
    it('Should initialize', async () => {
      const oracleContract = await chainlinkV3OracleAttachFixture(addresses[0])

      expect(await oracleContract.challengeable()).to.be.false;
      expect(await oracleContract.priceFeed()).to.eq(chainlinkAddress)
    })
  })
  
  describe.only('getHistoricalPrice', async () => {
    it('Should return the price for a given round Id', async () => {
      const oracleContract = await chainlinkV3OracleAttachFixture(addresses[0])
      round_id = '36893488147419112854'
      price = 412900500000
      
      const historicalPrice = await oracleContract.getHistoricalPrice(round_id);
      expect(historicalPrice[1]).to.eq(price);
    })
  })

  describe('setFinalReferenceValueById', async () => {
    // IMPORTANT: To test this, you have to remove the two require statements in the setFinalReferenceValueById part
    let erc20;
    let chainlinkOracle;

    beforeEach(async () => {
      poolFacet = await ethers.getContractAt(Pool_ABI, divaKovanAddress);
      getterFacet = await ethers.getContractAt(Getter_ABI, divaKovanAddress)
      erc20 = await erc20DeployFixture("DummyToken", "DCT", "1000000000000000000000000"); // 1mio tokens
      const approveTx = await erc20.approve(poolFacet.address, "1000000000000000000000001");
      await approveTx.wait();
      chainlinkOracle = await chainlinkV3OracleAttachFixture(addresses[0])
    })

    it('Should get the latest price', async () => {
      const latestPrice = await chainlinkOracle.getLatestPrice()
      console.log("roundId: " + latestPrice[0])
      console.log("latest price: " + latestPrice[1]) // 3710.16527416, 408523104765
      console.log("startedAt: " + latestPrice[2])
      console.log("timestamp: " + latestPrice[3])
      console.log("answeredInRound: " + latestPrice[4])
    })

    // TODO: it should now allow to submit a negative value

    it('Should set final reference value equal to inflection when triggered after submission period and no input provided', async () => {
      // QUESTION: Should it set the value to inflection? I thought that this happens at first redemption?
      let tx = await poolFacet.createContingentPool(
        [
          parseEther("17"), // inflection
          parseEther("33"), // cap
          parseEther("10"), // floor
          parseEther("100"), // collateral balance short
          parseEther("100"), // collateral balance long
          1634864960, // expiry date (long expired; corresponds to roundId = '36893488147419112854')
          parseEther("111.556"), // short token supply
          parseEther("222.11245"), // long token supply
          "ETH Gas Price", // reference asset
          erc20.address, // collateral token
          chainlinkOracle.address // data feed provider
        ] 
      ); 
      await tx.wait();
      const latestPoolId = await getterFacet.getLatestPoolId()
      const poolParamsBefore = await getterFacet.getPoolParametersById(latestPoolId)
      expect(poolParamsBefore.statusFinalReferenceValue).to.eq(0)
      expect(poolParamsBefore.finalReferenceValue).to.eq(0)
      
      // Random user (here user1) sets final reference value
      await chainlinkOracle.connect(user1).setFinalReferenceValue(divaKovanAddress, '36893488147419112854', latestPoolId) // roundId = '36893488147419112854' => price 412900500000 (4'129.005)

      const poolParamsAfter = await getterFacet.getPoolParametersById(latestPoolId)
      expect(poolParamsAfter.statusFinalReferenceValue).to.eq(3)
      expect(poolParamsAfter.finalReferenceValue).to.eq(parseEther("17")) // 412900500000000000000000
    })  

    it('Should set final reference value equal to 4129.005 when triggered within the submission period', async () => {
      let tx = await poolFacet.createContingentPool(
        [
          parseEther("17"), // inflection
          parseEther("33"), // cap
          parseEther("10"), // floor
          parseEther("100"), // collateral balance short
          parseEther("100"), // collateral balance long
          getExpiryInSeconds(-100), // expiry date
          parseEther("111.556"), // short token supply
          parseEther("222.11245"), // long token supply
          "ETH Gas Price", // reference asset
          erc20.address, // collateral token
          chainlinkOracle.address // data feed provider
        ] 
      ); 
      await tx.wait();
      const latestPoolId = await getterFacet.getLatestPoolId()
      const poolParamsBefore = await getterFacet.getPoolParametersById(latestPoolId)
      expect(poolParamsBefore.statusFinalReferenceValue).to.eq(0)
      expect(poolParamsBefore.finalReferenceValue).to.eq(0)

      // Random user (here user1) triggers setFinalReferenceValue
      await chainlinkOracle.connect(user1).setFinalReferenceValue(divaKovanAddress, '36893488147419112854', latestPoolId) // roundId = '36893488147419112854' => price 412900500000 (4'129.005)

      const poolParamsAfter = await getterFacet.getPoolParametersById(latestPoolId)
      expect(poolParamsAfter.statusFinalReferenceValue).to.eq(3)
      expect(poolParamsAfter.finalReferenceValue).to.eq(parseEther("4129.005")) 

      // Another user (here user2) tries to trigger setFinalReferenceValue after the value has already been set
      await expect(chainlinkOracle.connect(user2).setFinalReferenceValue(divaKovanAddress, '36893488147419112854', latestPoolId)).to.be.revertedWith("Settlement: Final reference value is already submitted/confirmed"); 
    })   

    it('Should reverts with message "Settlement: No permission to set the reference value" if a pool that has different data feed provider was provided', async () => {
      let tx = await poolFacet.createContingentPool(
        [
          parseEther("17"), // inflection
          parseEther("33"), // cap
          parseEther("10"), // floor
          parseEther("100"), // collateral balance short
          parseEther("100"), // collateral balance long
          getExpiryInSeconds(-100), // expiry date
          parseEther("111.556"), // short token supply
          parseEther("222.11245"), // long token supply
          "ETH Gas Price", // reference asset
          erc20.address, // collateral token
          oracle.address // data feed provider
        ] 
      ); 
      await tx.wait();
      const latestPoolId = await getterFacet.getLatestPoolId()
      const poolParamsBefore = await getterFacet.getPoolParametersById(latestPoolId)
      expect(poolParamsBefore.statusFinalReferenceValue).to.eq(0)
      expect(poolParamsBefore.finalReferenceValue).to.eq(0)
      expect(poolParamsBefore.dataFeedProvider).to.not.eq(user1.address)

      // Random user (here user1) triggers setFinalReferenceValue for a pool that has different data feed provider
      await expect(chainlinkOracle.connect(user1).setFinalReferenceValue(divaKovanAddress, '36893488147419112854', latestPoolId)).to.be.revertedWith("Settlement: No permission to set the reference value") // roundId = '36893488147419112854' => price 412900500000 (4'129.005)

    }) 

    // TODO: Test where it's DIVA's turn to provide the value after submission period expired without any input
  })
  
  
  
});
