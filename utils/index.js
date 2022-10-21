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

exports.encodeToOracleValue = encodeToOracleValue;
exports.decodeTellorValue = decodeTellorValue;
exports.getQueryDataAndId = getQueryDataAndId;
exports.calcFee = calcFee;
