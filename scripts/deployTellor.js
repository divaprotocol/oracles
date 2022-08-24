const { parseEther } = require("ethers/lib/utils");
const hre = require("hardhat");
const { tellorPlaygroundAddresses } = require('../utils/constants') //  DIVA Protocol v0.9.0


async function main() {

  const tellorPlaygroundAddress = tellorPlaygroundAddresses["ropsten"] 
  const excessFeeRecipient = '0x1EE5730C710cF06dFA7952D61A321eC8e16b9d3A' // temporary address
  const periodMinPeriodUndisputed = 3600; // 1 hour 
  const maxFeeAmountUSD = parseEther('10') // $10

  const divaOracleTellorFactory = await hre.ethers.getContractFactory("DIVAOracleTellor");
  divaOracleTellor = await divaOracleTellorFactory.deploy(
    tellorPlaygroundAddress,
    excessFeeRecipient,
    periodMinPeriodUndisputed,
    maxFeeAmountUSD
  );
  
  await divaOracleTellor.deployed();

  console.log("Tellor oracle deployed to:", divaOracleTellor.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
