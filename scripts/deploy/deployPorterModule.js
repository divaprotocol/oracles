const hre = require("hardhat");
const { bondFactoryInfo } = require("../../utils/constants");

async function main() {
  const network = "goerli";
  const bondFactoryAddr = bondFactoryInfo.address[network];

  const divaPorterModuleFactory = await hre.ethers.getContractFactory(
    "DIVAPorterModule"
  );
  divaPorterModule = await divaPorterModuleFactory.deploy(bondFactoryAddr);

  await divaPorterModule.deployed();

  console.log("DIVAPorterModule deployed to:", divaPorterModule.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
