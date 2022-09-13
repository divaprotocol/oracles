require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("dotenv").config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const MNEMONIC = process.env.MNEMONIC;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
      },
    ],
  },
  etherscan: {
    apiKey: {
      ropsten: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
    },
  },
  networks: {
    hardhat: {
      forking: {
        // url: process.env.RPC_URL_RINKEBY,
        // blockNumber: 10932590,
        // url: process.env.RPC_URL_ROPSTEN,
        // blockNumber: 12750642,
        url: process.env.RPC_URL_GOERLI,
        blockNumber: 7496645,
      },
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    ropsten: {
      url: process.env.RPC_URL_ROPSTEN,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 8000000000,
    },
    rinkeby: {
      url: process.env.RPC_URL_RINKEBY,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    kovan: {
      url: process.env.RPC_URL_KOVAN,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    polygon_mumbai: {
      url: process.env.RPC_URL_POLYGON_MUMBAI,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 8000000000,
    },
    goerli: {
      url: process.env.RPC_URL_GOERLI,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
  },
  mocha: {
    timeout: 100000,
  },
};
