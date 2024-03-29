/**
 * Script to deploy the DIVAOracleTellor contract on multiple EVM chains with
 * a deterministic address. This script makes use of the xdeployer plug-in:
 * https://www.npmjs.com/package/xdeployer
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
 * IMPORTANT:
 * - Set `EXCESS_DIVA_REWARD_RECIPIENT` in `.env` file to the initial DIVA treasuy address.
 * - Set `tellorVersion` on line 22 of `_generateTellorArgs.js` file to the correct one you want link to.
 * - Set `MAX_DIVA_REWARD_AMOUNT_USD` in `.env` file to an integer with 18 decimals (e.g., $10 = 10000000000000000000)
 *
 * Run: `yarn xdeploy:divaTellor`
 */

const {
  generateXdeployConfig,
  execCommand,
  writeFile,
} = require("../../utils/utils");
const { XDEPLOY_CHAINS } = require("../../utils/constants");

const main = async () => {
  // Confirm that the array containing the list of chains to deploy on is not empty.
  if (!XDEPLOY_CHAINS.length) {
    throw new Error("The length of xdeploy chains is zero");
  }

  // Choose a default chain to run commands against. Doesn't matter which one to use as long
  // as all the chains in the list have the same Tellor protocol address.
  const defaultChain = XDEPLOY_CHAINS[0];

  // Generate the constructor args file `deploy-args.js` for `DIVAOracleTellor` contract required for the xdeployer process.
  console.log(
    "<<<<<<<<<<<< Start generate DIVAOracleTellor constructor arguments <<<<<<<<<<<<"
  );
  if (
    !(await execCommand(
      `npx hardhat run --network ${defaultChain} scripts/xdeploy/_generateTellorArgs.js`
    ))
  ) {
    throw new Error(
      "Failed to generate DIVAOracleTellor constructor arguments"
    );
  }
  console.log(
    ">>>>>>>>>> DIVAOracleTellor constructor arguments were successfully generated >>>>>>>>>>"
  );
  console.log();

  // Deploy `DIVAOracleTellor` contract with constructor args stored in `deploy-args.js` (see step above)
  console.log(
    "<<<<<<<<<<<< Start deploy DIVAOracleTellor contract <<<<<<<<<<<<"
  );
  generateXdeployConfig("DIVAOracleTellor");
  const xdeployOutput = await execCommand("npx hardhat xdeploy");
  if (!xdeployOutput) {
    throw new Error("Failed to deploy DIVAOracleTellor contract");
  }
  console.log(
    ">>>>>>>>>> DIVAOracleTellor contract was successfully deployed >>>>>>>>>>"
  );
  console.log();

  // Get DIVAOracleTellor contract address deployed by xdeployer
  const addressLine = xdeployOutput
    .split("\n")
    .find((line) =>
      line.startsWith(
        "Your deployment parameters will lead to the following contract address"
      )
    );
  const divaTellorOracleAddress = addressLine.substring(77, 119);

  // Verify DIVAOracleTellor contracts deployed by xdeployer
  for (const chainName of XDEPLOY_CHAINS) {
    // Generate the content of the `verify-args.js` file used for the verification of
    // the `DIVAOracleTellor` contract
    const verifyArgs = `
      module.exports = {
        network: "${chainName}",
        address: "${divaTellorOracleAddress}",
      };
    `;
    writeFile("verify-args.js", verifyArgs);

    await execCommand(`npx node scripts/verifyTellor.js`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
