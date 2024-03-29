const { ethers } = require("hardhat");
const { parseUnits } = require("@ethersproject/units");
const util = require("util");
const fs = require("fs");
const child_process = require("child_process");

const encodeOracleValue = (finalReferenceValue, collateralToUSDRate) => {
  return new ethers.utils.AbiCoder().encode(
    ["uint256", "uint256"],
    [finalReferenceValue, collateralToUSDRate]
  );
};

const decodeOracleValue = (tellorValue) => {
  return new ethers.utils.AbiCoder().decode(
    ["uint256", "uint256"],
    tellorValue
  );
};

const getQueryDataAndId = (poolId, divaAddress, chainId) => {
  const abiCoder = new ethers.utils.AbiCoder();
  const queryDataArgs = abiCoder.encode(
    ["bytes32", "address", "uint256"],
    [poolId, divaAddress, chainId]
  );
  const queryData = abiCoder.encode(
    ["string", "bytes"],
    ["DIVAProtocol", queryDataArgs]
  );
  const queryId = ethers.utils.keccak256(queryData);
  return [queryData, queryId];
};

const calcSettlementFee = (
  collateralBalance, // Basis for fee calcuation
  fee, // Settlement fee percent expressed as an integer with 18 decimals
  collateralTokenDecimals,
  collateralToUSDRate = parseUnits("0") // USD value of one unit of collateral token
) => {
  // Fee amount in collateral token decimals
  feeAmount = collateralBalance.mul(fee).div(parseUnits("1"));

  // Fee amount in USD expressed as integer with 18 decimals
  feeAmountUSD = feeAmount
    .mul(parseUnits("1", 18 - collateralTokenDecimals))
    .mul(collateralToUSDRate)
    .div(parseUnits("1"));

  return [
    feeAmount, // expressed as integer with collateral token decimals
    feeAmountUSD, // expressed as integer with 18 decimals
  ];
};

const getExpiryInSeconds = (offsetInSeconds) => {
  return Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); // 60*60 = 1h; 60*60*24 = 1d, 60*60*24*365 = 1y
};

const advanceTime = async (time) => {
  await network.provider.send("evm_increaseTime", [time]);
  await network.provider.send("evm_mine");
};

const getLastBlockTimestamp = async () => {
  /**
   * Changed this from ethers.provider.getBlockNumber since if evm_revert is used to return
   * to a snapshot, getBlockNumber will still return the last mined block rather than the
   * block height of the snapshot.
   */
  const currentBlock = await ethers.provider.getBlock("latest");
  return currentBlock.timestamp;
};

const setNextBlockTimestamp = async (timestamp) => {
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
};

// Auxiliary function to generate the `xdeploy-config.js` file which contains the
// contract name as well as the constructor args which are part of the xdeployer config parameters.
const generateXdeployConfig = (contract) => {
  const xdeployConfig = `
      const xdeployConfig = {
        contract: "${contract}",
        constructorArgsPath: "./deploy-args.js",
      };
      exports.xdeployConfig = xdeployConfig;
    `;
  writeFile("xdeploy-config.js", xdeployConfig);
};

// Auxiliary function to execute command line commands from within the script.
const execCommand = async (command) => {
  try {
    const { stdout, stderr } = await exec(command);
    if (stderr && !stderr.toLowerCase().includes("warning")) {
      console.error("stderr:", stderr);
      throw new Error(stderr);
    }
    console.log(stdout);
    return stdout;
  } catch (e) {
    console.error(e);
    return false;
  }
};

const exec = util.promisify(child_process.exec);

const writeFileSync = (fileName, content) => {
  fs.writeFileSync(fileName, content, "utf8", (err) => {
    if (err) throw err;
    console.log(`The ${fileName} has been saved!`);
  });
};

const writeFile = (fileName, content) => {
  fs.writeFile(fileName, content, "utf8", (err) => {
    if (err) throw err;
    console.log(`The ${fileName} has been saved!`);
  });
};

const getCurrentTimestampInSeconds = () => {
  return Math.floor(Date.now() / 1000);
};

exports.advanceTime = advanceTime;
exports.encodeOracleValue = encodeOracleValue;
exports.decodeOracleValue = decodeOracleValue;
exports.getQueryDataAndId = getQueryDataAndId;
exports.calcSettlementFee = calcSettlementFee;
exports.getExpiryInSeconds = getExpiryInSeconds;
exports.getLastBlockTimestamp = getLastBlockTimestamp;
exports.setNextBlockTimestamp = setNextBlockTimestamp;
exports.generateXdeployConfig = generateXdeployConfig;
exports.execCommand = execCommand;
exports.writeFile = writeFile;
exports.writeFileSync = writeFileSync;
exports.getCurrentTimestampInSeconds = getCurrentTimestampInSeconds;
