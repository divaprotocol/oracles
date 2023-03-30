/**
 * Script to deploy DIVAGoplugin contract.
 * Run: `yarn deploy:divaGoplugin`
 */

const { network, ethers } = require("hardhat");
const { DIVA_ADDRESS, PLI_ADDRESS } = require("../../utils/constants");

async function main() {
  const divaGopluginFactory = await ethers.getContractFactory("DIVAGoplugin");
  const divaGoplugin = await divaGopluginFactory.deploy(
    DIVA_ADDRESS[network.name],
    PLI_ADDRESS[network.name]
  );

  await divaGoplugin.deployed();

  console.log("DIVAGoplugin deployed to:", divaGoplugin.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
