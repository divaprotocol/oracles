/**
 * Script to request the final reference value on DIVAGoplugin contract.
 * Run `yarn divaGoplugin:requestFinalReferenceValue`
 */

const { ethers, network } = require("hardhat");

const DIVA_ABI = require("../../contracts/abi/DIVA.json");
const DATA_FEED_ABI = require("../../contracts/abi/InternalAbi.json");

const {
  DIVA_ADDRESS,
  PLI_ADDRESS,
  DIVA_GOPLUGIN_ADDRESS,
} = require("../../utils/constants");
const { getCurrentTimestampInSeconds } = require("../../utils/utils");

async function main() {
  // INPUT: id of existing pool
  const poolId = 7;

  // Get signer of operator
  const [user] = await ethers.getSigners();

  // Connect to DIVAGoplugin contract
  const divaGoplugin = await ethers.getContractAt(
    "DIVAGoplugin",
    DIVA_GOPLUGIN_ADDRESS[network.name]
  );

  // Connect to PLI token contract
  const pliToken = await ethers.getContractAt(
    "MockERC20",
    PLI_ADDRESS[network.name]
  );

  // Connect to deployed DIVA contract
  const diva = await ethers.getContractAt(
    DIVA_ABI,
    DIVA_ADDRESS[network.name]
  );

  // Get pool parameters
  const poolParams = await diva.getPoolParameters(poolId);
  // Check that the pool is already expired or not
  if (poolParams.expiryTime.gt(getCurrentTimestampInSeconds())) {
    throw new Error("Pool not expired yet.");
  }

  // Check that the final reference value is already requested or not
  if ((await divaGoplugin.getLastRequestedTimestamp(poolId)).gt(0)) {
    throw new Error("Final reference value is already requested.");
  }

  // Connect to data feed contract
  const dataFeed = await ethers.getContractAt(
    DATA_FEED_ABI,
    poolParams.referenceAsset
  );

  // Get minimum deposit amount
  const minDepositAmount = await divaGoplugin.getMinDepositAmount();
  // Get already deposited amount on data feed contract
  const depositedAmount = (await dataFeed.plidbs(divaGoplugin.address))
    .totalcredits;
  if (minDepositAmount.gt(depositedAmount)) {
    const diff = minDepositAmount.sub(depositedAmount);
    const pliBalance = await pliToken.balanceOf(divaGoplugin.address);

    if (pliBalance.lt(diff)) {
      if ((await pliToken.balanceOf(user.address)).lt(diff.sub(pliBalance))) {
        throw new Error("Not enough PLI tokne on user.");
      }
      // Approve PLI token to DIVAGoplugin contract
      const tx = await pliToken.approve(
        divaGoplugin.address,
        diff.sub(pliBalance)
      );
    }
  }

  // Request final reference value
  const tx = await divaGoplugin.requestFinalReferenceValue(poolId);
  const receipt = await tx.wait();

  // Get `FinalReferenceValueRequested` event
  const finalReferenceValueRequestedEvent = receipt.events.find(
    (item) => item.event === "FinalReferenceValueRequested"
  );
  console.log(
    "finalReferenceValueRequestedEvent: ",
    finalReferenceValueRequestedEvent
  );

  // Log relevant information
  console.log("DIVAGoplugin address: " + divaGoplugin.address);
  console.log("PoolId: ", poolId);
  console.log(
    "Request id: ",
    finalReferenceValueRequestedEvent.args.requestId
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
