const { ethers } = require("hardhat");

async function finalReferenceValueSet(contract) {
    const filter = {
        address: contract.address,
        topics: [ethers.utils.id('FinalReferenceValueSet(uint256,uint256,uint256,uint256)')],
    }

    const events = await contract.queryFilter(filter, 'latest')
    return events[0].args
}

exports.finalReferenceValueSet = finalReferenceValueSet;
