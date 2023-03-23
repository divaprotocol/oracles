/**
 * Script to request the final reference value on DIVAGoplugin contract.
 * Run `yarn divaGoplugin:requestFinalReferenceValue`
 */

const { ethers, network } = require("hardhat");

const {
  PLI_ADDRESS,
  DIVA_GOPLUGIN_ADDRESS,
  GOPLUGIN_DATA_FEED_ADDRESSES,
} = require("../../utils/constants");
const DATA_FEED_ABI = require("../../contracts/abi/InternalAbi.json");

const DATA_FEED_PAIR = "XDC/USDT";

async function main() {
  // INPUT: id of existing pool
  const poolId = 2;

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

  // Connect to data feed contract
  const dataFeed = await ethers.getContractAt(
    DATA_FEED_ABI,
    GOPLUGIN_DATA_FEED_ADDRESSES[network.name][DATA_FEED_PAIR]
  );

  // Get minimum deposit amount
  const minDepositAmount = await divaGoplugin.getMinDepositAmount();
  // Get already deposited amount on data feed contract
  const depositedAmount = (await dataFeed.plidbs(divaGoplugin.address))
    .totalcredits;
  const diff = minDepositAmount.sub(depositedAmount);
  // Approve PLI token to DIVAGoplugin contract
  await pliToken.approve(divaGoplugin.address, diff);

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
