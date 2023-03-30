// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IInvokeOracle {
    function requestData(address _caller) external returns (bytes32 requestId);

    function depositPLI(uint256 _amount) external returns (bool isSuccess);

    function showPrice(bytes32 _reqid) external view returns (uint256 price);

    function plidbs(
        address _depositor
    ) external view returns (address depositor, uint256 totalcredits);
}
