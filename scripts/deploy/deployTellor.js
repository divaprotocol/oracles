/**
 * Script to deploy DIVAOracleTellor contract.
 * Run `yarn deploy:divaTellor`
 */

const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");

const {
  TELLOR_PLAYGROUND_ADDRESS,
  TELLOR_ADDRESS,
  DIVA_ADDRESS,
} = require("../../utils/constants"); //  DIVA Protocol v0.9.0

async function main() {
  const network = "goerli";

  const divaAddress = DIVA_ADDRESS[network];
  const tellorPlaygroundAddress = TELLOR_ADDRESS[network];
  const excessFeeRecipient = "0x1EE5730C710cF06dFA7952D61A321eC8e16b9d3A"; // temporary address
  const periodMinPeriodUndisputed = 10; // IMPORTANT to set correctly!; input in seconds
  const maxFeeAmountUSD = parseEther("10"); // $10

  const divaOracleTellorFactory = await ethers.getContractFactory(
    "DIVAOracleTellor"
  );
  const divaOracleTellor = await divaOracleTellorFactory.deploy(
    tellorPlaygroundAddress,
    excessFeeRecipient,
    periodMinPeriodUndisputed,
    maxFeeAmountUSD,
    divaAddress
  );

  await divaOracleTellor.deployed();

  console.log("DIVAOracleTellor deployed to:", divaOracleTellor.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
