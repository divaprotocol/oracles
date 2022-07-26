const hre = require("hardhat");
const DIVA_ABI = require('../contracts/abi/DIVA.json');
const { addresses } = require('../utils/constants');

async function main() {

  const network = "ropsten"
  let divaOracleTellorAddress = "0x2f4218C9262216B7B73A76334e5A98F3eF71A61c" // Ropsten
  let poolId = 157
  divaAddress = addresses[network]
  console.log("divaAddress: " + divaAddress)

  // Connect to Tellor oracle contract
  const divaOracleTellor = await hre.ethers.getContractAt("DIVAOracleTellor", divaOracleTellorAddress);
  const tx = await divaOracleTellor.setFinalReferenceValue(divaAddress, poolId);
  await tx.wait()

  // Connect to DIVA contract
  let diva = await ethers.getContractAt(DIVA_ABI, divaAddress);

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId)
  console.log(poolParams)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
