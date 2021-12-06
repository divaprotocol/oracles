// SPDX-License-Identifier: MIT
//Old comments
//need mapping between option and position tokens !

pragma solidity ^0.8.0;

/**
 * @title Interface for the DIVAFactory contract.
 */
interface IDIVA {

    // Values for status of settlement process
    enum status{Open,
                Submitted,
                Challenged,
                Confirmed}

    /** 
     * @notice Function to issue ERC20 long and short position tokens. Short/long position tokens are sent to the creator of the option.
     * Provided collateral is kept in the contract until expiration. For example usage of this function, see unit tests file.
     * @dev Only ERC20 tokens are accepted as collateral. If you want to use ETH as collateral, use the wrapped version of it (WETH). 
     * Collateral token should not have more than 18 decimals. Prior to execution of the issueOption function 
     * allow the contract to spend the collateral, i.e., execute the approve function of the ERC20 collateral token
     * @param payoffParams Parameters that define the shape of the position token payoff curve, to be entered in the following order 
     * (pooled in an array to avoid stack too deep type of errors):
     * 
     * strike (payoffParams[0]): The underlying asset value at which pool rebalancings are triggered.
     * cap (payoffParams[1]): The maximum underlying asset value that the position tokens can track.
     * floor (payoffParams[2]): The minimum underlying asset value that the position tokens can track.
     * collateralBalanceShort (payoffParams[3]): Collateral token amount allocated to the short pool. 
     * collateralBalanceLong (payoffParams[4]): Collateral token amount allocated to the long pool. 
     * expiryDate (payoffParams[5]): Expiry date of the derivative contract expressed in Unix time stamp format (i.e. seconds since the epoch).
     * supplyShort (payoffParams[6]): Number of short position tokens.
     * supplyLong (payoffParams[7]): Number of long position tokens.
     * 
     * @param _referenceAsset The name of the underlying asset (e.g., Tesla-USD or ETHGasPrice-GWEI)
     * @param _collateralToken ERC20 collateral token address 
     * @param _dataFeedProvider Ethereum (EOA or smart contract) that will provide the value of the underlying at contract expiration. 
     * @return A boolean value indicating whether the operation succeeded
     */    
    function issueOption(uint256[] calldata payoffParams,
                         string calldata _referenceAsset,
                         address _collateralToken,
                         address _dataFeedProvider
                         ) external returns(bool);    

/*
    function setRedemptionFee(uint256 _redemptionFee) external returns(bool);

    function setSettlementFee(uint256 _settlementFee) external returns(bool);

    function setFinalPriceSubmissionPeriod(uint256 _finalPriceSubmissionPeriod) external returns(bool);

    function setFinalPriceChallengePeriod(uint256 _finalPriceChallengePeriod) external returns(bool);

    function setFinalPriceReviewPeriod(uint256 _finalPriceReviewPeriod) external returns(bool);
*/
    function addLiquidity(uint256[] calldata params) external returns(bool);

    function removeLiquidity(uint256[] calldata params) external returns(bool);


    /**
     * @dev 
     * @param _optionId Option Id for which the submitted settlement value is challenged
     * @param _proposedFinalPrice Submit a proposal for a new settlement value
     */
    function challengeFinalPriceByOptionId(uint256 _optionId, uint256 _proposedFinalPrice) external returns(bool);

    /**
     * @dev Throws if called by any account other than the dataFeedProvider specified in the contract parameters.
     * Current implementation allows for positive settlement values only. For negative metrices, use the negated version
     * as the underlying (e.g., -LIBOR)
     * @param _optionId The option Id for which the settlement value is submitted 
     * @param _finalReferencePrice Proposed settlement value by the data feed provider 
     * @param _allowChallenge Toggle to enable/disable the challenge functionality. If 0, then the submitted price
     * will immediately go into confirmed status, challenge will not be possible. This parameter was introduced
     * to allow automated oracles (e.g., Uniswap v3 or Chainlink) to settle without dispute
     */ 
    function setFinalReferenceValueById(uint256 _optionId, uint256 _finalReferencePrice, bool _allowChallenge) external returns(bool); 

    //function setRedemptionAmount(uint256 _optionId, uint256 _finalReferencePrice) external returns(bool);

    function redeemDirectionToken(address _directionToken, uint256 amount) external returns(bool);

    function getExpiryParametersById(uint256 _optionId) external view returns (uint256, status, uint256, uint256, uint256, address, uint256, uint256);

    function getExpiryParametersByAddress(address _directionToken) external view returns (uint256, status, uint256, uint256, uint256, address, uint256, uint256);

    function getOptionParametersById(uint256 _optionId) external view returns (string memory, uint256, uint256, uint256, uint256,
                                                                                uint256, uint256, address, uint256, uint256, 
                                                                                address, address);

    function getExpiryDateById(uint256 _optionId) external view returns (uint256);

    function getOptionParametersByAddress(address _directionToken) external view returns (string memory, uint256, uint256, uint256, uint256,
                                                                                uint256, uint256, address, uint256, uint256, 
                                                                                address, address);     

    /**
     * @notice Emitted when a new derivatives contract is created via the DIVA factory contract
     * @param optionId The Id of the newly created derivatives contract
     * @param shortToken The address of the newly issued short position tokens
     * @param longToken The address of the newly issued long position tokens                                                           
     */
     event OptionIssued(uint256 indexed optionId,
                       address indexed shortToken, 
                       address indexed longToken);
    
    /**
     * @notice Emitted when a collateral is added to an existing derivatives contract
     * @param optionId The Id of an existing derivatives contract
     * @param _from The address of the liquidity provider
     * @param _collateralAmount The collateral amount                                                           
     */
    event LiquidityAdded(uint256 indexed optionId, address indexed _from, uint256 _collateralAmount);

    /**
     * @notice Emitted when collateral is removed from an existing derivatives contract by providing an equivalent amount 
     * of short and long position tokens
     * @param optionId The Id of an existing derivatives contract
     * @param _amountLongTokens Number of long position tokens burned
     * @param _amountShortTokens Number of short position tokens burned                                                            
     */
    event LiquidityRemoved(uint256 indexed optionId, address _from, uint256 _amountLongTokens, uint256 _amountShortTokens);
    
    /**
     * @notice Emitted when the status of the settlement process changes
     * @param settlementStatus The status of the settlement (Open, Submitted, Challenged, Confirmed)
     * @param dataFeedProvider Ethereum address of the settlement value provider
     * @param optionId The Id of the derivatives contract in settlement
     * @param proposedFinalPrice Final price proposed by the data feed provider                                                            
     */
    event StatusChanged(status indexed settlementStatus, address indexed dataFeedProvider, uint256 indexed optionId, uint256 proposedFinalPrice);

    
  }