const { expect } = require("chai");
const { ethers } = require("hardhat");
const web3 = require('web3');
const DIVA_ABI = require('../contracts/abi/DIVA.json');
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture")
const { parseEther, parseUnits } = require('@ethersproject/units');

describe('TellorOracle', () => {
  let tellorOracle;
  let tellorPlayground;
  let tellorPlaygroundAddress = '0xF281e2De3bB71dE348040b10B420615104359c10' // Kovan: '0x320f09D9f92Cfa0e9C272b179e530634D873aeFa' deployed in Kovan block 29245508, // Ropsten: '0xF281e2De3bB71dE348040b10B420615104359c10' deployed in Ropsten block 11834223
  let divaAddress = '0x6455A2Ae3c828c4B505b9217b51161f6976bE7cf' // Kovan: '0xa8450f6cDbC80a07Eb593E514b9Bd5503c3812Ba' deployed in Kovan block 29190631, Ropsten: '0x6455A2Ae3c828c4B505b9217b51161f6976bE7cf' deployed in Ropsten block n/a (10 Jan 2022, before block 11812205)
  let settlementFeeRecipient;
  let referenceAsset = "BTC/USD";
  let finalReferenceValue = '42000000000000000000000'; // QUESTION: Use parseEther instead?

  beforeEach(async () => {
    [settlementFeeRecipient] = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber: 11840999 // Kovan: 29245720 (212 blocks after playground contract deployment)
          },},],
    });

    const tellorOracleFactory = await ethers.getContractFactory("TellorOracle");
    tellorOracle = await tellorOracleFactory.deploy(tellorPlaygroundAddress, settlementFeeRecipient.address);
    tellorPlayground = await ethers.getContractAt("TellorPlayground", tellorPlaygroundAddress);
  });

  describe('setFinalReferenceValue', async () => {
    let erc20, erc20Decimals;
    let userStartCollateralTokenBalance;
    let initialCollateralTokenAllowance;
    let currentBlockTimestamp;
    let latestPoolId;
    let poolParams;
    let abiCoder, queryData, queryId, oracleValue;
    let totalPoolCollateral, settlementFeeAmount;

    beforeEach(async () => {
        diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
        userStartCollateralTokenBalance = parseEther("1000000");
        initialCollateralTokenAllowance = parseEther("1000000");
        erc20 = await erc20DeployFixture("DummyToken", "DCT", userStartCollateralTokenBalance);
        await erc20.approve(diva.address, initialCollateralTokenAllowance);
        erc20Decimals = await erc20.decimals();

        // Create a contingent pool that already expired using Tellor as the oracle
        currentBlockTimestamp = await (await ethers.provider.getBlock()).timestamp
        await diva.createContingentPool(
            [
              parseEther("43000"),              // inflection
              parseEther("46000"),              // cap
              parseEther("40000"),              // floor
              parseUnits("0.1", erc20Decimals), // collateral balance short
              parseUnits("0.1", erc20Decimals), // collateral balance long
              currentBlockTimestamp,            // expiry; Tellor timestamp: 1642100218
              parseEther("200"),                // short token supply
              parseEther("200"),                // long token supply
              referenceAsset,                   // reference asset
              erc20.address,                    // collateral token
              tellorOracle.address,             // data feed provider
              0                                 // capacity
            ]
          );

          latestPoolId = await diva.getLatestPoolId()
          poolParams = await diva.getPoolParameters(latestPoolId)

          totalPoolCollateral = (poolParams.collateralBalanceShort).add(poolParams.collateralBalanceLong) // result is in collateral decimals (e.g., 100 ~ 10000 if 2 decimals)
          settlementFeeAmount = totalPoolCollateral.mul(poolParams.settlementFee).div(parseEther('1')) // TODO: Update if min fee is introduced in DIVA contract; result is in collateral decimals;
          console.log("totalPoolCollateral: " + totalPoolCollateral)
          console.log("settlementFee: " + poolParams.settlementFee)
          console.log("settlementFeeAmount: " + settlementFeeAmount)

          // Tellor value submission preparation
          abiCoder = new ethers.utils.AbiCoder
          queryDataArgs = abiCoder.encode(['uint256'], [latestPoolId])
          queryData = abiCoder.encode(['string','bytes'], ['divaProtocolPolygon', queryDataArgs])
          queryId = ethers.utils.keccak256(queryData)
          oracleValue = abiCoder.encode(['uint256'],[finalReferenceValue])

    })

    describe('setFinalReferenceValue', () => {
      it('Should add a value to TellorPlayground and retrieve value through TellorOracle contract', async () => {
          expect(poolParams.finalReferenceValue).to.eq(0)
          expect(poolParams.statusFinalReferenceValue).to.eq(0)

          // Submit value to Tellor playground contract
          await tellorPlayground.submitValue(queryId, web3.utils.toHex(oracleValue), 0, queryData)

          const tellorDataTimestamp = await tellorPlayground.timestamps(queryId, 0); // 0 is array index
          const tellorValue = await tellorPlayground.values(queryId, tellorDataTimestamp);
          console.log("Tellor data timestamp: " + tellorDataTimestamp)
          console.log("Tellor value: " + tellorValue)

          currentBlockTimestamp = await (await ethers.provider.getBlock()).timestamp
          console.log("Block timestamp which includes the submitValue tx: " + currentBlockTimestamp)

          await advanceTime(7200) // 2 hours

          currentBlockTimestamp = await (await ethers.provider.getBlock()).timestamp
          console.log("Block timestamp next block: " + currentBlockTimestamp)

          await tellorOracle.setFinalReferenceValue(divaAddress, latestPoolId)
          poolParams = await diva.getPoolParameters(latestPoolId)
          expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue)
          expect(poolParams.statusFinalReferenceValue).to.eq(3) // 3 = Confirmed
      });

      it('Should transfer the fee claim to the settlementFeeRecipientAddress', async () => {
          let claimsTellorOracle = await diva.getClaims(erc20.address, tellorOracle.address)
          let claimsSettlementFeeRecipient = await diva.getClaims(erc20.address, settlementFeeRecipient.address)
          expect(claimsTellorOracle).to.eq(0)
          expect(claimsSettlementFeeRecipient).to.eq(0)

          await tellorPlayground.submitValue(queryId, web3.utils.toHex(oracleValue), 0, queryData)
          await advanceTime(7200) // 2 hours
          await tellorOracle.setFinalReferenceValue(divaAddress, latestPoolId)

          claimsTellorOracle = await diva.getClaims(erc20.address, tellorOracle.address)
          claimsSettlementFeeRecipient = await diva.getClaims(erc20.address, settlementFeeRecipient.address)
          expect(claimsTellorOracle).to.eq(0);
          expect(claimsSettlementFeeRecipient).to.eq(settlementFeeAmount);

      });
    });

  });
});

advanceTime = async (time) =>{
  await network.provider.send("evm_increaseTime", [time])
  await network.provider.send("evm_mine")
}

// Create contingent pool
// getExpiryInSeconds = (offsetInSeconds) =>
// Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); // 60*60 = 1h; 60*60*24 = 1d, 60*60*24*365 = 1y
