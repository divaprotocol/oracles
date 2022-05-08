const { expect } = require("chai");
const { ethers } = require("hardhat");
const DIVA_ABI = require('../contracts/abi/DIVA.json');
const { BigNumber } = require('ethers')
const { erc20DeployFixture } = require("./fixtures/MockERC20Fixture")
const { parseEther, parseUnits } = require('@ethersproject/units');
const { getLastTimestamp, setNextTimestamp, ONE_HOUR } = require('./utils.js')
const { addresses, tellorPlaygroundAddresses } = require('../utils/constants') //  DIVA Protocol v0.9.0

const network = 'ropsten' // should be the same as in hardhat -> forking -> url settings in hardhat.config.js
const collateralTokenDecimals = 18

describe('DIVAOracleTellor', () => {
  let divaOracleTellor;
  let tellorPlayground;
  let tellorPlaygroundAddress = tellorPlaygroundAddresses[network] // Kovan: '0x320f09D9f92Cfa0e9C272b179e530634D873aeFa' deployed in Kovan block 29245508, // Ropsten: '0xF281e2De3bB71dE348040b10B420615104359c10' deployed in Ropsten block 11834223
  let divaAddress = addresses[network] 
  let excessFeeRecipient;
  let referenceAsset = "BTC/USD";
  let maxFeeAmountUSD = parseEther('10');
  let minPeriodUndisputed = ONE_HOUR;

  beforeEach(async () => {
    [user1, user2, reporter1, reporter2, excessFeeRecipient] = await ethers.getSigners();

    // Reset block
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
    divaOracleTellor = await divaOracleTellorFactory.deploy(tellorPlaygroundAddress, excessFeeRecipient.address, minPeriodUndisputed, maxFeeAmountUSD);
    tellorPlayground = await ethers.getContractAt("TellorPlayground", tellorPlaygroundAddress);
  });

  describe('setFinalReferenceValue', async () => {
    let erc20;
    let userStartCollateralTokenBalance;
    let initialCollateralTokenAllowance;
    let currentBlockTimestamp;
    let latestPoolId;
    let poolParams;
    let abiCoder, queryData, queryId, oracleValue;
    
    beforeEach(async () => {
        diva = await ethers.getContractAt(DIVA_ABI, divaAddress);
        userStartCollateralTokenBalance = parseEther("1000000");
        initialCollateralTokenAllowance = parseEther("1000000");
        erc20 = await erc20DeployFixture("DummyToken", "DCT", userStartCollateralTokenBalance, user1.address, collateralTokenDecimals); 
        await erc20.approve(diva.address, initialCollateralTokenAllowance);

        // Create an expired contingent pool that uses Tellor as the data provider
        currentBlockTimestamp = await getLastTimestamp()
        await diva.createContingentPool(
            [
              referenceAsset,                             // reference asset
              currentBlockTimestamp,                      // expiryTime
              parseEther("40000"),                        // floor
              parseEther("43000"),                        // inflection
              parseEther("46000"),                        // cap
              parseUnits("100", collateralTokenDecimals), // collateral balance short
              parseUnits("100", collateralTokenDecimals), // collateral balance long              
              parseEther("200"),                          // supplyPositionToken
              erc20.address,                              // collateral token
              divaOracleTellor.address,                   // data provider
              0                                           // capacity
            ]
        );

        latestPoolId = await diva.getLatestPoolId()
        poolParams = await diva.getPoolParameters(latestPoolId)

        // Calculate
        settlementFeeAmount = poolParams.collateralBalance.mul(parseUnits('1', 18 - collateralTokenDecimals)).mul(poolParams.settlementFee).div(parseEther('1')).div(parseUnits('1', 18 - collateralTokenDecimals)) 

        // Prepare Tellor value submission
        abiCoder = new ethers.utils.AbiCoder
        queryDataArgs = abiCoder.encode(['uint256'], [latestPoolId])
        queryData = abiCoder.encode(['string','bytes'], ['DIVAProtocolPolygon', queryDataArgs])
        queryId = ethers.utils.keccak256(queryData)
        
    })

    it('Should add a value to TellorPlayground', async () => {
        // ---------
        // Act: Prepare values and submit to tellorPlayground
        // ---------
        finalReferenceValue = parseEther('42000');
        collateralValueUSD = parseEther('1.14');
        oracleValue = abiCoder.encode(['uint256','uint256'],[finalReferenceValue, collateralValueUSD])
        
        // ---------
        // Act: Submit value to tellorPlayground
        // ---------
        await tellorPlayground.submitValue(queryId, oracleValue, 0, queryData) 

        // ---------
        // Assert: Check that timestamp and values have been set in tellorPlayground contract
        // ---------
        lastBlockTimestamp = await getLastTimestamp()
        const tellorDataTimestamp = await tellorPlayground.timestamps(queryId, 0);
        const tellorValue = await tellorPlayground.values(queryId, tellorDataTimestamp);
        const formattedTellorValue = abiCoder.decode(['uint256','uint256'], tellorValue)
        expect(tellorDataTimestamp).to.eq(lastBlockTimestamp)
        expect(formattedTellorValue[0]).to.eq(finalReferenceValue)
        expect(formattedTellorValue[1]).to.eq(collateralValueUSD)

    })
    
    it('Should set a reported Tellor value as the final reference value in DIVA Protocol', async () => {
        // ---------
        // Arrange: Confirm that finalRereferenceValue and statusFinalReferenceValue are not yet set and submit values to tellorPlayground 
        // ---------
        expect(poolParams.finalReferenceValue).to.eq(0)
        expect(poolParams.statusFinalReferenceValue).to.eq(0)          
        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseEther('42000');
        collateralValueUSD = parseEther('1.14');
        oracleValue = abiCoder.encode(['uint256','uint256'],[finalReferenceValue, collateralValueUSD])
        // Submit value to Tellor playground contract
        await tellorPlayground.submitValue(queryId, oracleValue, 0, queryData) 
        
        // ---------
        // Act: Call setFinalReferenceValue function inside DIVAOracleTellor contract after exactly minPeriodUndisputed period has passed 
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed
        await setNextTimestamp(ethers.provider, nextBlockTimestamp)
        await divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)
        
        // ---------
        // Assert: finalReferenceValue and statusFinalReferenceValue are updated accordingly in DIVA Protocol
        // ---------
        poolParams = await diva.getPoolParameters(latestPoolId)
        expect(poolParams.finalReferenceValue).to.eq(finalReferenceValue)
        expect(poolParams.statusFinalReferenceValue).to.eq(3) // 3 = Confirmed
    });

    // ---------
    // Reverts
    // ---------
    it('Should revert if called before minPeriodUndisputed', async () => {
        // ---------
        // Arrange: Confirm that finalRereferenceValue and statusFinalReferenceValue are not yet set and submit values to tellorPlayground 
        // ---------
        expect(poolParams.finalReferenceValue).to.eq(0)
        expect(poolParams.statusFinalReferenceValue).to.eq(0)          
        // Prepare value submission to tellorPlayground
        finalReferenceValue = parseEther('42000');
        collateralValueUSD = parseEther('1.14');
        oracleValue = abiCoder.encode(['uint256','uint256'],[finalReferenceValue, collateralValueUSD])
        // Submit value to Tellor playground contract
        await tellorPlayground.submitValue(queryId, oracleValue, 0, queryData) 
        
        // ---------
        // Act & Assert: Call setFinalReferenceValue function inside DIVAOracleTellor contract shortly after minPeriodUndisputed period has passed 
        // ---------
        nextBlockTimestamp = (await getLastTimestamp()) + minPeriodUndisputed - 1
        await setNextTimestamp(ethers.provider, nextBlockTimestamp)
        await expect(divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)).to.be.revertedWith("DIVAOracleTellor: must wait _minPeriodUndisputed before calling this function")
    })

    it('Should revert if no value was reported yet', async () => {
        // ---------
        // Arrange: Confirm that no value has been reported yet 
        // ---------
        expect(await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0)).to.eq(0)

        // ---------
        // Act & Assert: Confirm that setFinalReferenceValue function will revert if called when no value has been reported yet
        // ---------
        await expect(divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)).to.be.revertedWith("DIVAOracleTellor: no oracle submission")

    })

    it('Should revert if a value has been reported prior to expiryTime only', async () => {
        // ---------
        // Arrange: Create a non-expired pool and submit one value prior to expiration 
        // ---------
        expiryTimeInFuture = await getLastTimestamp() + 7200
        await diva.createContingentPool(
          [
            referenceAsset,                             // reference asset
            expiryTimeInFuture,                         // expiryTime
            parseEther("40000"),                        // floor
            parseEther("43000"),                        // inflection
            parseEther("46000"),                        // cap
            parseUnits("100", collateralTokenDecimals), // collateral balance short
            parseUnits("100", collateralTokenDecimals), // collateral balance long              
            parseEther("200"),                          // supplyPositionToken
            erc20.address,                              // collateral token
            divaOracleTellor.address,                   // data provider
            0                                           // capacity
          ]
        );
        latestPoolId = await diva.getLatestPoolId()
        poolParams = await diva.getPoolParameters(latestPoolId)

        // Prepare value submission to tellorPlayground
        queryDataArgs = abiCoder.encode(['uint256'], [latestPoolId])  // Re-construct as latestPoolId changed in this test
        queryData = abiCoder.encode(['string','bytes'], ['DIVAProtocolPolygon', queryDataArgs])
        queryId = ethers.utils.keccak256(queryData)
        finalReferenceValue = parseEther('42000');
        collateralValueUSD = parseEther('1.14');
        oracleValue = abiCoder.encode(['uint256','uint256'],[finalReferenceValue, collateralValueUSD])
        
        // Submit value to Tellor playground contract
        await tellorPlayground.submitValue(queryId, oracleValue, 0, queryData) 
        
        // Confirm that timestamp of reported value is non-zero and smaller than expiryTime
        expect(await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0)).not.eq(0)
        expect(await tellorPlayground.getTimestampbyQueryIdandIndex(queryId, 0)).to.be.lt(poolParams.expiryTime)

        // ---------
        // Act & Assert: Confirm that setFinalReferenceValue function will revert if the only value reported is before expiryTime
        // ---------
        await expect(divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)).to.be.revertedWith("DIVAOracleTellor: no oracle submission after expiry time")
    })

    it('Should take the second value if the first one was submitted before expiryTime and the second one afterwards', async () => {
        // ---------
        // Arrange: Create a contingent pool with expiry time in the future, prepare the submission to tellorPlayground
        // and submit two values, one before and one after expiration
        // ---------
        expiryTimeInFuture = await getLastTimestamp() + 7200
        await diva.createContingentPool(
          [
            referenceAsset,                             // reference asset
            expiryTimeInFuture,                         // expiryTime
            parseEther("40000"),                        // floor
            parseEther("43000"),                        // inflection
            parseEther("46000"),                        // cap
            parseUnits("100", collateralTokenDecimals), // collateral balance short
            parseUnits("100", collateralTokenDecimals), // collateral balance long              
            parseEther("200"),                          // supplyPositionToken
            erc20.address,                              // collateral token
            divaOracleTellor.address,                   // data provider
            0                                           // capacity
          ]
        );
        latestPoolId = await diva.getLatestPoolId()
        poolParams = await diva.getPoolParameters(latestPoolId)

        // Prepare value submission to tellorPlayground
        queryDataArgs = abiCoder.encode(['uint256'], [latestPoolId])  // Re-construct as latestPoolId changed in this test
        queryData = abiCoder.encode(['string','bytes'], ['DIVAProtocolPolygon', queryDataArgs])
        queryId = ethers.utils.keccak256(queryData)

        // First reporter submission prior to expiration 
        finalReferenceValue1 = parseEther('42000');
        collateralValueUSD1 = parseEther('1.14');
        oracleValue1 = abiCoder.encode(['uint256','uint256'],[finalReferenceValue1, collateralValueUSD1])
        nextBlockTimestamp = poolParams.expiryTime.sub(1)
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber())
        await tellorPlayground.submitValue(queryId, oracleValue1, 0, queryData) 

        // Second reporter submission after expiration 
        finalReferenceValue2 = parseEther('42500');
        collateralValueUSD2 = parseEther('1.15');
        oracleValue2 = abiCoder.encode(['uint256','uint256'],[finalReferenceValue2, collateralValueUSD2])
        nextBlockTimestamp = poolParams.expiryTime.add(1)
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber())
        await tellorPlayground.submitValue(queryId, oracleValue2, 0, queryData) 

        // ---------
        // Act: Call setFinalReferenceValue function inside DIVAOracleTellor contract after minPeriodUndisputed has passed
        // ---------
        nextBlockTimestamp = poolParams.expiryTime.add(minPeriodUndisputed).add(10) // has to be minPeriodDisputed after the time of the second submission (assumed to be 1 second after expiration)
        await setNextTimestamp(ethers.provider, nextBlockTimestamp.toNumber())
        await divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)
      
        // ---------
        // Assert: Confirm that the second value was set as the final 
        // ---------
        poolParams = await diva.getPoolParameters(latestPoolId)
        expect(await poolParams.statusFinalReferenceValue).to.eq(3)
        expect(await poolParams.finalReferenceValue).to.eq(parseEther('42500'))
    })

    it('...', async () => {
        // ---------
        // Arrange: ...
        // ---------
        // ...
        
        // ---------
        // Act: ...
        // ---------
        // ...

        // ---------
        // Assert: ...
        // ---------
        // ...
    })

    it('...', async () => {
        // ---------
        // Arrange: ...
        // ---------
        // ...
        
        // ---------
        // Act: ...
        // ---------
        // ...

        // ---------
        // Assert: ...
        // ---------
        // ...
    })

    it('...', async () => {
        // ---------
        // Arrange: ...
        // ---------
        // ...
        
        // ---------
        // Act: ...
        // ---------
        // ...

        // ---------
        // Assert: ...
        // ---------
        // ...
    })
    
    // describe('transferFeeClaim', () => {
    //   it('Should transfer __all__ the fee claim to the excessFeeRecipientAddress', async () => {
    //     let claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
    //     let claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
    //     expect(claimsDIVAOracleTellor).to.eq(0)
    //     expect(claimsExcessFeeRecipient).to.eq(0)

    //     await tellorPlayground.submitValue(queryId, oracleValue, 0, queryData)
    //     await advanceTime(7200) // 2 hours
    //     await divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)
    //     claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
    //     claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
    //     expect(claimsDIVAOracleTellor).to.eq(settlementFeeAmount);
    //     expect(claimsExcessFeeRecipient).to.eq(0);

    //     await divaOracleTellor.transferFeeClaim(divaAddress, erc20.address, claimsDIVAOracleTellor)
    //     claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
    //     claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
    //     expect(claimsDIVAOracleTellor).to.eq(0);
    //     expect(claimsExcessFeeRecipient).to.eq(settlementFeeAmount);
    //   });

    //   it('Should transfer a __partial__ fee claim to the excessFeeRecipientAddress', async () => {
    //     let claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
    //     let claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
    //     expect(claimsDIVAOracleTellor).to.eq(0)
    //     expect(claimsExcessFeeRecipient).to.eq(0)

    //     await tellorPlayground.submitValue(queryId, oracleValue, 0, queryData)
    //     await advanceTime(7200) // 2 hours
    //     await divaOracleTellor.setFinalReferenceValue(divaAddress, latestPoolId)
    //     claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)

    //     await divaOracleTellor.transferFeeClaim(divaAddress, erc20.address, claimsDIVAOracleTellor.sub(1))
    //     claimsDIVAOracleTellor = await diva.getClaims(erc20.address, divaOracleTellor.address)
    //     claimsExcessFeeRecipient = await diva.getClaims(erc20.address, excessFeeRecipient.address)
    //     expect(claimsDIVAOracleTellor).to.eq(1);
    //     expect(claimsExcessFeeRecipient).to.eq(settlementFeeAmount.sub(1));
    //   });
    // });

  });
});
