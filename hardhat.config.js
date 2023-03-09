require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("xdeployer");
require("dotenv").config();

const { xdeployConfig } = require("./xdeploy-config");
const { XDEPLOY_CHAINS } = require("./utils/constants");

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const MNEMONIC = process.env.MNEMONIC;

// Need to update the XDEPLOY_CHAINS to the chains you want to deploy contract on when you deploy it using xdeployer
const generalXdeployConfig = {
  salt: process.env.SALT,
  signer: process.env.PRIVATE_KEY,
  gasLimit: 12 * 10 ** 6,
  networks: XDEPLOY_CHAINS,
  rpcUrls: XDEPLOY_CHAINS.map(
    (chainName) => process.env[`RPC_URL_${chainName.toUpperCase()}`]
  ),
};

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
      polygon: process.env.POLYGON_API_KEY || "",
      polygonMumbai: process.env.POLYGON_API_KEY || "",
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.RPC_URL_GOERLI,
        blockNumber: 8508421,
      },
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    ethereum: {
      url: process.env.RPC_URL_MAINNET,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 8000000000,
    },
    sepolia: {
      url: process.env.RPC_URL_SEPOLIA,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    goerli: {
      url: process.env.RPC_URL_GOERLI,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    polygon: {
      url: process.env.RPC_URL_POLYGON,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    mumbai: {
      url: process.env.RPC_URL_MUMBAI,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 8000000000,
    },
    gnosis: {
      url: process.env.RPC_URL_GNOSIS,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    chiado: {
      url: process.env.RPC_URL_CHIADO,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
  },
  xdeploy: { ...xdeployConfig, ...generalXdeployConfig },
  mocha: {
    timeout: 100000,
  },
};
