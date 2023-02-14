/**
 * Script to deploy the DIVA Protocol system on multiple EVM chains with
 * a deterministic address. This script makes use of the xdeployer plug-in:
 * https://www.npmjs.com/package/xdeployer
 * To better understand the steps involved, it is recommended to
 * get familiar with the deployment process on a single chain (see `deploySecondary.ts`)
 *
 * PREPARATION: In order to run the script successfully, a few preparatory steps are necessary:
 * - Copy `xdeploy-config.example.ts` and rename it to `xdeploy-config.ts`. This file is required as
 * it represents part of the xdeployer configuration.
 * - Specify the chain names that you want to deploy under `XDEPLOY_CHAINS` in `../../constants`.
 * - Make sure that the RPC endpoints for the corresponding chains are set in the `.env` file and
 * follow the pattern `RPC_URL_*` where `*` is to be replaced with the network name in upper case.
 * - Make sure that the `SALT`, which is specified in the `.env`, hasn't been used yet.
 * If you have already used it, you will be notified in the deployment failure message.
 *
 * IMPORTANT:
 * - Run main chain deployment first.
 * - Update OWNERSHIP_CONTRACT_MAIN_CHAIN in `.env` file afterwards.
 * - Make sure the main chain is not listed in XDEPLOY_CHAINS, otherwise you will waste money for gas.
 * - Only deploy on chains where the Tellor address is the same. If the Tellor address deviates, run
 * the multi-chain deployment process twice using two different sets of chains.
 *
 * Run: `yarn xdeploy:secondary:diva`
 */
const { parseEther } = require("ethers/lib/utils");

const {
  generateXdeployConfig,
  execCommand,
  checkPeriodMinPeriodUndisputed,
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

const main = async () => {
  // Confirm that the array containing the list of chains to deploy on is not empty.
  if (!XDEPLOY_CHAINS.length) {
    throw new Error("The length of xdeploy chains is zero");
  }

  // Choose a default chain to run commands against (doesn't really matter which one to use).
  const defaultChain = XDEPLOY_CHAINS[0];

  const tellorVersion = TELLOR_VERSION.ACTUAL;
  let tellorAddress;
  if (tellorVersion == TELLOR_VERSION.PLAYGROUND) {
    tellorAddress = TELLOR_PLAYGROUND_ADDRESS[defaultChain];
  } else if (tellorVersion == TELLOR_VERSION.ACTUAL) {
    tellorAddress = TELLOR_ADDRESS[defaultChain];
  } else {
    throw Error("Invalid value for tellorVersion. Set to PLAYGROUND or ACTUAL");
  }

  const periodMinPeriodUndisputed = 10; // IMPORTANT to set correctly!; input in seconds
  // checkPeriodMinPeriodUndisputed(periodMinPeriodUndisputed);
  const maxFeeAmountUSD = parseEther("10").toString(); // $10
  const divaAddress = DIVA_ADDRESS[defaultChain];

  // Generate the content of the xdeploy-args.js file used for the deployment of
  // the `Diamond` contract as part of the xdeployer process
  const diamondArgs = `
    module.exports = [
      "${tellorAddress}",
      "${EXCESS_FEE_RECIPIENT}",
      "${periodMinPeriodUndisputed}",
      "${maxFeeAmountUSD}",
      "${divaAddress}"
    ];
  `;
  writeFile("xdeploy-args.js", diamondArgs);

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
