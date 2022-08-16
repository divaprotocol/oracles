/**
 * Script to create a contingent pool on DIVA Protocol
 * Run: `yarn hardhat run scripts/createContingentPool.js --network ropsten`
 * Replace ropsten with any other network that is listed under addresses in constants.js
 */

 const { ethers } = require('hardhat');
 const ERC20_ABI = require('../contracts/abi/ERC20.json');
 const DIVA_ABI = require('../contracts/abi/DIVA.json');
 const { parseEther, parseUnits, formatUnits } = require('@ethersproject/units')
 const { addresses, divaTellorOracleAddresses } = require('../utils/constants')
 const { getExpiryInSeconds } = require('../test/utils.js');
 
 
 async function main() {
 
   // Set network, collateral token and data provider address
   const network = "ropsten" 
   const erc20CollateralTokenAddress = "0x134e62bd2ee247d4186A1fdbaA9e076cb26c1355" // dUSD
   const dataProviderAddress = divaTellorOracleAddresses[network]
 
   // Get signers
   const [acc1, acc2, acc3] = await ethers.getSigners();
   const user = acc1;
   console.log("Pool creator address: " + user.address)
 
   // Connect to ERC20 token that will be used as collateral when creating a contingent pool
   const erc20Contract = await ethers.getContractAt(ERC20_ABI, erc20CollateralTokenAddress)
   const decimals = await erc20Contract.decimals();
   console.log("ERC20 collateral token address: " + erc20CollateralTokenAddress)
   console.log("Collateral token decimals: " + decimals);
   
   // INPUTS for `createContingentPool` function
   const referenceAsset = "BTC/USD" // "BTC/USD" 
   const expiryTime = getExpiryInSeconds(60) // 10 means expiry in 10 seconds from now
   const floor = parseEther("20000") 
   const inflection = parseEther("20000")
   const cap = parseEther("45000")
   const gradient = parseUnits("0.7") 
   const collateralAmount = parseUnits("100", decimals)
   const collateralToken = erc20CollateralTokenAddress 
   const dataProvider = dataProviderAddress
   const capacity = parseUnits("200", decimals)
 
   // Input checks
   if (referenceAsset.length === 0) {
     console.log("Reference asset cannot be an empty string");
     return;
   }
   
   if (!(floor.lte(inflection) && inflection.lte(cap))) {
     console.log("Ensure that floor <= inflection <= cap");
     return;
   }
 
   if (collateralToken === ethers.AddressZero || dataProvider === ethers.AddressZero) {
     console.log("collateralToken/dataProvider cannot be zero address");
     return;
   }
  
   if (capacity.gt(0)) {
     if (capacity.lt(collateralAmount)) {
       console.log("Capacity cannot be smaller than collateral amount");
       return;
     }
   }
 
   if (decimals > 18) {
     console.log("Collateral token cannot have more than 18 decimals");
     return;
   }
 
   if (decimals < 3) {
     console.log("Collateral token cannot have less than 3 decimals");
     return;
   }
 
   // Check user's ERC20 token balance
   const balance = await erc20Contract.balanceOf(user.address)
   console.log("ERC20 token balance: " + formatUnits(balance, decimals))
   if (balance.lt(collateralAmount)) {
     throw "Insufficient collateral tokens in wallet"
   }
   
   // Connect to DIVA contract
   const diva = await ethers.getContractAt(DIVA_ABI, addresses[network]);
   console.log("DIVA address: ", diva.address);
 
   // Set allowance for DIVA contract
   const approveTx = await erc20Contract.connect(user).approve(diva.address, collateralAmount);
   await approveTx.wait();
 
   // Check that allowance was set
   const allowance = await erc20Contract.allowance(user.address, diva.address)
   console.log("Approved amount: " + formatUnits(await allowance, decimals))
 
   // Create contingent pool
   const tx = await diva.connect(user).createContingentPool([
     referenceAsset, 
     expiryTime, 
     floor,
     inflection, 
     cap,
     gradient, 
     collateralAmount,  
     collateralToken, 
     dataProvider,
     capacity
   ]); 
   await tx.wait();
 
   // Get pool Id
   const poolId = await diva.getLatestPoolId();
   console.log("poolId of new pool created: " + poolId);
 
   // Get pool parameters
   const poolParams = await diva.getPoolParameters(poolId);
 
   // Get instances of short and long position token
   const shortTokenInstance = await ethers.getContractAt(ERC20_ABI, poolParams.shortToken)
   const longTokenInstance = await ethers.getContractAt(ERC20_ABI, poolParams.longToken)
   console.log("Short token address: " + poolParams.shortToken)
   console.log("Long token address: " + poolParams.longToken)
   console.log("Supply short token: " + await shortTokenInstance.totalSupply())
   console.log("Supply long token: " + await longTokenInstance.totalSupply())
   
 }
 
 main()
   .then(() => process.exit(0))
   .catch((error) => {
     console.error(error);
     process.exit(1);
   });
  