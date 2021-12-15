const { chai, use } = require("chai");
const { solidity } = require('ethereum-waffle')
const { ethers } = require('hardhat')

use(solidity)

async function erc20DeployFixture(name, symbol, tokenSupply) {
    const Factory = await ethers.getContractFactory('ERC20Token')
    return (await Factory.deploy(name, symbol, tokenSupply))
}

async function erc20AttachFixture(tokenAddress) {
    const Factory = await ethers.getContractFactory('ERC20Token')
    return (await Factory.attach(tokenAddress))
}

exports.erc20DeployFixture = erc20DeployFixture;
exports.erc20AttachFixture = erc20AttachFixture;