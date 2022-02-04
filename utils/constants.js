// DIVA contract addresses on different networks
const addresses = {
    rinkeby: "0x5EB926AdbE39029be962acD8D27130073C50A0e5",
    ropsten: "0x6455A2Ae3c828c4B505b9217b51161f6976bE7cf", 
    polygon: "0xe3343218CAa73AE523D40936D64E7f335AfDe8f9", 
    kovan: "0xa8450f6cDbC80a07Eb593E514b9Bd5503c3812Ba", 
    polygon_mumbai: "0xCDc415B8DEA4d348ccCa42Aa178611F1dbCD2f69"
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