### 1. Updated UML Diagrams

Based on the code analysis, here are the updated diagrams reflecting the actual implementation in your application.

#### **Class Diagram**

This diagram is updated to accurately reflect the variables, functions, and events present in your `AIEscrowMarketplace.sol` smart contract, including details like the `clientFeePercentage`.

```mermaid
classDiagram
    direction LR

    class AIEscrowMarketplace {
        +address owner
        +address aiAgentAddress
        +uint256 clientFeePercentage
        +uint256 jobCounter
        +uint256 bidCounter

        +mapping(uint256 => Job) jobs
        +mapping(uint256 => Bid[]) bidsByJobId
        +mapping(address => uint256[]) jobsByFreelancer
        +mapping(address => uint256[]) jobsByClient

        +postJob(string title, string ipfsHash, uint256 price)
        +submitBid(uint256 jobId, string proposal)
        +acceptBid(uint256 jobId, uint256 bidId)
        +depositForJob(uint256 jobId) payable
        +submitWork(uint256 jobId, string resultHash)
        +verifyWork(uint256 jobId, bool isApproved)
        +raiseDispute(uint256 jobId, string reason)
        +resolveDispute(uint256 jobId, bool releaseToFreelancer)

        +event JobPosted(uint256 jobId, address client)
        +event BidSubmitted(uint256 bidId, uint256 jobId)
        +event BidAccepted(uint256 jobId, uint256 bidId)
        +event FundsDeposited(uint256 jobId)
        +event WorkSubmitted(uint256 jobId, string resultHash)
        +event WorkVerified(uint256 jobId, bool isApproved)
        +event DisputeRaised(uint256 jobId)
        +event DisputeResolved(uint256 jobId, bool fundsReleasedToFreelancer)
    }

    class Job {
        +uint256 jobId
        +address payable client
        +address payable freelancer
        +string title
        +string descriptionIPFSHash
        +uint256 price
        +Status status
        +string disputeReason
        +string workResultIPFSHash
    }

    class Bid {
        +uint256 bidId
        +uint256 jobId
        +address payable freelancer
        +string proposalText
        +bool accepted
    }

    class Status {
        <<enumeration>>
        Open
        Assigned
        FundsDeposited
        WorkSubmitted
        Verified
        Disputed
        Completed
        Cancelled
    }

    AIEscrowMarketplace  -->  "*" Job : manages
    AIEscrowMarketplace  -->  "*" Bid : manages
    Job  "1" -- "0..*"  Bid : has
    Job  ..>  Status : uses
```

#### **System Architecture Diagram**

This diagram is updated to explicitly show the integration with **Google Gemini** and the code verification flow using **Pytest**.

```mermaid
graph TD
    subgraph "User Interface (React)"
        DA(Verifi DApp)
    end

    subgraph "Off-Chain Services"
        IPFS(IPFS/Filecoin)
        subgraph "AI Agent (Python/FastAPI)"
            direction LR
            API(API Endpoints)
            GEMINI(Google Gemini)
            PYTEST(Pytest Engine)
        end
    end

    subgraph "Avalanche C-Chain"
        SC(AIEscrowMarketplace.sol)
        DEX(Trader Joe DEX)
    end

    User[User: Client/Freelancer] -- Interacts --> DA

    DA -- "1. Feasibility & Fit Check" --> API
    API -- "Analyzes with" --> GEMINI
    
    DA -- "2. Uploads Data" --> IPFS
    DA -- "3. On-Chain Transactions" --> SC

    SC -- "Events (WorkSubmitted, DisputeRaised)" --> API

    API -- "4. Fetches Data from" --> IPFS
    API -- "5a. Verifies Code with" --> PYTEST
    API -- "5b. Arbitrates with" --> GEMINI

    API -- "6. Sends Results to" --> SC

    subgraph "Future: Payment Resolution"
      API -- "Swaps Tokens via" --> DEX
    end
```

### 2. New Development Roadmap Diagram

Here is a new development roadmap in a Gantt chart format. It visualizes the project's phases from the completed MVP to full decentralization in the future.

```mermaid
gantt
    title Verifi Development Roadmap
    dateFormat  YYYY-MM-DD

    section Phase 1: Hackathon MVP (Completed)
    Core Foundation           :done, 2025-10-01, 3M
    AI Agent v1 (Gemini)      :done, 2025-10-01, 3M
    Marketplace & Disputes    :done, 2025-10-01, 3M
    Functional Frontend       :done, 2025-10-01, 3M

    section Phase 2: Launch & Hardening (Q1-Q2 2026)
    UI/UX Refinements                 :polish_ux, 2026-01-01, 1M
    Smart Contract Security Audits    :audit, after polish_ux, 1M
    Full Payment Resolver Implementation :payment_resolver, after polish_ux, 2M
    Mainnet Beta Launch               :mainnet, after audit, 1M
    
    section Phase 3: Feature Expansion & B2B (Q2-Q3 2026)
    B2B API Launch (Beta)             :b2b_api, 2026-04-01, 2M
    Cross-Chain Payment Implementation :cross_chain, after payment_resolver, 2M
    New AI Verification Models        :more_ai, after b2b_api, 2M

    section Phase 4: Decentralization & Governance (Q4 2026 ->)
    Kite AI On-Chain Identity Integration :kite_identity, 2026-10-01, 2M
    DAO & Governance Development      :dao, after kite_identity, 3M
    Decentralized AI Agent Research   :decentralized_ai, after dao, 3M
```