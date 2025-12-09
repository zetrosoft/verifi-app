# Technical Design for Single-Chain Payments with ERC-8004 Principles

This document outlines the technical design for implementing single-chain payment functionality in VeriFi, allowing clients to pay contracts on Avalanche using their ERC-20 tokens (e.g., USDC) also on the Avalanche network. This implementation will adhere to the principles of **ERC-8004 (Payment Request and Payment Settlement via Cross-Chain Transfer)**, where our AI Agent acts as a "Payment Relayer" or "Payment Resolver" within a single chain.

## Payment Scenario (Single-Chain)

*   **Client:** Holds ERC-20 Tokens (e.g., USDC) on the Avalanche Network.
*   **Contract:** `AIEscrowMarketplace.sol` on the Avalanche Network expects payment in AVAX (Avalanche's native token).
*   **Objective:** Clients can pay `job.price` on Avalanche using their USDC on Avalanche, with the AI Agent facilitating the token swap.

## Involved Components

### 1. Smart Contract (`AIEscrowMarketplace.sol` on Avalanche)

The `AIEscrowMarketplace.sol` contract will continue to only accept **AVAX** via the `depositForJob(uint256 _jobId) payable` function. This contract will not be modified to directly receive ERC-20 tokens from clients for this payment. The conversion and transfer roles will be entirely handled by the AI Agent.

### 2. AI Agent (as ERC-8004 Payment Relayer/Resolver)

This is a vital component that will manage the alternative payment flow.

*   **New Endpoint: `POST /resolve-single-chain-payment`:**
    *   **Input:** Will receive `jobId`, `clientAddress`, `tokenAddress` (USDC contract address on Avalanche), and `amountToken` (the amount of USDC the client will use to pay).
    *   **Logic:**
        1.  **Get Job Details:** The AI Agent will retrieve `job.price` (in AVAX) from `AIEscrowMarketplace.sol` using `jobId`.
        2.  **Receive USDC:** The client (via Frontend) will transfer `amountToken` USDC to the AI Agent's address (or a temporary holding contract managed by the AI Agent). The AI Agent will monitor this transaction or receive notifications from the frontend.
        3.  **Price Oracle:** The AI Agent will query a price Oracle (e.g., Chainlink) on Avalanche to get an accurate and *real-time* USDC/AVAX exchange rate.
        4.  **Calculate AVAX Needs:** Based on `job.price` and the exchange rate, the AI Agent will calculate how much AVAX is needed.
        5.  **Swap USDC to AVAX:** The AI Agent will interact with a DEX (Decentralized Exchange) aggregator (e.g., Trader Joe API or PancakeSwap API on Avalanche) to swap the USDC received from the client into the equivalent amount of AVAX.
        6.  **Pay Gas:** The AI Agent must ensure it has enough AVAX in its wallet on Avalanche to pay for gas fees for the `depositForJob` transaction.
        7.  **Avalanche Contract Interaction:** The AI Agent will call the `depositForJob(jobId)` function in `AIEscrowMarketplace.sol`, depositing the correct amount of AVAX obtained from the swap.
*   **Error & Status Handling:** The AI Agent must have robust error handling mechanisms for swap failures and transaction failures, as well as mechanisms to notify the client about payment status.

### 3. Frontend Changes

The Frontend will guide the client through the alternative payment flow.

*   **Payment Option:** In `CreateJobForm`, clients will have the option: "Pay with AVAX" or "Pay with USDC".
*   **USDC Payment Flow (Single-Chain):**
    1.  If "Pay with USDC" is selected, the frontend will ask the client to approve (`approve`) the AI Agent's address (or holding contract) to spend their USDC.
    2.  The frontend will trigger a transaction to transfer `amountToken` USDC to the AI Agent's address.
    3.  After the USDC transfer is successful, the frontend will call the `POST /resolve-single-chain-payment` endpoint on the AI Agent, passing `jobId`, `clientAddress`, USDC `tokenAddress`, and the `amountToken` that has been transferred.
    4.  The frontend will display the payment status, informing the client that the AI Agent is processing the swap and deposit.
*   **UX Feedback:** Clearly communicate all related costs (USDC transaction fees, swap fees, AVAX transaction fees) and payment status.

### 4. Challenges and Considerations

*   **Security:** Management of the AI Agent's private key and its interaction with DEX aggregators.
*   **Costs:** Each step (approve, USDC transfer, swap, AVAX deposit) will incur gas fees.
*   **Oracle:** Accuracy and availability of Oracle price feeds are crucial for exchange rates.
*   **Slippage:** Potential slippage during DEX swaps.

### Alignment with ERC-8004

This design directly implements the principles of ERC-8004 in a single-chain context:

*   **Payment Request (on-chain/off-chain):** The frontend displays a payment request for `job.price` (on Avalanche).
*   **Payment Initiator:** The client initiates payment with USDC on Avalanche.
*   **Payment Asset & Network (Source):** USDC on Avalanche.
*   **Payment Asset & Network (Target):** AVAX on Avalanche.
*   **Payment Resolver/Relayer:** Our AI Agent acts as an off-chain entity that observes client token transfers, facilitates DEX swaps, and settles payments on the target network with the correct token.

  The correct JSON ABI for Trader Joe Router 2.2. This is a very important and previously missing part.

  Confirmed Data:
   * USDC Contract Address: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
   * WAVAX Contract Address: 0xB31f66AA3C1e785363F0Dc4Aae6c65E6e64d9AAf
   * Trader Joe Router 2.2 Address: 0x18556DA13313f3532c54711497A8FedAC273220E
   * Trader Joe Router 2.2 ABI: JSON provided by the user.
   * Standard ERC20 ABI: (defines the minimal for approve, transferFrom, balanceOf).

  Plan (to complete single-chain ERC-8004 implementation):

   1. Define ABIs in `verifi-app/ai-agent/main.py`:
       * Define TRADER_JOE_ROUTER_ABI using the provided JSON.
       * Define a minimal ERC20_ABI for basic token interactions.
   2. Implement AI Agent Endpoint `POST /resolve-single-chain-payment` in `verifi-app/ai-agent/main.py`:
       * Add Pydantic model SingleChainPaymentRequest.
       * Add endpoint decorator and async function.
       * Inside the endpoint:
           * Initialize Web3 and all necessary contract objects (Router, USDC, WAVAX, AIEscrowMarketplace).
           * Retrieve job.price (in AVAX) from AIEscrowMarketplace.
           * Implement logic to approve USDC (if the AI Agent directly receives USDC from the client).
           * Implement swap logic (USDC to WAVAX to AVAX) using the swapExactTokensForNATIVE function from the Trader Joe
             Router contract.
           * Integrate a price Oracle (for AVAX/USDC, I will use a mock or simple fixed ratio for MVP or
             calculate it from getAmountsOut if the router supports it).
           * Call depositForJob in AIEscrowMarketplace with the swapped AVAX.
           * Implement comprehensive error handling.
   3. Frontend Changes (to test this flow):
       * Add "Pay with USDC (on Avalanche)" payment option.
       * Implement frontend logic to approve and transfer USDC to the AI Agent.
       * Call the new AI Agent resolve-single-chain-payment endpoint.

Thus, this project can conceptually demonstrate how an AI-powered "Payment Resolver" can facilitate payments with different assets to fulfill contract requests on a single network."
