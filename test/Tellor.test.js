const { expect } = require("chai");
const { ethers } = require("hardhat");
const web3 = require('web3');
const DIVA_ABI = require('../contracts/abi/DIVA.json');
const { erc20DeployFixture, erc20AttachFixture } = require("./fixtures/MockERC20Fixture")
const { parseEther } = require('@ethersproject/units')



describe('TellorOracle', () => {
  let tellorOracle;
  let tellorPlayground;
  let tellorPlaygroundAddress = '0x320f09D9f92Cfa0e9C272b179e530634D873aeFa'; // deployed in Kovan block 29245508
  let divaKovanAddress = '0xa8450f6cDbC80a07Eb593E514b9Bd5503c3812Ba'; // deployed in Kovan block 29190631
  let oracleAssetName = 'ETH/USD';
  let poolId = 1;
  let accounts;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:29245720
          },},],
    });
    const tellorOracleFactory = await ethers.getContractFactory("TellorOracle");
    tellorOracle = await tellorOracleFactory.deploy(tellorPlaygroundAddress, oracleAssetName);
    tellorPlayground = await ethers.getContractAt("TellorPlayground", tellorPlaygroundAddress);
    
  });

  describe('setFinalReferenceValue', async () => {
    let erc20;
    let userStartCollateralTokenBalance;
    let initialCollateralTokenAllowance;

    beforeEach(async () => {
        diva = await ethers.getContractAt(DIVA_ABI, divaKovanAddress);
        userStartCollateralTokenBalance = parseEther("1000000");
        initialCollateralTokenAllowance = parseEther("1000000");
        
        erc20 = await erc20DeployFixture("DummyToken", "DCT", userStartCollateralTokenBalance); 
        const approveTx = await erc20.approve(diva.address, initialCollateralTokenAllowance);
        await approveTx.wait();
      })

    it('Should add a value to TellorPlayground and retrieve value through TellorOracle contract', async () => {               
        // Create an already expired contingent pool using Tellor Oracle as the data provider
        let tx = await diva.createContingentPool(
            [
              parseEther("43000"),      // inflection
              parseEther("46000"),      // cap
              parseEther("40000"),      // floor
              parseEther("100"),        // collateral balance short
              parseEther("100"),        // collateral balance long
              getExpiryInSeconds(-10),  // expiry
              parseEther("200"),        // short token supply
              parseEther("200"),        // long token supply
              oracleAssetName,          // reference asset
              erc20.address,            // collateral token
              tellorOracle.address,     // data feed provider
              0                         // capacity
            ] 
          );
        await tx.wait();
        const latestPoolId = await diva.getLatestPoolId()
        const poolParamsBefore = await diva.getPoolParameters(latestPoolId)
        expect(poolParamsBefore.statusFinalReferenceValue).to.eq(0)
        expect(poolParamsBefore.finalReferenceValue).to.eq(0) 

        // Submit value to Tellor contract
        queryData = ethers.utils.solidityPack(['string','uint256'], ['divaProtocolPolygon', poolId])
        queryId = ethers.utils.keccak256(queryData)
        oracleValue = 43000000000000000000000 // 43'000 with 18 decimals
        await tellorPlayground.submitValue(queryId, web3.utils.toHex(oracleValue), 0, queryData)
        await advanceTime(7200) // 2 hours
        await tellorOracle.setFinalReferenceValue(divaKovanAddress, poolId)
    });
  })

});

advanceTime = async (time) =>{
  await network.provider.send("evm_increaseTime", [time])
  await network.provider.send("evm_mine")
}

// Create contingent pool
getExpiryInSeconds = (offsetInSeconds) =>
Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); // 60*60 = 1h; 60*60*24 = 1d, 60*60*24*365 = 1y
