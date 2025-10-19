// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path) 
        external view returns (uint[] memory amounts);
}

/**
 * @title ArbitrageBot
 * @dev Smart contract para executar arbitragem automatizada entre DEXs
 * @notice Permite operações seguras de arbitragem cross-DEX com proteção contra MEV
 */
contract ArbitrageBot is Ownable, ReentrancyGuard {
    
    // ========== EVENTS ==========
    event ArbitrageExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 profit,
        string buyDex,
        string sellDex
    );
    
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event MinProfitUpdated(uint256 newMinProfit);
    
    // ========== STATE VARIABLES ==========
    
    // Routers dos DEXs suportados
    mapping(string => IUniswapV2Router) public dexRouters;
    
    // Lucro mínimo aceitável (em basis points: 100 = 1%)
    uint256 public minProfitBasisPoints = 50; // 0.5% default
    
    // Controle de pausa de emergência
    bool public paused;
    
    // Slippage máximo permitido (em basis points)
    uint256 public maxSlippageBasisPoints = 200; // 2% default
    
    // ========== CONSTRUCTOR ==========
    
    constructor() Ownable(msg.sender) {
        // Configurar routers principais (Ethereum Mainnet)
        // Uniswap V2
        dexRouters["uniswap"] = IUniswapV2Router(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
        
        // Sushiswap
        dexRouters["sushiswap"] = IUniswapV2Router(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    }
    
    // ========== MODIFIERS ==========
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    // ========== EXTERNAL FUNCTIONS ==========
    
    /**
     * @dev Executa arbitragem entre dois DEXs
     * @param tokenIn Endereço do token de entrada
     * @param tokenOut Endereço do token de saída
     * @param amountIn Quantidade de tokens de entrada
     * @param buyDexName Nome da DEX para comprar
     * @param sellDexName Nome da DEX para vender
     * @param minProfit Lucro mínimo esperado em tokens
     */
    function executeArbitrage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        string memory buyDexName,
        string memory sellDexName,
        uint256 minProfit
    ) external onlyOwner whenNotPaused nonReentrant returns (uint256 profit) {
        require(amountIn > 0, "Amount must be greater than 0");
        require(tokenIn != tokenOut, "Tokens must be different");
        
        IUniswapV2Router buyDex = dexRouters[buyDexName];
        IUniswapV2Router sellDex = dexRouters[sellDexName];
        
        require(address(buyDex) != address(0), "Invalid buy DEX");
        require(address(sellDex) != address(0), "Invalid sell DEX");
        
        // 1. Aprovar tokens para a DEX de compra
        IERC20(tokenIn).approve(address(buyDex), amountIn);
        
        // 2. Preparar path para compra
        address[] memory buyPath = new address[](2);
        buyPath[0] = tokenIn;
        buyPath[1] = tokenOut;
        
        // 3. Calcular amount out mínimo com slippage
        uint256[] memory buyAmounts = buyDex.getAmountsOut(amountIn, buyPath);
        uint256 expectedBuyAmount = buyAmounts[1];
        uint256 minBuyAmount = expectedBuyAmount * (10000 - maxSlippageBasisPoints) / 10000;
        
        // 4. Executar compra na primeira DEX
        uint256[] memory boughtAmounts = buyDex.swapExactTokensForTokens(
            amountIn,
            minBuyAmount,
            buyPath,
            address(this),
            block.timestamp + 300 // 5 minutos de deadline
        );
        
        uint256 boughtAmount = boughtAmounts[1];
        
        // 5. Aprovar tokens para a DEX de venda
        IERC20(tokenOut).approve(address(sellDex), boughtAmount);
        
        // 6. Preparar path para venda
        address[] memory sellPath = new address[](2);
        sellPath[0] = tokenOut;
        sellPath[1] = tokenIn;
        
        // 7. Calcular amount out mínimo para venda
        uint256[] memory sellAmounts = sellDex.getAmountsOut(boughtAmount, sellPath);
        uint256 expectedSellAmount = sellAmounts[1];
        uint256 minSellAmount = expectedSellAmount * (10000 - maxSlippageBasisPoints) / 10000;
        
        // 8. Executar venda na segunda DEX
        uint256[] memory soldAmounts = sellDex.swapExactTokensForTokens(
            boughtAmount,
            minSellAmount,
            sellPath,
            address(this),
            block.timestamp + 300
        );
        
        uint256 finalAmount = soldAmounts[1];
        
        // 9. Calcular lucro
        require(finalAmount > amountIn, "No profit - trade would result in loss");
        profit = finalAmount - amountIn;
        
        // 10. Verificar se lucro atende ao mínimo
        uint256 minRequiredProfit = amountIn * minProfitBasisPoints / 10000;
        require(profit >= minRequiredProfit, "Profit below minimum threshold");
        require(profit >= minProfit, "Profit below user specified minimum");
        
        emit ArbitrageExecuted(
            tokenIn,
            tokenOut,
            amountIn,
            profit,
            buyDexName,
            sellDexName
        );
        
        return profit;
    }
    
    /**
     * @dev Simula arbitragem sem executar (view function)
     * @param tokenIn Endereço do token de entrada
     * @param tokenOut Endereço do token de saída
     * @param amountIn Quantidade de tokens de entrada
     * @param buyDexName Nome da DEX para comprar
     * @param sellDexName Nome da DEX para vender
     * @return expectedProfit Lucro esperado
     * @return profitable Se a operação seria lucrativa
     */
    function simulateArbitrage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        string memory buyDexName,
        string memory sellDexName
    ) external view returns (uint256 expectedProfit, bool profitable) {
        IUniswapV2Router buyDex = dexRouters[buyDexName];
        IUniswapV2Router sellDex = dexRouters[sellDexName];
        
        require(address(buyDex) != address(0), "Invalid buy DEX");
        require(address(sellDex) != address(0), "Invalid sell DEX");
        
        // Path para compra
        address[] memory buyPath = new address[](2);
        buyPath[0] = tokenIn;
        buyPath[1] = tokenOut;
        
        // Simular compra
        uint256[] memory buyAmounts = buyDex.getAmountsOut(amountIn, buyPath);
        uint256 boughtAmount = buyAmounts[1];
        
        // Path para venda
        address[] memory sellPath = new address[](2);
        sellPath[0] = tokenOut;
        sellPath[1] = tokenIn;
        
        // Simular venda
        uint256[] memory sellAmounts = sellDex.getAmountsOut(boughtAmount, sellPath);
        uint256 finalAmount = sellAmounts[1];
        
        if (finalAmount > amountIn) {
            expectedProfit = finalAmount - amountIn;
            uint256 minRequiredProfit = amountIn * minProfitBasisPoints / 10000;
            profitable = expectedProfit >= minRequiredProfit;
        } else {
            expectedProfit = 0;
            profitable = false;
        }
        
        return (expectedProfit, profitable);
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @dev Adiciona ou atualiza router de uma DEX
     */
    function setDexRouter(string memory dexName, address routerAddress) external onlyOwner {
        require(routerAddress != address(0), "Invalid router address");
        dexRouters[dexName] = IUniswapV2Router(routerAddress);
    }
    
    /**
     * @dev Atualiza o lucro mínimo aceitável
     */
    function setMinProfitBasisPoints(uint256 newMinProfit) external onlyOwner {
        require(newMinProfit <= 1000, "Min profit too high (max 10%)");
        minProfitBasisPoints = newMinProfit;
        emit MinProfitUpdated(newMinProfit);
    }
    
    /**
     * @dev Atualiza o slippage máximo permitido
     */
    function setMaxSlippageBasisPoints(uint256 newSlippage) external onlyOwner {
        require(newSlippage <= 500, "Slippage too high (max 5%)");
        maxSlippageBasisPoints = newSlippage;
    }
    
    /**
     * @dev Pausa ou despausa o contrato
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    /**
     * @dev Saca tokens em caso de emergência
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            // Withdraw ETH
            payable(owner()).transfer(amount);
        } else {
            // Withdraw ERC20
            IERC20(token).transfer(owner(), amount);
        }
        emit EmergencyWithdraw(token, amount);
    }
    
    /**
     * @dev Permite o contrato receber ETH
     */
    receive() external payable {}
}
