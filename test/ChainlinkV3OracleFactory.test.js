const { expect } = require("chai");
const { ethers } = require("hardhat");
const { chainlinkV3OracleAttachFixture } = require("./fixtures/ChainlinkV3OracleFixture")
const { chainlinkV3OracleFactoryDeployFixture } = require("./fixtures/ChainlinkV3OracleFactoryFixture")

describe('ChainlinkV3OracleFactory', () => {
  let chainlinkV3OracleFactory;
  let chainlinkAddress;
  let oracleAssetName;

  beforeEach(async () => {
      chainlinkV3OracleFactory = await chainlinkV3OracleFactoryDeployFixture();
      chainlinkAddress = '0x9326BFA02ADD2366b30bacB125260Af641031331'; // oracle address for ETH/USD on Kovan
      oracleAssetName = 'ETH/USD';
  });

  describe('createChainlinkV3Oracle', async () => {
    it('Should create a Chainlink Oracle and add a first entry to the oracle address array', async () => {
      addresses = await chainlinkV3OracleFactory.getChainlinkV3Oracles();
      expect(addresses[0]).is.undefined;
      
      const txCreateOracle = await chainlinkV3OracleFactory.createChainlinkV3Oracle(chainlinkAddress, oracleAssetName);
      await txCreateOracle.wait();
      
      addresses = await chainlinkV3OracleFactory.getChainlinkV3Oracles();
      expect(addresses[0]).is.not.undefined;
      expect(addresses[0]).is.not.null;
      expect(await chainlinkV3OracleFactory.exists(addresses[0])).to.be.true;
    });
  })  

});
