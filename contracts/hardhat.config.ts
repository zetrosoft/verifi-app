import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv"; // Import dotenv

dotenv.config(); // Load environment variables from .env file

const config: HardhatUserConfig = {
  solidity: "0.8.20", // Set solidity version to 0.8.20
  networks: {
    fuji: {
      url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc", // Use RPC from .env or default
      chainId: 43113,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // You can add other networks here, e.g., mainnet, local, etc.
  },
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || "",
    },
  },
};

export default config;
