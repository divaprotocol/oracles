// DIVA contract addresses on different networks (v1.0.0)
const DIVA_ADDRESS = {
  ethereum: "",
  polygon: "0x27FaBaed614059b98e7f1e79D872e13aa65640a8",
  gnosis: "",
  goerli: "0x131e157322b3DDaE6eF28a124f566bC9c177De69", // 17.05.2023 (main version)
  sepolia: "0x8ca8dE48c4507fa54a83Dde7ac68097e87520eEc", // 17.05.2023 (main version)
  mumbai: "0x05029c04AFB6cf53Ef0af7af7e970E53A7143bD3", // 17.05.2023 (secondary version)
  chiado: "0x05029c04AFB6cf53Ef0af7af7e970E53A7143bD3", // 17.05.2023 (secondary version)
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
// Source: https://docs.tellor.io/tellor/the-basics/contracts-reference
const TELLOR_ADDRESS = {
  ethereum: "0xB3B662644F8d3138df63D2F43068ea621e2981f9",
  polygon: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
  gnosis: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
  goerli: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
  sepolia: "0x199839a4907ABeC8240D119B606C98c405Bb0B33",
  mumbai: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
  chiado: "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0",
};

// Tellor playground contract EXCLUDING the requirement to stake prior to reporting
const TELLOR_PLAYGROUND_ADDRESS = {
  goerli: "0x3251838bd813fdf6a97D32781e011cce8D225d59",
  sepolia: "0x3251838bd813fdf6a97D32781e011cce8D225d59",
  mumbai: "0x3251838bd813fdf6a97D32781e011cce8D225d59",
  arbitrumTestnet: "0x3251838bd813fdf6a97D32781e011cce8D225d59",
  optimismTestnet: "0x3251838bd813fdf6a97D32781e011cce8D225d59",
};

// DIVAOracleTellor contract using Tellor playground
const DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS = {
  goerli: "0x263649785895386Fa0e1dABe3e56e45D2c060D3b", // Deployed on 18 May 2023 (Playground version, 10 sec dispute period)
  sepolia: "0x978877CaBA44A866f286BaA44198e4D5e54D49f5", // Deployed on 18 May 2023 (Playground version, 10 sec dispute period)
  mumbai: "0xD471407D1b014115b8c308fDB1EaF62449188251", // Deployed on 18 May 2023 (Playground version, 10 sec dispute period)
};

// DIVAOracleTellor contract using actual Tellor system
const DIVA_TELLOR_ORACLE_ADDRESS = {
  goerli: "0xe3Fa3F97e684B2d835159b92779f4c804903dA67", // Deployed on 13 Dec 2022 (Playground version)
};

const COLLATERAL_TOKENS = {
  goerli: {
    dUSD: "0xFA158C9B780A4213f3201Ae74Cca013712c8538d",
  },
  sepolia: {
    dUSD: "0xf0172F664195e3b91C3B8600476C58de48366a61",
  }
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

const XDEPLOY_CHAINS = ["goerli", "mumbai", "sepolia"];

exports.DIVA_ADDRESS = DIVA_ADDRESS;
exports.BOND_FACTORY = BOND_FACTORY;
exports.STATUS = STATUS;
exports.TELLOR_ADDRESS = TELLOR_ADDRESS;
exports.TELLOR_PLAYGROUND_ADDRESS = TELLOR_PLAYGROUND_ADDRESS;
exports.DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS =
  DIVA_TELLOR_PLAYGROUND_ORACLE_ADDRESS;
exports.DIVA_TELLOR_ORACLE_ADDRESS = DIVA_TELLOR_ORACLE_ADDRESS;
exports.COLLATERAL_TOKENS = COLLATERAL_TOKENS;
exports.TEN_MINS = TEN_MINS;
exports.ONE_HOUR = ONE_HOUR;
exports.ONE_DAY = ONE_DAY;
exports.TELLOR_VERSION = TELLOR_VERSION;
exports.XDEPLOY_CHAINS = XDEPLOY_CHAINS;
