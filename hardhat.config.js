require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("hardhat-gas-reporter");
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
        version: "0.8.19",
      },
    ],
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGON_API_KEY || "",
      polygonMumbai: process.env.POLYGON_API_KEY || "",
      gnosis: process.env.GNOSISSCAN_API_KEY || "",
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      arbitrumGoerli: process.env.ARBISCAN_API_KEY || "",
      arbitrumTestnet: process.env.ARBISCAN_API_KEY || "",
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.RPC_URL_GOERLI,
        blockNumber: 9018205,
      },
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    ethMain: {
      url: process.env.RPC_URL_ETHMAIN,
      chainId: 1,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 8000000000,
    },
    sepolia: {
      url: process.env.RPC_URL_SEPOLIA,
      chainId: 11155111,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    goerli: {
      url: process.env.RPC_URL_GOERLI,
      chainId: 5,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    polygon: {
      url: process.env.RPC_URL_POLYGON,
      chainId: 137,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 160000000000,
    },
    mumbai: {
      url: process.env.RPC_URL_MUMBAI,
      chainId: 80001,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 8000000000,
    },
    gnosis: {
      url: process.env.RPC_URL_GNOSIS,
      chainId: 100,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    chiado: {
      url: process.env.RPC_URL_CHIADO,
      chainId: 10200,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 7000000000,
    },
    arbitrumMain: {
      // arbitrumOne; there also exists arbitrumNova in xdeployer
      url: process.env.RPC_URL_ARBITRUMMAINNET,
      chainId: 42161,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    arbitrumTestnet: {
      url: process.env.RPC_URL_ARBITRUMTESTNET,
      chainId: 421613,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    optimismMain: {
      url: process.env.RPC_URL_OPTIMISM_MAINNET,
      chainId: 10,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    optimismTestnet: {
      url: process.env.RPC_URL_OPTIMISM_TESTNET,
      chainId: 420,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    apothem: {
      url: process.env.RPC_URL_APOTHEM,
      chainId: 51,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    xdc: {
      url: process.env.RPC_URL_XDC,
      chainId: 50,
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
