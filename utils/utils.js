// QUESTION Is index.js the right file name here?

const { ethers } = require("hardhat");
const { parseEther, parseUnits } = require("@ethersproject/units");

const encodeToOracleValue = (finalReferenceValue, collateralToUSDRate) => {
  return new ethers.utils.AbiCoder().encode(
    ["uint256", "uint256"],
    [finalReferenceValue, collateralToUSDRate]
  );
};

const decodeTellorValue = (tellorValue) => {
  return new ethers.utils.AbiCoder().decode(
    ["uint256", "uint256"],
    tellorValue
  );
};

const getQueryDataAndId = (poolId, divaAddress, chainId) => {
  const abiCoder = new ethers.utils.AbiCoder();
  const queryDataArgs = abiCoder.encode(
    ["uint256", "address", "uint256"],
    [poolId, divaAddress, chainId]
  );
  const queryData = abiCoder.encode(
    ["string", "bytes"],
    ["DIVAProtocol", queryDataArgs]
  );
  const queryId = ethers.utils.keccak256(queryData);
  return [queryData, queryId];
};

// Fee in collateral token decimals
const calcFee = (
  fee, // integer expressed with 18 decimals
  collateralBalance, // integer expressed with collateral token decimals
  collateralTokenDecimals
) => {
  const SCALING = parseUnits("1", 18 - collateralTokenDecimals);
  const UNIT = parseEther("1");

  return fee.mul(collateralBalance).mul(SCALING).div(UNIT).div(SCALING);
};

const getExpiryInSeconds = (offsetInSeconds) => {
  return Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); // 60*60 = 1h; 60*60*24 = 1d, 60*60*24*365 = 1y
};

const advanceTime = async (time) => {
  await network.provider.send("evm_increaseTime", [time]);
  await network.provider.send("evm_mine");
};

const getLastTimestamp = async () => {
  /**
   * Changed this from ethers.provider.getBlockNumber since if evm_revert is used to return
   * to a snapshot, getBlockNumber will still return the last mined block rather than the
   * block height of the snapshot.
   */
  const currentBlock = await ethers.provider.getBlock("latest");
  return currentBlock.timestamp;
};

const setNextTimestamp = async (provider, timestamp) => {
  await provider.send("evm_setNextBlockTimestamp", [timestamp]);
};

exports.advanceTime = advanceTime;
exports.encodeToOracleValue = encodeToOracleValue;
exports.decodeTellorValue = decodeTellorValue;
exports.getQueryDataAndId = getQueryDataAndId;
exports.calcFee = calcFee;
exports.getExpiryInSeconds = getExpiryInSeconds;
exports.getLastTimestamp = getLastTimestamp;
exports.setNextTimestamp = setNextTimestamp;
