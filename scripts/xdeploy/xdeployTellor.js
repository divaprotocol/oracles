/**
 * Script to deploy the DIVAOracleTellor constract on multiple EVM chains with
 * a deterministic address. This script makes use of the xdeployer plug-in:
 * https://www.npmjs.com/package/xdeployer
 * To better understand the steps involved, it is recommended to
 * get familiar with the deployment process on a single chain (see `deployTellor.js`)
 *
 * PREPARATION: In order to run the script successfully, a few preparatory steps are necessary:
 * - Copy `xdeploy-config.example.js` and rename it to `xdeploy-config.js`. This file is required as
 * it represents part of the xdeployer configuration.
 * - Specify the chain names that you want to deploy under `XDEPLOY_CHAINS` in `../../utils/constants`.
 * - Make sure that the RPC endpoints for the corresponding chains are set in the `.env` file and
 * follow the pattern `RPC_URL_*` where `*` is to be replaced with the network name in upper case.
 * - Make sure that the `SALT`, which is specified in the `.env`, hasn't been used yet.
 * If you have already used it, you will be notified in the deployment failure message.
 *
 * Run: `yarn xdeploy:divaTellor`
 */
const { parseEther } = require("ethers/lib/utils");

const {
  generateXdeployConfig,
  execCommand,
  checkMinPeriodUndisputed,
  writeFile,
} = require("../../utils/utils");
const {
  DIVA_ADDRESS,
  XDEPLOY_CHAINS,
  TELLOR_VERSION,
  TELLOR_ADDRESS,
  TELLOR_PLAYGROUND_ADDRESS,
} = require("../../utils/constants");

// Load relevant variables from `.env` file
const EXCESS_FEE_RECIPIENT = process.env.EXCESS_FEE_RECIPIENT || "";
const MIN_PERIOD_UNDISPUTED = process.env.MIN_PERIOD_UNDISPUTED || "";
const MAX_FEE_AMOUNT_USD = process.env.MAX_FEE_AMOUNT_USD || "";

const main = async () => {
  // INPUT: tellor version
  const tellorVersion = TELLOR_VERSION.ACTUAL;

  // Confirm that the array containing the list of chains to deploy on is not empty.
  if (!XDEPLOY_CHAINS.length) {
    throw new Error("The length of xdeploy chains is zero");
  }

  // Choose a default chain to run commands against (doesn't really matter which one to use).
  const defaultChain = XDEPLOY_CHAINS[0];

  let tellorAddress;
  if (tellorVersion == TELLOR_VERSION.PLAYGROUND) {
    tellorAddress = TELLOR_PLAYGROUND_ADDRESS[defaultChain];
  } else if (tellorVersion == TELLOR_VERSION.ACTUAL) {
    tellorAddress = TELLOR_ADDRESS[defaultChain];
  } else {
    throw Error("Invalid value for tellorVersion. Set to PLAYGROUND or ACTUAL");
  }

  const divaAddress = DIVA_ADDRESS[defaultChain];
  const minPeriodUndisputed = Number(MIN_PERIOD_UNDISPUTED); // IMPORTANT to set correctly!; input in seconds
  checkMinPeriodUndisputed(minPeriodUndisputed);
  const maxFeeAmountUSD = parseEther(MAX_FEE_AMOUNT_USD).toString();

  // Generate the content of the xdeploy-args.js file used for the deployment of
  // the `DIVAOracleTellor` contract
  const divaOracleTellorArgs = `
    module.exports = [
      "${tellorAddress}",
      "${EXCESS_FEE_RECIPIENT}",
      "${minPeriodUndisputed}",
      "${maxFeeAmountUSD}",
      "${divaAddress}"
    ];
  `;
  writeFile("xdeploy-args.js", divaOracleTellorArgs);

  // Deploy `DIVAOracleTellor` contract with constructor args stored in `xdeploy-args.js` (see step above)
  console.log(
    "<<<<<<<<<<<< Start deploy DIVAOracleTellor contract <<<<<<<<<<<<"
  );
  generateXdeployConfig("DIVAOracleTellor");
  if (!(await execCommand("npx hardhat xdeploy"))) {
    throw new Error("Failed to deploy DIVAOracleTellor contract");
  }
  console.log(
    ">>>>>>>>>> DIVAOracleTellor contract was successfully deployed >>>>>>>>>>"
  );
  console.log();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
