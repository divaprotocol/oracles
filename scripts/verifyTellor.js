// Script to verify `DIVAOracleTellor` contract following deployment

const { execCommand } = require("../utils/utils");
const deployArgs = require("../deploy-args"); // generated inside `deployTellor.js` file
const verifyArgs = require("../verify-args"); // generated inside `deployTellor.js` file

const main = async () => {
  console.log(
    `<<<<<<<<<<<<<<<<< Start verify DIVAOracleTellor contract on ${verifyArgs.network} network <<<<<<<<<<<<<<<<<<`
  );
  if (
    !(await execCommand(
      `npx hardhat verify ${verifyArgs.address} --contract contracts/DIVAOracleTellor.sol:DIVAOracleTellor --network ${verifyArgs.network} ${deployArgs[0]} ${deployArgs[1]} ${deployArgs[2]} ${deployArgs[3]} ${deployArgs[4]}`
    ))
  ) {
    console.error(
      `>>>>>>>>>>>>>>>> Failed to verify DIVAOracleTellor contract on ${verifyArgs.network} network >>>>>>>>>>>>>>>`
    );
  } else {
    console.log(
      `>>>>>>>>>>> DIVAOracleTellor contract was successfully verified on ${verifyArgs.network} network >>>>>>>>>>>`
    );
  }
  console.log();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
