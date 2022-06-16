// DIVA contract addresses on different networks (v0.9.0)
const addresses = {
    rinkeby: "0xa1fa77354D7810A6355583b566E5adB29C3f7733",
    ropsten: "0xebBAA31B1Ebd727A1a42e71dC15E304aD8905211", // new used for testnet
    polygon: "0x27FaBaed614059b98e7f1e79D872e13aa65640a8", 
    kovan: "0x607228ebB95aa097648Fa8b24dF8807684BBF101", 
    polygon_mumbai: "0xf2Ea8e23E1EaA2e5D280cE6b397934Ba7f30EF6B"
  }

const tellorPlaygroundAddresses = {
    ropsten: '0x7B8AC044ebce66aCdF14197E8De38C1Cc802dB4A', // new used for testnet
    kovan: '0x320f09D9f92Cfa0e9C272b179e530634D873aeFa'
}

// Status mapping
const status = {
  0: "Open",
  1: "Submitted",
  2: "Challenged",
  3: "Confirmed"
}

exports.addresses = addresses;
exports.status = status;
exports.tellorPlaygroundAddresses = tellorPlaygroundAddresses;