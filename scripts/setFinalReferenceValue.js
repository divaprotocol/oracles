const hre = require("hardhat");
const DIVA_ABI = require('../contracts/abi/DIVA.json');
const { addresses } = require('../utils/constants');

async function main() {

  const network = "ropsten"
  let tellorOracleAddress = "0xED6D661645a11C45F4B82274db677867a7D32675" // Ropsten
  let poolId = 147

  // Connect to Tellor oracle contract
  const tellorOracle = await hre.ethers.getContractAt("TellorOracle", tellorOracleAddress);
  const tx = await tellorOracle.setFinalReferenceValue(addresses[network], poolId);
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
