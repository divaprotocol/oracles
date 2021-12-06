const { expect } = require("chai");
const { ethers } = require("hardhat");
const { chainlinkV3OracleAttachFixture } = require("./fixtures/ChainlinkV3OracleFixture")
const { chainlinkV3OracleFactoryDeployFixture } = require("./fixtures/ChainlinkV3OracleFactoryFixture")

// Chai/Waffle documentation: https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
// Kovan DIVA address: 0x93640bd8fEa53919A102ad2EEA4c503E640eDDAd

describe('ChainlinkV3OracleFactory', () => {
  let ChainlinkV3OracleFactory;
  let chainlinkV3OracleFactory;
  let addresses;
  const chainlinkAddress = '0x9326BFA02ADD2366b30bacB125260Af641031331';

  beforeEach(async () => {
      chainlinkV3OracleFactory = await chainlinkV3OracleFactoryDeployFixture();
    });

  it('Should create a Chainlink Oracle and add an entry to the oracle address array', async () => {
      const txCreateOracle = await chainlinkV3OracleFactory.createChainlinkV3Oracle(chainlinkAddress);
      await txCreateOracle.wait();
      addresses = await chainlinkV3OracleFactory.getChainlinkV3Oracles();
      expect(addresses[0]).is.not.null;
    });

  it('Should return the oracle address of the oracle instance', async () => {
    const oracleContract = await chainlinkV3OracleAttachFixture(addresses[0])
    const oracelAddresses = await oracleContract.getChainlinkOracleAddress();
    expect(oracelAddresses).to.eq(chainlinkAddress)
  })

  it('Should return the price', async () => {
      round_id = '36893488147419112854'
      price = 412900500000
      const oracleContract = await chainlinkV3OracleAttachFixture(addresses[0])
      const historicalPrice = await oracleContract.getHistoricalPrice(round_id);
      expect(historicalPrice[1]).to.eq(price);
  })

  it('Should submit the final reference value for an expired contingent pool', async () => {
      // create option that just expired
      
  })
  
});
