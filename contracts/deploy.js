/**
 * Script de Deploy para ArbitrageBot
 * 
 * Como usar:
 * 1. npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
 * 2. Configure hardhat.config.js com suas credenciais
 * 3. npx hardhat run contracts/deploy.js --network <network>
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Iniciando deploy do ArbitrageBot...");
  
  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying com a conta:", deployer.address);
  
  const balance = await deployer.getBalance();
  console.log("💰 Balance da conta:", hre.ethers.utils.formatEther(balance), "ETH");
  
  // Deploy contract
  console.log("\n⏳ Fazendo deploy do contrato...");
  const ArbitrageBot = await hre.ethers.getContractFactory("ArbitrageBot");
  const bot = await ArbitrageBot.deploy();
  await bot.deployed();
  
  console.log("✅ ArbitrageBot deployed to:", bot.address);
  
  // Configurar DEXs baseado na network
  const networkName = hre.network.name;
  console.log("\n🔧 Configurando routers para network:", networkName);
  
  if (networkName === "bsc" || networkName === "bscTestnet") {
    // BSC/PancakeSwap
    console.log("Configurando PancakeSwap...");
    await bot.setDexRouter("pancakeswap", "0x10ED43C718714eb63d5aA57B78B54704E256024E");
    
    console.log("Configurando Biswap...");
    await bot.setDexRouter("biswap", "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8");
    
  } else if (networkName === "polygon" || networkName === "polygonMumbai") {
    // Polygon/QuickSwap
    console.log("Configurando QuickSwap...");
    await bot.setDexRouter("quickswap", "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff");
    
    console.log("Configurando Sushiswap (Polygon)...");
    await bot.setDexRouter("sushiswap", "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506");
    
  } else if (networkName === "mainnet" || networkName === "goerli") {
    // Ethereum já tem Uniswap e Sushiswap no constructor
    console.log("✅ Uniswap e Sushiswap já configurados no constructor");
  }
  
  // Configurações de segurança
  console.log("\n🔐 Configurando parâmetros de segurança...");
  
  // Min profit: 0.5%
  await bot.setMinProfitBasisPoints(50);
  console.log("✅ Lucro mínimo: 0.5%");
  
  // Max slippage: 2%
  await bot.setMaxSlippageBasisPoints(200);
  console.log("✅ Slippage máximo: 2%");
  
  // Verificar configurações
  console.log("\n📊 Configurações finais:");
  console.log("  - Contract Address:", bot.address);
  console.log("  - Owner:", await bot.owner());
  console.log("  - Min Profit:", (await bot.minProfitBasisPoints()).toString(), "basis points");
  console.log("  - Max Slippage:", (await bot.maxSlippageBasisPoints()).toString(), "basis points");
  console.log("  - Paused:", await bot.paused());
  
  console.log("\n✅ Deploy completo!");
  console.log("\n📝 Próximos passos:");
  console.log("  1. Verifique o contrato no block explorer");
  console.log("  2. Deposite fundos no contrato");
  console.log("  3. Configure o n8n workflow com o endereço:", bot.address);
  console.log("  4. Teste com small amounts primeiro");
  
  // Salvar endereço do contrato
  const fs = require("fs");
  const deploymentInfo = {
    network: networkName,
    contractAddress: bot.address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };
  
  fs.writeFileSync(
    `contracts/deployment-${networkName}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Informações de deploy salvas em: deployment-" + networkName + ".json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro no deploy:", error);
    process.exit(1);
  });
