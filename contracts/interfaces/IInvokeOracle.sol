// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IInvokeOracle {
    function requestData(address _caller) external returns (bytes32 requestId);

    function showPrice() external view returns (uint256);
}
