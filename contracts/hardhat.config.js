require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * Hardhat Configuration para ArbitrageBot
 * 
 * Crie um arquivo .env com:
 * - PRIVATE_KEY=sua_private_key_aqui
 * - ETHERSCAN_API_KEY=sua_api_key_etherscan
 * - BSCSCAN_API_KEY=sua_api_key_bscscan
 * - POLYGONSCAN_API_KEY=sua_api_key_polygonscan
 * - ALCHEMY_API_KEY=sua_api_key_alchemy (opcional, para RPCs melhores)
 */

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  
  networks: {
    // Ethereum Mainnet
    mainnet: {
      url: ALCHEMY_API_KEY 
        ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : "https://eth.llamarpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 1,
      gasPrice: "auto"
    },
    
    // Ethereum Goerli Testnet
    goerli: {
      url: ALCHEMY_API_KEY
        ? `https://eth-goerli.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [PRIVATE_KEY],
      chainId: 5
    },
    
    // BSC Mainnet
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [PRIVATE_KEY],
      chainId: 56,
      gasPrice: 5000000000 // 5 gwei
    },
    
    // BSC Testnet
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [PRIVATE_KEY],
      chainId: 97
    },
    
    // Polygon Mainnet
    polygon: {
      url: ALCHEMY_API_KEY
        ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : "https://polygon-rpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 137,
      gasPrice: 50000000000 // 50 gwei
    },
    
    // Polygon Mumbai Testnet
    polygonMumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [PRIVATE_KEY],
      chainId: 80001
    },
    
    // Arbitrum One
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [PRIVATE_KEY],
      chainId: 42161
    },
    
    // Optimism
    optimism: {
      url: "https://mainnet.optimism.io",
      accounts: [PRIVATE_KEY],
      chainId: 10
    },
    
    // Localhost para testes
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISM_API_KEY || ""
    }
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  mocha: {
    timeout: 40000
  }
};
