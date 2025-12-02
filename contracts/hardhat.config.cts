import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv'; // Import dotenv
dotenv.config(); // Load environment variables

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545', // Default Hardhat local network URL
      chainId: 31337, // Default Hardhat local network Chain ID
    },
    fuji: {
      url: process.env.FUJI_RPC_URL || '',
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      chainId: 43113, // Chain ID for Avalanche Fuji C-Chain
    },
  },
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || '',
    },
  },
};

export default config;
