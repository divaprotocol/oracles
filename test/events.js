const { ethers } = require("hardhat");

async function finalReferenceValueSetEvents(contract) {
  const filter = {
    address: contract.address,
    topics: [
      ethers.utils.id(
        "FinalReferenceValueSet(uint256,uint256,uint256,uint256)"
      ),
    ],
  };

  const events = await contract.queryFilter(filter, "latest");
  return events;
}

async function tipClaimedEvents(contract) {
  const filter = {
    address: contract.address,
    topics: [ethers.utils.id("TipClaimed(uint256,address,address,uint256)")],
  };

  const events = await contract.queryFilter(filter, "latest");
  return events;
}

async function tipAddedEvents(contract) {
  const filter = {
    address: contract.address,
    topics: [ethers.utils.id("TipAdded(uint256,address,uint256,address)")],
  };

  const events = await contract.queryFilter(filter, "latest");
  return events;
}

exports.finalReferenceValueSetEvents = finalReferenceValueSetEvents;
exports.tipClaimedEvents = tipClaimedEvents;
exports.tipAddedEvents = tipAddedEvents;
