// DIVA contract addresses on different networks (v0.9.0)
const addresses = {
    rinkeby: "0xa1fa77354D7810A6355583b566E5adB29C3f7733",
    ropsten: "0x07F0293a07703c583F4Fb4ce3aC64043732eF3bf", 
    polygon: "0x27FaBaed614059b98e7f1e79D872e13aa65640a8", 
    kovan: "0x607228ebB95aa097648Fa8b24dF8807684BBF101", 
    polygon_mumbai: "0xf2Ea8e23E1EaA2e5D280cE6b397934Ba7f30EF6B"
  }

const tellorPlaygroundAddresses = {
    ropsten: '0x86C428B9A0C43D78BEe4B6beA1e7d149B116e09C',
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