require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const MNEMONIC = process.env.MNEMONIC

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 module.exports = {
     solidity: {
       compilers: [
         {
           version: "0.8.9"
         },
       ]
     },
   networks: {
     hardhat: {
         forking: {
             url: process.env.ALCHEMY_URL_ROPSTEN,
         }
     },
     ropsten: {
      url: process.env.ALCHEMY_URL_ROPSTEN,
      accounts: {
        mnemonic: MNEMONIC, 
      },
      gasPrice: 8000000000
    },
    rinkeby: {
      url: process.env.ALCHEMY_URL_RINKEBY,
      accounts: {
        mnemonic: MNEMONIC, 
      },
    },
    kovan: {
      url: process.env.ALCHEMY_URL_KOVAN,
      accounts: {
        mnemonic: MNEMONIC,
      }
    },
     polygon_mumbai: {
      url: process.env.ALCHEMY_URL_POLYGON_MUMBAI,
      accounts: {
        mnemonic: MNEMONIC, 
      },
      gasPrice: 8000000000,
    }
   }
};
