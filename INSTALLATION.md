# How to get started

Scripts:

1. `yarn` to install dependencies
1. `yarn c` to compile contracts
1. `yarn t` to run tests (includes compilation of contracts). Example command for executing a specific test file, here `test/DIVAOracleTellor.test.js`: `yarn hardhat test test/DIVAOracleTellor.test.js`

If your installed `node` version is 17 or higher, you may need to downgrade it to version 16.13.0, for instance, in order to ensure proper functionality. Below an example to downgrade the version using [`nvm`](https://github.com/nvm-sh/nvm):

1. `node --version` to check the node version
2. `nvm use 16.13.0` to downgrade the node version