const { expect } = require("chai");
const { ethers } = require("hardhat");
const web3 = require('web3');
const DIVA_ABI = require('../contracts/abi/DIVA.json');
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture")
const { parseEther, parseUnits } = require('@ethersproject/units');
const { advanceTime, ONE_HOUR } = require('./utils.js')
const { addresses } = require('../utils/constants') //  DIVA Protocol v0.9.0

describe('DIVAOracleTellor', () => {
  let divaOracleTellor;
  let tellorPlayground;
  let tellorPlaygroundAddress = '0xF281e2De3bB71dE348040b10B420615104359c10' // Kovan: '0x320f09D9f92Cfa0e9C272b179e530634D873aeFa' deployed in Kovan block 29245508, // Ropsten: '0xF281e2De3bB71dE348040b10B420615104359c10' deployed in Ropsten block 11834223
  let divaAddress = addresses['ropsten'] 
  let excessFeeRecipient;
  let referenceAsset = "BTC/USD";
  let finalReferenceValue = parseEther('42000');
  let collateralValueUSD = parseEther('1.14');
  let maxFeeAmountUSD = parseEther('10');

  beforeEach(async () => {
    [user1, user2, reporter1, reporter2, excessFeeRecipient] = await ethers.getSigners();

    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber: 12085815 // choose a value after the block timestamp where contracts used in these tests (DIVA and Tellor) were deployed  
        },
      },],
    });

    const divaOracleTellorFactory = await ethers.getContractFactory("DIVAOracleTellor");
    divaOracleTellor = await divaOracleTellorFactory.deploy(tellorPlaygroundAddress, excessFeeRecipient.address, ONE_HOUR, maxFeeAmountUSD);
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
    let settlementFeeAmount;
    
    beforeEach(async () => {
        diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
        userStartCollateralTokenBalance = parseEther("1000000");
        initialCollateralTokenAllowance = parseEther("1000000");
        erc20 = await erc20DeployFixture("DummyToken", "DCT", userStartCollateralTokenBalance, user1.address, 18); 
        await erc20.approve(diva.address, initialCollateralTokenAllowance);
        erc20Decimals = await erc20.decimals();

        // Create a contingent pool that already expired using Tellor as the oracle
        currentBlockTimestamp = await (await ethers.provider.getBlock()).timestamp
        await diva.createContingentPool(
            [
              referenceAsset,                   // reference asset
              currentBlockTimestamp,            // expiryTime; Tellor timestamp: 1642100218
              parseEther("40000"),              // floor
              parseEther("43000"),              // inflection
              parseEther("46000"),              // cap
              parseUnits("100", erc20Decimals), // collateral balance short
              parseUnits("100", erc20Decimals), // collateral balance long              
              parseEther("100"),                // supplyPositionToken
              erc20.address,                    // collateral token
              divaOracleTellor.address,         // data feed provider
              0                                 // capacity
            ]
        );

        latestPoolId = await diva.getLatestPoolId()
        poolParams = await diva.getPoolParameters(latestPoolId)
        console.log(latestPoolId)
        console.log(poolParams)

        settlementFeeAmount = (poolParams.collateralBalance).mul(poolParams.settlementFee).div(parseEther('1')) // TODO: Update if min fee is introduced in DIVA contract; result is in collateral decimals;
        console.log("pool collateralBalance: " + poolParams.collateralBalance)
        console.log("settlementFee: " + poolParams.settlementFee)
        console.log("settlementFeeAmount: " + settlementFeeAmount)

        // Tellor value submission preparation
        abiCoder = new ethers.utils.AbiCoder
        queryDataArgs = abiCoder.encode(['uint256'], [latestPoolId])
        queryData = abiCoder.encode(['string','bytes'], ['DIVAProtocolPolygon', queryDataArgs])
        queryId = ethers.utils.keccak256(queryData)
        oracleValue = abiCoder.encode(['uint256','uint256'],[finalReferenceValue, collateralValueUSD])
        // console.log("queryDataArgs: " + queryDataArgs)
        // console.log("queryData: " + queryData)
        // console.log("queryId: " + queryId)
        // console.log("oracleValue: " + oracleValue)
        // console.log("decode: " + abiCoder.decode(['uint256','uint256'], oracleValue)) // test

    })

    describe('setFinalReferenceValue', () => {
      it.only('Should add a value to TellorPlayground and retrieve value through DIVAOracleTellor contract', async () => {
          expect(poolParams.finalReferenceValue).to.eq(0)
          expect(poolParams.statusFinalReferenceValue).to.eq(0)
          console.log("poolParams")
          console.log(poolParams)
          // Submit value to Tellor playground contract
          // console.log("queryId: " + queryId)
          // console.log("web3.utils.toHex(oracleValue): " + web3.utils.toHex(oracleValue))    // WHY not simply use orcleValue? seems to be the same as oracleValue?
          // console.log("queryData: " + queryData)
          await tellorPlayground.submitValue(queryId, web3.utils.toHex(oracleValue), 0, queryData)

          // get timestamp of first reporter submission
          const tellorDataTimestamp = await tellorPlayground.timestamps(queryId, 0);

          const tellorValue = await tellorPlayground.values(queryId, tellorDataTimestamp);
          console.log("Tellor data timestamp: " + tellorDataTimestamp)
          console.log("Tellor value: " + abiCoder.decode(['uint256','uint256'], tellorValue));

          currentBlockTimestamp = await (await ethers.provider.getBlock()).timestamp
          console.log("Block timestamp which includes the submitValue tx: " + currentBlockTimestamp)

          await advanceTime(7200) // 2 hours

          currentBlockTimestamp = await (await ethers.provider.getBlock()).timestamp
          console.log("Block timestamp next block: " + currentBlockTimestamp)
          await divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)
          poolParams = await diva.getPoolParameters(latestPoolId)
          expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue)
          expect(poolParams.statusFinalReferenceValue).to.eq(3) // 3 = Confirmed
      });

    });
    
    describe('transferFeeClaim', () => {
      it('Should transfer __all__ the fee claim to the excessFeeRecipientAddress', async () => {
        let claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
        let claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
        expect(claimsDIVAOracleTellor).to.eq(0)
        expect(claimsExcessFeeRecipient).to.eq(0)

        await tellorPlayground.submitValue(queryId, web3.utils.toHex(oracleValue), 0, queryData)
        await advanceTime(7200) // 2 hours
        await divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)
        claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
        claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
        expect(claimsDIVAOracleTellor).to.eq(settlementFeeAmount);
        expect(claimsExcessFeeRecipient).to.eq(0);

        await divaOracleTellor.transferFeeClaim(divaAddress, erc20.address, claimsDIVAOracleTellor)
        claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
        claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
        expect(claimsDIVAOracleTellor).to.eq(0);
        expect(claimsExcessFeeRecipient).to.eq(settlementFeeAmount);
      });

      it('Should transfer a __partial__ fee claim to the excessFeeRecipientAddress', async () => {
        let claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
        let claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
        expect(claimsDIVAOracleTellor).to.eq(0)
        expect(claimsExcessFeeRecipient).to.eq(0)

        await tellorPlayground.submitValue(queryId, web3.utils.toHex(oracleValue), 0, queryData)
        await advanceTime(7200) // 2 hours
        await divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)
        claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)

        await divaOracleTellor.transferFeeClaim(divaAddress, erc20.address, claimsDIVAOracleTellor.sub(1))
        claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
        claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
        expect(claimsDIVAOracleTellor).to.eq(1);
        expect(claimsExcessFeeRecipient).to.eq(settlementFeeAmount.sub(1));
      });
    });

  });
});
