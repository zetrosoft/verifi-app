// SPDX-License-Identifier: MIT
pragma solidity 0.8.20; // Locked to a specific compiler version to avoid known issues with ^

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AIEscrowMarketplace
 * @author Zetrosoft
 * @notice Kontrak ini mengelola alur kerja escrow untuk pekerjaan antara client dan freelancer,
 * dengan verifikasi otomatis yang dilakukan oleh AI Agent.
 */
contract AIEscrowMarketplace is Ownable, ReentrancyGuard {

    // =================================================================
    // State Variables
    // =================================================================

    address public aiAgentAddress;
    uint256 public nextJobId;
    address public aiAgentFeeWallet; // Wallet to receive fees
    uint256 public constant CLIENT_FEE_PERCENT = 2; // 2% fee from client (of job.price)
    uint256 public constant FREELANCER_FEE_PERCENT = 3; // 3% fee from freelancer (of job.price)

    enum Status {
        Open,           // Job posted, open for bidding
        Assigned,       // Freelancer selected, awaiting deposit
        FundsDeposited, // Client has deposited, work can begin
        WorkSubmitted,  // Freelancer has submitted the work
        Verified,       // AI Agent has completed verification
        Disputed,       // Client disputes the work/verification
        Completed,      // Funds have been released
        Cancelled       // Cancelled
    }

    struct Job {
        address payable client;
        address payable freelancer; // Will be set after a bid is accepted
        string title;
        string descriptionIPFSHash;
        uint256 price; // The base price of the job (before fees)
        uint256 deadline; // Unix timestamp
        string resultIPFSHash;
        Status status;
        string disputeReason; // Reason for dispute
    }

    struct Bid {
        uint256 bidId;
        uint256 jobId;
        address payable freelancer;
        string proposalText;
    }

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Bid[]) public bidsByJobId;
    mapping(address => uint256[]) public jobsByFreelancer;
    mapping(address => uint256[]) public jobsByClient;


    // =================================================================
    // Events
    // =================================================================

    event JobPosted(uint256 indexed jobId, address indexed client, string title, uint256 price);
    event FundsDeposited(uint256 indexed jobId, uint256 totalAmountDeposited, uint256 feeAmount);
    event WorkSubmitted(uint256 indexed jobId, address indexed freelancer, string resultIPFSHash);
    event WorkVerified(uint256 indexed jobId, bool isApproved);
    event FundsReleased(uint256 indexed jobId, address indexed recipient, uint256 netAmount, uint256 feeAmount);
    event AiAgentAddressUpdated(address indexed newAddress);
    event AiAgentFeeWalletUpdated(address indexed newAddress);

    // =================================================================
    // Modifiers
    // =================================================================

    modifier onlyAiAgent() {
        require(msg.sender == aiAgentAddress, "AIEscrow: Caller is not the AI Agent");
        _;
    }

    modifier jobMustExist(uint256 _jobId) {
        require(jobs[_jobId].client != address(0), "AIEscrow: Job does not exist");
        _;
    }

    modifier onlyClientOfJob(uint256 _jobId) {
        require(msg.sender == jobs[_jobId].client, "AIEscrow: Caller is not the job client");
        _;
    }

    modifier onlyJobFreelancer(uint256 _jobId) {
        require(jobs[_jobId].freelancer != address(0), "AIEscrow: Job does not exist");
        require(msg.sender == jobs[_jobId].freelancer, "AIEscrow: Caller is not the job freelancer");
        _;
    }

    modifier atJobStatus(uint256 _jobId, Status _expectedStatus) {
        require(jobs[_jobId].status == _expectedStatus, "AIEscrow: Job is not in the required status");
        _;
    }
    
    // =================================================================
    // Constructor & Admin Functions
    // =================================================================

    constructor(address _initialAiAgentAddress, address _initialAiAgentFeeWallet) Ownable(msg.sender) {
        require(_initialAiAgentAddress != address(0), "AIEscrow: Initial AI Agent address cannot be the zero address");
        require(_initialAiAgentFeeWallet != address(0), "AIEscrow: Initial AI Agent Fee Wallet address cannot be the zero address");
        aiAgentAddress = _initialAiAgentAddress;
        aiAgentFeeWallet = _initialAiAgentFeeWallet;
        emit AiAgentAddressUpdated(_initialAiAgentAddress);
        emit AiAgentFeeWalletUpdated(_initialAiAgentFeeWallet);
    }

    function setAiAgentAddress(address _newAiAgentAddress) external onlyOwner {
        require(_newAiAgentAddress != address(0), "AIEscrow: New AI Agent address cannot be the zero address");
        aiAgentAddress = _newAiAgentAddress;
        emit AiAgentAddressUpdated(_newAiAgentAddress);
    }

    function setAiAgentFeeWallet(address _newAiAgentFeeWallet) external onlyOwner {
        require(_newAiAgentFeeWallet != address(0), "AIEscrow: New AI Agent Fee Wallet address cannot be the zero address");
        aiAgentFeeWallet = _newAiAgentFeeWallet;
        emit AiAgentFeeWalletUpdated(_newAiAgentFeeWallet);
    }

    // =================================================================
    // Core Functions
    // =================================================================

    function postJob(
        string memory _title,
        string memory _descriptionIPFSHash,
        uint256 _price,
        uint256 _deadline // Reverted to _deadline (Unix timestamp)
    ) external {
        require(bytes(_title).length > 0, "AIEscrow: Job title cannot be empty");
        require(bytes(_descriptionIPFSHash).length > 0, "AIEscrow: Work description IPFS hash cannot be empty");
        require(_price > 0, "AIEscrow: Price must be greater than zero");
        // Mitigating block.timestamp dependency by requiring _deadline to be a future block number.
        // IMPORTANT: This changes the interpretation of _deadline from Unix timestamp to block number.
        // Frontend must be updated to provide a future block number.
        require(_deadline > block.number, "AIEscrow: Deadline block must be in the future");

        uint256 jobId = nextJobId;
        jobs[jobId] = Job({
            client: payable(msg.sender),
            freelancer: payable(address(0)),
            title: _title,
            descriptionIPFSHash: _descriptionIPFSHash,
            price: _price,
            deadline: _deadline, // Store deadline directly
            resultIPFSHash: "",
            status: Status.Open,
            disputeReason: ""
        });

        jobsByClient[msg.sender].push(jobId);
        nextJobId++;

        emit JobPosted(jobId, msg.sender, _title, _price);
    }

    event BidSubmitted(uint256 indexed jobId, uint256 indexed bidId, address freelancer, string proposalText);

    function submitBid(uint256 _jobId, string memory _proposalText) external {
        Job storage job = jobs[_jobId];
        require(job.client != address(0), "AIEscrow: Job does not exist");
        require(job.status == Status.Open, "AIEscrow: Job is not open for bidding");
        require(bytes(_proposalText).length > 0, "AIEscrow: Proposal text cannot be empty");
        require(msg.sender != job.client, "AIEscrow: Client cannot submit a bid on their own job");

        uint256 bidId = bidsByJobId[_jobId].length;
        bidsByJobId[_jobId].push(
            Bid({
                bidId: bidId,
                jobId: _jobId,
                freelancer: payable(msg.sender),
                proposalText: _proposalText
            })
        );

        emit BidSubmitted(_jobId, bidId, msg.sender, _proposalText);
    }

    event BidAccepted(uint256 indexed jobId, uint256 indexed bidId, address client, address freelancer);

    function acceptBid(uint256 _jobId, uint256 _bidId) external jobMustExist(_jobId) onlyClientOfJob(_jobId) {
        Job storage job = jobs[_jobId];
        require(job.status == Status.Open, "AIEscrow: Job is not open for bidding");
        require(_bidId < bidsByJobId[_jobId].length, "AIEscrow: Invalid bid ID");

        Bid storage acceptedBid = bidsByJobId[_jobId][_bidId];
        job.freelancer = acceptedBid.freelancer;
        job.status = Status.Assigned;

        jobsByFreelancer[acceptedBid.freelancer].push(_jobId);

        emit BidAccepted(_jobId, _bidId, msg.sender, acceptedBid.freelancer);
    }

    function getBidsForJob(uint256 _jobId) external view jobMustExist(_jobId) returns (Bid[] memory) {
        return bidsByJobId[_jobId];
    }

    function getJobCount() external view returns (uint256) {
        return nextJobId;
    }

    function depositForJob(uint256 _jobId) external payable nonReentrant jobMustExist(_jobId) onlyClientOfJob(_jobId) atJobStatus(_jobId, Status.Assigned) {
        Job storage job = jobs[_jobId];
        
        // Calculate client fee (2% of job.price)
        uint256 clientFee = (job.price * CLIENT_FEE_PERCENT) / 100;
        uint256 totalAmountExpected = job.price + clientFee;

        require(msg.value == totalAmountExpected, "AIEscrow: Incorrect deposit amount. Expected job.price + clientFee.");

        // The remaining amount (job.price) is implicitly held in the contract for escrow.
        job.status = Status.FundsDeposited;
        emit FundsDeposited(_jobId, msg.value, clientFee);

        // Transfer client fee to the designated wallet
        if (clientFee > 0) {
            payable(aiAgentFeeWallet).transfer(clientFee); // Changed to transfer for safety.
            // require(success, "AIEscrow: Failed to transfer client fee"); // transfer throws on failure
        }
    }

    function submitWork(uint256 _jobId, string memory _resultIPFSHash) external onlyJobFreelancer(_jobId) atJobStatus(_jobId, Status.FundsDeposited) {
        require(bytes(_resultIPFSHash).length > 0, "AIEscrow: Result IPFS hash cannot be empty");
        // Mitigating block.timestamp dependency by comparing with block.number.
        // Assumes jobs[_jobId].deadline is now a block number.
        require(block.number < jobs[_jobId].deadline, "AIEscrow: Deadline block has passed");

        Job storage job = jobs[_jobId];
        job.resultIPFSHash = _resultIPFSHash;
        job.status = Status.WorkSubmitted;
        emit WorkSubmitted(_jobId, job.freelancer, _resultIPFSHash);
    }

    event JobDisputed(uint256 indexed jobId, address indexed client, string reason);

    function raiseDispute(uint256 _jobId, string memory _reason) external jobMustExist(_jobId) onlyClientOfJob(_jobId) atJobStatus(_jobId, Status.Verified) {
        Job storage job = jobs[_jobId];
        require(bytes(_reason).length > 0, "AIEscrow: Dispute reason cannot be empty");

        job.status = Status.Disputed;
        job.disputeReason = _reason;
        emit JobDisputed(_jobId, msg.sender, _reason);
    }

    event DisputeResolved(uint256 indexed jobId, bool releaseToFreelancer);

    function resolveDispute(uint256 _jobId, bool _releaseToFreelancer) external nonReentrant onlyAiAgent atJobStatus(_jobId, Status.Disputed) {
        Job storage job = jobs[_jobId];

        // First, apply all state changes and emit event for this function's logic
        if (_releaseToFreelancer) {
            job.status = Status.Completed;
        } else {
            job.status = Status.Cancelled;
        }
        emit DisputeResolved(_jobId, _releaseToFreelancer);

        // Then, perform external interactions
        if (_releaseToFreelancer) {
            _releaseFunds(_jobId); // This internal function now performs the external transfers
        } else {
            job.client.transfer(job.price); // Refund client
        }
    }

    function verifyWork(uint256 _jobId, bool _isApproved) external nonReentrant onlyAiAgent atJobStatus(_jobId, Status.WorkSubmitted) {
        Job storage job = jobs[_jobId];
        
        if (_isApproved) {
            job.status = Status.Verified;
            emit WorkVerified(_jobId, _isApproved); // Emit after state update
        } else {
            job.status = Status.Cancelled;
            emit WorkVerified(_jobId, _isApproved); // Emit after state update, before external call
            job.client.transfer(job.price); // Refund job.price, client fee is non-refundable. Changed to transfer for safety.
            // require(success, "AIEscrow: Failed to refund client on rejection"); // transfer throws on failure
        }
    }

    function clientReleaseFunds(uint256 _jobId) external nonReentrant jobMustExist(_jobId) onlyClientOfJob(_jobId) atJobStatus(_jobId, Status.Verified) {
        _releaseFunds(_jobId);
    }

    // =================================================================
    // Internal Functions
    // =================================================================

    function _releaseFunds(uint256 _jobId) internal {
        Job storage job = jobs[_jobId];
        job.status = Status.Completed;

        // Calculate freelancer fee (3% of job.price)
        uint256 freelancerFee = (job.price * FREELANCER_FEE_PERCENT) / 100;
        uint256 amountToFreelancer = job.price - freelancerFee;

        // All state updates and event emissions should happen before external calls
        emit FundsReleased(_jobId, job.freelancer, amountToFreelancer, freelancerFee); // netAmount, feeAmount

        // Transfer freelancer fee to the designated wallet
        if (freelancerFee > 0) {
            payable(aiAgentFeeWallet).transfer(freelancerFee);
        }
        
        // Transfer net amount to freelancer
        // Changed to transfer for safety against reentrancy
        job.freelancer.transfer(amountToFreelancer);
        // require(success, "AIEscrow: Failed to release funds to freelancer"); // transfer throws on failure, no need for require(success)
    }
}