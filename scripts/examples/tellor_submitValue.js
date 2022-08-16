
/**
 * Script to submit a value to the tellor playground. Make sure you run this script after the pool expired.
 * Note that one address can only submit one value. It will fail if you try to submit a value with the same address again.
 * Run: `yarn hardhat run scripts/examples/tellor_submitValue.js --network ropsten`
 * Replace ropsten with any other network that is listed under addresses in constants.js
 */

const { ethers } = require('hardhat');
const TellorPlayground_ABI = require('../../contracts/abi/TellorPlayground.json');
const DIVA_ABI = require('../../contracts/abi/DIVA.json');
const { parseUnits, formatUnits } = require('@ethersproject/units')
const { addresses, tellorPlaygroundAddresses, divaTellorOracleAddresses } = require('../../utils/constants')

async function main() {

    network = "ropsten"
    const poolId = 7
    const divaAddress = addresses[network]

    // Connect to DIVA contract
    const diva = await ethers.getContractAt(DIVA_ABI, addresses[network]);
    console.log("DIVA address: ", diva.address);

    // Connect to tellor contract
    const tellorPlayground = await ethers.getContractAt(TellorPlayground_ABI, tellorPlaygroundAddresses[network]);
    console.log("DIVA address: ", diva.address);

    // Get pool parameters for the specified poolId
    poolParams = await diva.getPoolParameters(poolId);

    // Check that the DIVA Tellor oracle is the data provider
    if (poolParams.dataProvider != divaTellorOracleAddresses[network]) {
        console.log('Data provider is not DIVAOracleTellor address')
        return
    }

    // Confirm that the pool expired
    const currentTime = new Date()
    if (Number(poolParams.expiryTime) * 1000 > currentTime) {
        console.log('Pool is not expired yet')
        return
    }

    // Get chain id
    chainId = (await ethers.provider.getNetwork()).chainId;

    // Prepare Tellor value submission
    abiCoder = new ethers.utils.AbiCoder();
    queryDataArgs = abiCoder.encode(
        ["uint256", "address", "uint256"],
        [poolId, divaAddress, chainId]
    );
    queryData = abiCoder.encode(
        ["string", "bytes"],
        ["DIVAProtocol", queryDataArgs]
    );
    queryId = ethers.utils.keccak256(queryData);
    console.log('queryId', queryId)

    // Prepare values and submit to tellorPlayground
    finalReferenceValue = parseUnits("25000");
    collateralToUSDRate = parseUnits("1.00");
    oracleValue = abiCoder.encode(
        ["uint256", "uint256"],
        [finalReferenceValue, collateralToUSDRate]
    );

    // Get signers
    const [acc1, acc2, acc3] = await ethers.getSigners();
    const reporter = acc1;
    console.log("Reporter address: " + reporter.address)

    // Submit value to tellorPlayground
    const tx = await tellorPlayground
    .connect(reporter)
    .submitValue(queryId, oracleValue, 0, queryData);
    await tx.wait()

    // Check that timestamp and values have been set in tellorPlayground contract
    const tellorDataTimestamp = await tellorPlayground.timestamps(queryId, 0);
    const tellorValue = await tellorPlayground.values(
        queryId,
        tellorDataTimestamp
    );
    const formattedTellorValue = abiCoder.decode(
        ["uint256", "uint256"],
        tellorValue
    );
    console.log('poolId: ', poolId)
    console.log('tellorDataTimestamp: ', tellorDataTimestamp.toString() + " (" + new Date(poolParams.expiryTime * 1000).toLocaleString() + ")");
    console.log('finalReferenceValue: ', formattedTellorValue[0].toString() + " (" + formatUnits(formattedTellorValue[0].toString()) + ")");
    console.log('collateralToUSDRate: ', formattedTellorValue[1].toString() + " (" + formatUnits(formattedTellorValue[1].toString()) + ")");

}
 
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });