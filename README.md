# VeriFi: AI Escrow Marketplace

A decentralized, AI-powered escrow platform for work verification and instant payments, built on the Avalanche blockchain.

## Requirements

- Node.js (LTS version recommended)
- npm or Yarn (for JavaScript/TypeScript projects)
- Python 3.8+ (for AI Agent)
- pip (Python package installer)
- Git (for cloning the repository)
- Hardhat (Ethereum development environment, installed via npm)
- MetaMask or any Web3-compatible wallet (for interacting with the DApp)

## Installation

Follow these steps to set up the project locally.

1.  **Clone the Repository:**
    ```bash
    git clone [YOUR_REPOSITORY_URL]
    cd verifi-app
    ```

2.  **Contracts Setup:**
    Navigate to the `contracts` directory, install dependencies, and set up environment variables.
    ```bash
    cd contracts
    npm install # or yarn install
    cp .env.example .env
    # Edit .env with your PRIVATE_KEY, Fuji RPC URL, etc.
    ```

3.  **Frontend DApp Setup:**
    Navigate to the `frontend` directory, install dependencies, and set up environment variables.
    ```bash
    cd ../frontend
    npm install # or yarn install
    cp .env.example .env
    # Edit .env with your contract address, etc.
    ```

4.  **AI Agent Setup:**
    Navigate to the `ai-agent` directory, create a virtual environment, install Python dependencies, and set up environment variables.
    ```bash
    cd ../ai-agent
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    # Edit .env with your blockchain RPC URL, AI Agent private key, etc.
    deactivate # Optional: exit virtual environment
    ```

5.  **Hardhat Local Network (Optional, for local development):**
    You can start a local Hardhat network in the `contracts` directory to deploy and test locally.
    ```bash
    cd ../contracts
    npx hardhat node
    ```

6.  **Deploy Contracts (if using local network):**
    In a new terminal, from the `contracts` directory, deploy your contracts to the local Hardhat network.
    ```bash
    cd ../contracts
    # Ensure nvm is sourced and Node.js v20+ is used if you encounter issues
    # source ~/.nvm/nvm.sh && nvm use 20
    npx hardhat run scripts/deploy.ts --network localhost
    ```
    The contract should be deployed to `0x5FbDB2315678afecb367f032d93F642f64180aa3`.
    **ACTION REQUIRED:** Update `frontend/.env` and `ai-agent/.env` with this deployed contract address for `REACT_APP_CONTRACT_ADDRESS` and `CONTRACT_ADDRESS` respectively.

## Summary

This project aims to solve the core problems faced by global freelancers: high transaction fees, long payment settlement times, and subjective work quality disputes. VeriFi integrates a Smart Contract Escrow, an AI Agent as an automatic arbiter, and the speed of Avalanche to create a fair, transparent, and efficient solution.

The complete development planning document can be found at doc/development_plan.md.
