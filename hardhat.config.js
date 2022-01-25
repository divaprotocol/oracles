require("@nomiclabs/hardhat-waffle");
require("dotenv").config();


// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const MNEMONIC = process.env.MNEMONIC

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 module.exports = {
     solidity: {
       compilers: [
         {
           version: "0.8.3"
         },
         {
           version: "0.8.4"
         },
       ]
     },
   networks: {
     hardhat: {
         forking: {
             url: process.env.ALCHEMY_URL_ROPSTEN,
         }//,
         // gas: "auto"
     },
     ropsten: {
      url: process.env.ALCHEMY_URL_ROPSTEN,
      // accounts: [`0x${PRIVATE_KEY}`], // example with private key; type: array; note that this only unlocks 1 single account
      // gas: 4100000,
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
