const { chai, use } = require("chai");
const { solidity } = require('ethereum-waffle')
const { ethers } = require('hardhat')

use(solidity)

async function chainlinkV3OracleDeployFixture() {
    const Factory = await ethers.getContractFactory('ChainlinkV3Oracle')
    return (await Factory.deploy())
}

async function chainlinkV3OracleAttachFixture(tokenAddress) {
    const Factory = await ethers.getContractFactory('ChainlinkV3Oracle')
    return (await Factory.attach(tokenAddress))
}

exports.chainlinkV3OracleDeployFixture = chainlinkV3OracleDeployFixture;
exports.chainlinkV3OracleAttachFixture = chainlinkV3OracleAttachFixture;
