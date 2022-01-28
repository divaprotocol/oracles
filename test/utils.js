const ONE_HOUR = 3600

async function advanceTime(time) {
    await network.provider.send("evm_increaseTime", [time])
    await network.provider.send("evm_mine")
}

function getExpiryInSeconds(offsetInSeconds) {
    return Math.floor(Date.now() / 1000 + offsetInSeconds).toString(); // 60*60 = 1h; 60*60*24 = 1d, 60*60*24*365 = 1y
}

exports.ONE_HOUR = ONE_HOUR;
exports.advanceTime = advanceTime;
exports.getExpiryInSeconds = getExpiryInSeconds;
