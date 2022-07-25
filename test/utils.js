const ONE_HOUR = 3600;
const TEN_MINS = 600;

async function advanceTime(time) {
  await network.provider.send("evm_increaseTime", [time]);
  await network.provider.send("evm_mine");
}

function getExpiryInSeconds(offsetInSeconds) {
  return Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); // 60*60 = 1h; 60*60*24 = 1d, 60*60*24*365 = 1y
}

async function getLastTimestamp() {
  /**
   * Changed this from ethers.provider.getBlockNumber since if evm_revert is used to return
   * to a snapshot, getBlockNumber will still return the last mined block rather than the
   * block height of the snapshot.
   */
  let currentBlock = await ethers.provider.getBlock("latest");
  return currentBlock.timestamp;
}

async function setNextTimestamp(provider, timestamp) {
  await provider.send("evm_setNextBlockTimestamp", [timestamp]);
}

exports.ONE_HOUR = ONE_HOUR;
exports.TEN_MINS = TEN_MINS;
exports.advanceTime = advanceTime;
exports.getExpiryInSeconds = getExpiryInSeconds;
exports.getLastTimestamp = getLastTimestamp;
exports.setNextTimestamp = setNextTimestamp;
