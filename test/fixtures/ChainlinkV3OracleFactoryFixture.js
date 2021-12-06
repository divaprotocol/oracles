const { chai, use } = require("chai");
const { solidity } = require('ethereum-waffle')
const { ethers } = require('hardhat')

use(solidity)

async function chainlinkV3OracleFactoryDeployFixture() {
    const Factory = await ethers.getContractFactory('ChainlinkV3OracleFactory')
    return (await Factory.deploy())
}

async function chainlinkV3OracleFactoryAttachFixture(tokenAddress) {
    const Factory = await ethers.getContractFactory('ChainlinkV3OracleFactory')
    return (await Factory.attach(tokenAddress))
}

exports.chainlinkV3OracleFactoryDeployFixture = chainlinkV3OracleFactoryDeployFixture;
exports.chainlinkV3OracleFactoryAttachFixture = chainlinkV3OracleFactoryAttachFixture;