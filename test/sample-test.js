const { expect } = require("chai");
const { ethers } = require("hardhat");
// Chai/Waffle documentation: https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
//run command npx hardhat test --network kovan

describe('ChainlinkV3OracleFactory', () => {
  let ChainlinkV3OracleFactory, chainlinkV3OracleFactory;

  beforeEach(async () => {
      ChainlinkV3OracleFactory = await ethers.getContractFactory('ChainlinkV3OracleFactory');
      chainlinkV3OracleFactory = await ChainlinkV3OracleFactory.deploy(); 
      await chainlinkV3OracleFactory.deployed();
    });


  // "Kovan DIVA address: 0x93640bd8fEa53919A102ad2EEA4c503E640eDDAd
  it('Should create Chainlink Oracle', async () => {
      // ******* Add addresses to the whitelist ******* 
      const chainlink_address = '0x9326BFA02ADD2366b30bacB125260Af641031331';
      const txCreateOracle = await chainlinkV3OracleFactory.createOracle(chainlink_address);
      await txCreateOracle.wait();
      const addresses = await chainlinkV3OracleFactory.getChainlinkV3Oracles();
      console.log(addresses)

      // console.dir(chainlinkV3Oracles);
      console.log(`ChainlinkOracle contract created at ${addresses[0]}`);
      round_id = '36893488147419112854' // javascript not able to handle bignumber. Sending as string works
      price = 412900500000
      const XX = await ethers.getContractAt('ChainlinkV3Oracle', addresses[0])
      // const historical_price = await XX.getHistoricalPrice(round_id);
      // console.log(`Returned historical price for ETH/USD ${historical_price}`);
      // expect(historical_price).equals(price);
    });

  
});
