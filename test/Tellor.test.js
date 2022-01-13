const { expect } = require("chai");
const { ethers } = require("hardhat");
const web3 = require('web3');


describe('TellorOracle', () => {
  let tellorOracle;
  let tellorPlayground;
  let tellorPlaygroundAddress = '0x320f09D9f92Cfa0e9C272b179e530634D873aeFa';
  let divaKovanAddress = '0x93640bd8fEa53919A102ad2EEA4c503E640eDDAd';
  let oracleAssetName = 'ETH/USD';
  let poolId = 100;
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
    it('Should add a value to TellorPlayground and retrieve value through TellorOracle contract', async () => {
      queryData = ethers.utils.solidityPack(['string','uint256'], ['divaProtocolPolygon', poolId])
      queryId = ethers.utils.keccak256(queryData)
      oracleValue = 200000000000
      await tellorPlayground.submitValue(queryId, web3.utils.toHex(oracleValue), 0, queryData)
      await advanceTime(7200)
      // await tellorOracle.setFinalReferenceValue(divaKovanAddress, poolId)
    });
  })

});

advanceTime = async (time) =>{
  await network.provider.send("evm_increaseTime", [time])
  await network.provider.send("evm_mine")
}
