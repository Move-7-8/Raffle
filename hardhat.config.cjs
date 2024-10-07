require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config(); // This is how we load environment variables in CommonJS
require("@nomicfoundation/hardhat-chai-matchers");

const { 
  SEPOLIA_RPC_URL,
  HOLESKI_RPC_URL, 
  PRIVATE_KEY, 
  ETHERSCAN_API_KEY, 
  COINMARKETCAP_API_KEY 
} = process.env

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [`0x${PRIVATE_KEY}`],
      chainId: 11155111,  
      // gas: 950000000, // Increase the gas limit if needed (adjust accordingly)
      // gasPrice: 125000000, 

    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,  // Add the API key for Sepolia here
    },
  },

  gasReporter: {
    enabled: true,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  solidity: "0.8.27",
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },

  mocha: {
    timeout: 250000,
  },

};
