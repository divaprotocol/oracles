// DIVA contract addresses on different networks (v0.9.1)
const addresses = {
  rinkeby: "0x3481C73363b52a26068b1C7006CEF98670FEE514",
  ropsten: "0xebBAA31B1Ebd727A1a42e71dC15E304aD8905211", // v0.9.1 used in the testnet app; 
  polygon: "0x27FaBaed614059b98e7f1e79D872e13aa65640a8",
  kovan: "0x607228ebB95aa097648Fa8b24dF8807684BBF101",
  polygon_mumbai: "0xf2Ea8e23E1EaA2e5D280cE6b397934Ba7f30EF6B",
  goerli: "0x2d8642777C51dB31945CeDbbC3198d75e497cb48",
};

const bondFactoryInfo = {
  address: {
    rinkeby: "0x0ae42cF40Fb46A926e2dcCE92b2Fe785d2D1E0A0",
    ropsten: "0x74Ef0622280dfae28F9513e9173CaFF711C47eF4",
    goerli: "0x74Ef0622280dfae28F9513e9173CaFF711C47eF4",
  },
  roles: {
    allowedToken:
      "0x94a5b40e9ddb843bda953e14636ea28eec9c9e9913064fe7321def93f0bc7d95", // hash of a the ALLOWED_TOKEN role: https://rinkeby.etherscan.io/address/0x0ae42cF40Fb46A926e2dcCE92b2Fe785d2D1E0A0#readContract
  },
  issuer: "0xfab4AF4EA2EB609868cDb4f744155d67f0A5BF41",
};

const tellorPlaygroundAddresses = {
  rinkeby: "0x7B8AC044ebce66aCdF14197E8De38C1Cc802dB4A", // new used for testnet
  ropsten: "0x7B8AC044ebce66aCdF14197E8De38C1Cc802dB4A", // new used for testnet
  kovan: "0x320f09D9f92Cfa0e9C272b179e530634D873aeFa",
  goerli: "0x7B8AC044ebce66aCdF14197E8De38C1Cc802dB4A",
};

// Status mapping
const status = {
  0: "Open",
  1: "Submitted",
  2: "Challenged",
  3: "Confirmed",
};

exports.addresses = addresses;
exports.bondFactoryInfo = bondFactoryInfo;
exports.status = status;
exports.tellorPlaygroundAddresses = tellorPlaygroundAddresses;
