// DIVA contract addresses on different networks (v1.0.0)
const DIVA_ADDRESS = {
  rinkeby: "0x4F7ad4674e67aFc2169984f194d7a5e77926327C",
  ropsten: "0x67965e27cC17aa8073Da4cB19236bDddAD285E91",
  polygon: "0x27FaBaed614059b98e7f1e79D872e13aa65640a8",
  kovan: "0x607228ebB95aa097648Fa8b24dF8807684BBF101",
  polygon_mumbai: "0xf2Ea8e23E1EaA2e5D280cE6b397934Ba7f30EF6B",
  goerli: "0x6625011b21D1d9b9dCCACF577Bbb74D0Aa448cbF", // 17.02.2023
  apothem: "0x93640bd8fEa53919A102ad2EEA4c503E640eDDAd",
};

const BOND_FACTORY = {
  address: {
    rinkeby: "0x0ae42cF40Fb46A926e2dcCE92b2Fe785d2D1E0A0",
    ropsten: "0x74Ef0622280dfae28F9513e9173CaFF711C47eF4",
    goerli: "0x74Ef0622280dfae28F9513e9173CaFF711C47eF4",
  },
  roles: {
    allowedToken:
      "0x94a5b40e9ddb843bda953e14636ea28eec9c9e9913064fe7321def93f0bc7d95", // hash of a the ALLOWED_TOKEN role: https://rinkeby.etherscan.io/address/0x0ae42cF40Fb46A926e2dcCE92b2Fe785d2D1E0A0#readContract
    issuerRole:
      "0x114e74f6ea3bd819998f78687bfcb11b140da08e9b7d222fa9c1f1ba1f2aa122",
  },
  admin: {
    rinkeby: "0xfab4AF4EA2EB609868cDb4f744155d67f0A5BF41",
    ropsten: "0x2EA4c665AED1bAe0D1C00BB402Bde36F1a30668A",
    goerli: "0x2EA4c665AED1bAe0D1C00BB402Bde36F1a30668A",
  },
};

// Tellor contract INCLUDING the requirement to stake prior to reporting
const TELLOR_ADDRESS = {
  ethereum: "0xB3B662644F8d3138df63D2F43068ea621e2981f9",
  polygon: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
  gnosis: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
  goerli: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
  mumbai: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
  chiado: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
};

// Tellor playground contract EXCLUDING the requirement to stake prior to reporting
const TELLOR_PLAYGROUND_ADDRESS = {
  ropsten: "0x7B8AC044ebce66aCdF14197E8De38C1Cc802dB4A", // new used for testnet
  kovan: "0x320f09D9f92Cfa0e9C272b179e530634D873aeFa",
  rinkeby: "0x7B8AC044ebce66aCdF14197E8De38C1Cc802dB4A",
  goerli: "0x3251838bd813fdf6a97D32781e011cce8D225d59",
};

// DIVAOracleTellor contract using Tellor playground
const DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS = {
  ropsten: "0x331F055a7c38E2e0361312c3D1A0621016aa7BFf", // Deployed on 16 Aug 2022
  goerli: "0x3679E62e63C0C46760dA1E841bE3c8465E8513bA", // Deployed on 10 Feb 2023 (Playground version)
  // goerli: "0x63098cC6EDa33B0FbD07472B1a8dD54D4a5C2153",
};

// DIVAOracleTellor contract using actual Tellor system
const DIVA_TELLOR_ORACLE_ADDRESS = {
  goerli: "0xe3Fa3F97e684B2d835159b92779f4c804903dA67", // Deployed on 13 Dec 2022 (Playground version)
};

const COLLATERAL_TOKENS = {
  goerli: {
    dUSD: "0xFA158C9B780A4213f3201Ae74Cca013712c8538d",
  },
  apothem: {
    dUSD: "0xDA1c699f3d7a307Cd307AdBb97eBFc360180b91c",
  },
};

// PLI token addresses
const PLI_ADDRESS = {
  apothem: "0x33f4212b027E22aF7e6BA21Fc572843C0D701CD1",
};

const GOPLUGIN_DATA_FEED_ADDRESSES = {
  apothem: {
    "XDC/USDT": "0x1dE804CAd726E505F0AF221dDAd1BA7Ca1742B3F",
  },
};

const DIVA_GOPLUGIN_ADDRESS = {
  apothem: "0xb00Fe90cb2e2c73Dc6C75F66B2B25a073df207F4", // Deployed on 23 Mar 2023
};

const TELLOR_VERSION = {
  PLAYGROUND: "PLAYGROUND",
  ACTUAL: "ACTUAL",
};

// Status mapping
const STATUS = {
  0: "Open",
  1: "Submitted",
  2: "Challenged",
  3: "Confirmed",
};

const TEN_MINS = 600;
const ONE_HOUR = 3600;
const ONE_DAY = 86400;

const XDEPLOY_CHAINS = ["goerli", "mumbai"];

exports.DIVA_ADDRESS = DIVA_ADDRESS;
exports.BOND_FACTORY = BOND_FACTORY;
exports.STATUS = STATUS;
exports.TELLOR_ADDRESS = TELLOR_ADDRESS;
exports.TELLOR_PLAYGROUND_ADDRESS = TELLOR_PLAYGROUND_ADDRESS;
exports.DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS =
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS;
exports.DIVA_TELLOR_ORACLE_ADDRESS = DIVA_TELLOR_ORACLE_ADDRESS;
exports.COLLATERAL_TOKENS = COLLATERAL_TOKENS;
exports.PLI_ADDRESS = PLI_ADDRESS;
exports.GOPLUGIN_DATA_FEED_ADDRESSES = GOPLUGIN_DATA_FEED_ADDRESSES;
exports.DIVA_GOPLUGIN_ADDRESS = DIVA_GOPLUGIN_ADDRESS;
exports.TEN_MINS = TEN_MINS;
exports.ONE_HOUR = ONE_HOUR;
exports.ONE_DAY = ONE_DAY;
exports.TELLOR_VERSION = TELLOR_VERSION;
exports.XDEPLOY_CHAINS = XDEPLOY_CHAINS;
