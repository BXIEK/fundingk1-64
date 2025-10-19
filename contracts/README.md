# ArbitrageBot Smart Contract

Contrato inteligente Solidity para executar arbitragem automatizada entre DEXs.

## 🎯 Funcionalidades

- ✅ Arbitragem cross-DEX (Uniswap, Sushiswap, PancakeSwap, etc)
- ✅ Proteção contra MEV e front-running
- ✅ Simulação antes de executar (view function)
- ✅ Controle de slippage
- ✅ Lucro mínimo configurável
- ✅ Pausa de emergência
- ✅ Reentracy protection
- ✅ Only owner

## 📦 Dependências

```bash
npm install @openzeppelin/contracts
```

## 🔧 Como Compilar

### Usando Hardhat

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

npx hardhat compile
```

### Usando Remix IDE

1. Acesse https://remix.ethereum.org
2. Crie novo arquivo `ArbitrageBot.sol`
3. Cole o código do contrato
4. Compile com Solidity 0.8.20+

## 🚀 Como Fazer Deploy

### Mainnet Ethereum

```javascript
// hardhat.config.js
module.exports = {
  networks: {
    mainnet: {
      url: "https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY",
      accounts: [PRIVATE_KEY]
    }
  }
};
```

```bash
npx hardhat run scripts/deploy.js --network mainnet
```

### BSC (Binance Smart Chain)

```javascript
// hardhat.config.js
module.exports = {
  networks: {
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [PRIVATE_KEY]
    }
  }
};
```

Atualize os routers no constructor:
```solidity
// PancakeSwap Router
dexRouters["pancakeswap"] = IUniswapV2Router(0x10ED43C718714eb63d5aA57B78B54704E256024E);
```

### Polygon

```javascript
// hardhat.config.js
module.exports = {
  networks: {
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: [PRIVATE_KEY]
    }
  }
};
```

Atualize os routers no constructor:
```solidity
// QuickSwap Router (Polygon)
dexRouters["quickswap"] = IUniswapV2Router(0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff);
```

## 📝 Script de Deploy

```javascript
// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const ArbitrageBot = await hre.ethers.getContractFactory("ArbitrageBot");
  const bot = await ArbitrageBot.deploy();
  await bot.deployed();
  
  console.log("ArbitrageBot deployed to:", bot.address);
  
  // Configurar DEXs adicionais
  await bot.setDexRouter("pancakeswap", "0x10ED43C718714eb63d5aA57B78B54704E256024E");
  
  console.log("DEX routers configured");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

## 🔐 Segurança

### Antes do Deploy

- [ ] Audite o código
- [ ] Teste em testnet (Sepolia, BSC Testnet)
- [ ] Configure multisig wallet como owner
- [ ] Defina limites adequados de slippage
- [ ] Configure lucro mínimo apropriado

### Após Deploy

- [ ] Verifique o contrato no Etherscan/BSCScan
- [ ] Transfira ownership para multisig
- [ ] Monitore transações constantemente
- [ ] Tenha plano de emergência (pause)

## 📊 Como Usar

### 1. Simular Arbitragem

```javascript
const { expectedProfit, profitable } = await bot.simulateArbitrage(
  "0xToken1", // USDT
  "0xToken2", // WETH
  ethers.utils.parseUnits("1000", 6), // 1000 USDT
  "uniswap",
  "sushiswap"
);

console.log("Lucro esperado:", ethers.utils.formatEther(expectedProfit));
console.log("É lucrativo?", profitable);
```

### 2. Executar Arbitragem

```javascript
const tx = await bot.executeArbitrage(
  "0xToken1", // USDT
  "0xToken2", // WETH
  ethers.utils.parseUnits("1000", 6),
  "uniswap",
  "sushiswap",
  ethers.utils.parseUnits("5", 6) // Min profit: 5 USDT
);

await tx.wait();
console.log("Arbitragem executada!");
```

### 3. Adicionar Nova DEX

```javascript
await bot.setDexRouter("pancakeswap", "0x10ED43C718714eb63d5aA57B78B54704E256024E");
```

## 🌐 Routers de DEXs

### Ethereum Mainnet
- Uniswap V2: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
- Sushiswap: `0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F`

### BSC
- PancakeSwap: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- Biswap: `0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8`

### Polygon
- QuickSwap: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`
- Sushiswap: `0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506`

## ⚠️ Considerações

1. **Gas Fees**: Execute apenas quando lucro > gas fees
2. **MEV**: Use Flashbots ou MEV-protected RPCs
3. **Slippage**: DEXs com baixa liquidez = alto slippage
4. **Timing**: Preços mudam rapidamente, execute rápido
5. **Capital**: Mais capital = mais lucro potencial

## 🎯 Próximos Passos

Agora você pode:
1. ✅ Compilar e fazer deploy do contrato
2. ⏳ Configurar n8n para chamar o contrato (próximo passo)
3. ⏳ Integrar com a interface SAAT (último passo)

## 📚 Recursos

- [OpenZeppelin Docs](https://docs.openzeppelin.com/)
- [Hardhat Docs](https://hardhat.org/docs)
- [Uniswap V2 Docs](https://docs.uniswap.org/contracts/v2/overview)
