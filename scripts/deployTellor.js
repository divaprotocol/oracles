const hre = require("hardhat");

async function main() {

  let tellorPlaygroundAddress = '0xF281e2De3bB71dE348040b10B420615104359c10' // Ropsten 
  let settlementFeeRecipient = '0x9AdEFeb576dcF52F5220709c1B267d89d5208D78' // temporary address

  const tellorOracleFactory = await hre.ethers.getContractFactory("TellorOracle");
  tellorOracle = await tellorOracleFactory.deploy(tellorPlaygroundAddress, settlementFeeRecipient);
  
  await tellorOracle.deployed();

  console.log("Tellor oracle deployed to:", tellorOracle.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
