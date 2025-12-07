# End-to-End Testing Setup Guide (Revised)

This document provides a revised and corrected guide for setting up the local environment for end-to-end testing. It is aligned with the project's established testing practices, specifically the use of a Hardhat fork of the Avalanche Fuji Testnet.

---

### A. Smart Contract Setup

The goal is to run a local blockchain forking the Fuji testnet, deploy our contract to it, and get its new address.

1.  **Configure Hardhat for Forking:**
    *   Ensure your `verifi-app/contracts/hardhat.config.cts` file is configured to fork the Fuji network. It should look something like this. **Make sure your `FUJI_RPC_URL` in the `.env` file is set to a valid Avalanche Fuji RPC endpoint (e.g., from Ankr or another provider).**

        ```typescript
        // verifi-app/contracts/hardhat.config.cts
        import { HardhatUserConfig } from "hardhat/config";
        import "@nomicfoundation/hardhat-toolbox";
        import "dotenv/config";

        const config: HardhatUserConfig = {
          solidity: "0.8.20",
          networks: {
            hardhat: {
              forking: {
                url: process.env.FUJI_RPC_URL || "",
                // Optional: blockNumber can be pinned for consistent testing
              },
              chainId: 43113, // Explicitly set chainId to match Fuji
            },
            localhost: {
              url: "http://127.0.0.1:8545",
              chainId: 43113, // Match the forked chain
            },
            // ... other networks
          },
        };

        export default config;
        ```

2.  **Run the Local Forked Blockchain:**
    *   Open a new terminal.
    *   Navigate to the contracts directory: `cd verifi-app/contracts`
    *   Run the Hardhat node. **Crucially, use the `NODE_OPTIONS` flag:**
        ```bash
        NODE_OPTIONS="--loader ts-node/esm" npx hardhat node
        ```
    *   Keep this terminal running. It will display a list of accounts and their private keys.

3.  **Deploy the Smart Contract:**
    *   Open another new terminal.
    *   Navigate to the contracts directory: `cd verifi-app/contracts`
    *   Install dependencies (if you haven't already): `npm install`
    *   Deploy the contract to the local node, again using the `NODE_OPTIONS` flag:
        ```bash
        NODE_OPTIONS="--loader ts-node/esm" npx hardhat run scripts/deploy.ts --network localhost
        ```
    *   Once finished, the terminal will display the new contract address. **Take note of this address.**

4.  **Update the ABI:**
    *   A new ABI file is generated at `verifi-app/contracts/artifacts/contracts/AIEscrowMarketplace.sol/AIEscrowMarketplace.json`.
    *   Copy this `AIEscrowMarketplace.json` file and use it to overwrite the existing file at `verifi-app/frontend/src/artifacts/AIEscrowMarketplace.json`.

---

### B. AI Agent (Backend) Setup

The goal is to run the backend server connected to the local forked blockchain.

1.  **Install Dependencies:**
    *   Open a new terminal.
    *   Navigate to the AI Agent directory: `cd verifi-app/ai-agent`
    *   Create and activate a virtual environment: `python3 -m venv venv` then `source venv/bin/activate`
    *   Install all required packages: `pip install -r requirements.txt`

2.  **Configure Environment Variables (`.env`):**
    *   Create a file named `.env` inside the `verifi-app/ai-agent/` directory.
    *   Fill it with the following. Note that `FUJI_RPC_URL` here points to your **local** node.
        ```env
        # URL of the running Hardhat node from step A.2
        FUJI_RPC_URL="http://127.0.0.1:8545"

        # The new contract address from step A.3
        CONTRACT_ADDRESS="YOUR_NEW_CONTRACT_ADDRESS"

        # Path to the ABI file
        CONTRACT_ABI_PATH="../contracts/artifacts/contracts/AIEscrowMarketplace.sol/AIEscrowMarketplace.json"

        # Private key for the account that will act as the AI Agent
        # Take one of the private keys from the 'npx hardhat node' output (e.g., account #19)
        AI_AGENT_PRIVATE_KEY="PRIVATE_KEY_FROM_HARDHAT_NODE"
        ```

3.  **Run the AI Agent Server:**
    *   In the same terminal (with the venv activated), run the FastAPI server:
        `uvicorn main:app --reload --port 8000`
    *   Keep this terminal running.

---

### C. Frontend (DApp) Setup

The goal is to run the React application connected to the AI Agent and the local forked blockchain.

1.  **Install Dependencies:**
    *   Open a new terminal.
    *   Navigate to the frontend directory: `cd verifi-app/frontend`
    *   Install dependencies (if you haven't already): `npm install`

2.  **Configure Environment Variables (`.env`):**
    *   Ensure a `.env` file exists in the `verifi-app/frontend/` directory.
    *   Its content should be:
        ```env
        # The new contract address from step A.3
        VITE_CONTRACT_ADDRESS="YOUR_NEW_CONTRACT_ADDRESS"

        # The address of the AI Agent server running from step B.3
        VITE_API_BASE_URL="http://localhost:8000"
        ```

3.  **Configure Wallet (MetaMask):**
    *   Open your browser and ensure the MetaMask extension is installed.
    *   Add/update your local network configuration to match the Fuji fork:
        *   **Network Name:** `Hardhat (Fuji Fork)`
        *   **New RPC URL:** `http://127.0.0.1:8545`
        *   **Chain ID:** `43113`
        *   **Currency Symbol:** `AVAX`
    *   Import at least two accounts from the Hardhat node terminal (from step A.2) into MetaMask using their private keys. One account will act as the **Client** and another as the **Freelancer**.

4.  **Run the Frontend Application:**
    *   In the frontend terminal, run the application: `npm run dev`
    *   Open the URL displayed (usually `http://localhost:5173`) in your browser.

---

After completing these revised steps, your environment will be correctly set up for testing according to the project's established standards.