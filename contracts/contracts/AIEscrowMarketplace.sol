// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

    enum Status {
        Open,           // Job posted, open for bidding
        Assigned,       // Freelancer selected, awaiting deposit
        FundsDeposited, // Client has deposited, work can begin
        WorkSubmitted,  // Freelancer has submitted the work
        Verified,       // AI Agent has completed verification
        Completed,      // Funds have been released
        Cancelled       // Cancelled
    }

    struct Job {
        address payable client;
        address payable freelancer; // Will be set after a bid is accepted
        string title;
        string descriptionIPFSHash;
        uint256 price;
        uint256 deadline; // Unix timestamp
        string resultIPFSHash;
        Status status;
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
    event FundsDeposited(uint256 indexed jobId, uint256 price);
    event WorkSubmitted(uint256 indexed jobId, address indexed freelancer, string resultIPFSHash);
    event WorkVerified(uint256 indexed jobId, bool isApproved);
    event FundsReleased(uint256 indexed jobId, address indexed recipient, uint256 price);
    event AiAgentAddressUpdated(address indexed newAddress);

    // =================================================================
    // Modifiers
    // =================================================================

    modifier onlyAiAgent() {
        require(msg.sender == aiAgentAddress, "AIEscrow: Caller is not the AI Agent");
        _;
    }

    modifier onlyJobClient(uint256 _jobId) {
        require(jobs[_jobId].client != address(0), "AIEscrow: Job does not exist");
        require(msg.sender == jobs[_jobId].client, "AIEscrow: Caller is not the job client");
        _;
    }

    modifier onlyJobFreelancer(uint256 _jobId) {
        require(jobs[_jobId].freelancer != address(0), "AIEscrow: Job does not exist");
        require(msg.sender == jobs[_jobId].freelancer, "AIEscrow: Caller is not the job freelancer");
        _;
    }

    modifier atJobStatus(uint256 _jobId, Status _status) {
        require(jobs[_jobId].status == _status, "AIEscrow: Job is not in the required status");
        _;
    }

    // =================================================================
    // Constructor & Admin Functions
    // =================================================================

    constructor(address _initialAiAgentAddress) Ownable(msg.sender) {
        require(_initialAiAgentAddress != address(0), "AIEscrow: Initial AI Agent address cannot be the zero address");
        aiAgentAddress = _initialAiAgentAddress;
        emit AiAgentAddressUpdated(_initialAiAgentAddress);
    }

    function setAiAgentAddress(address _newAiAgentAddress) external onlyOwner {
        require(_newAiAgentAddress != address(0), "AIEscrow: New AI Agent address cannot be the zero address");
        aiAgentAddress = _newAiAgentAddress;
        emit AiAgentAddressUpdated(_newAiAgentAddress);
    }

    // =================================================================
    // Core Functions
    // =================================================================

    function postJob(
        string memory _title,
        string memory _descriptionIPFSHash,
        uint256 _price,
        uint256 _deadline
    ) external {
        require(bytes(_title).length > 0, "AIEscrow: Job title cannot be empty");
        require(bytes(_descriptionIPFSHash).length > 0, "AIEscrow: Work description IPFS hash cannot be empty");
        require(_price > 0, "AIEscrow: Price must be greater than zero");
        require(_deadline > block.timestamp, "AIEscrow: Deadline must be in the future");

        uint256 jobId = nextJobId;
        jobs[jobId] = Job({
            client: payable(msg.sender),
            freelancer: payable(address(0)), // Freelancer is not assigned yet
            title: _title,
            descriptionIPFSHash: _descriptionIPFSHash,
            price: _price,
            deadline: _deadline,
            resultIPFSHash: "",
            status: Status.Open
        });

        jobsByClient[msg.sender].push(jobId);
        nextJobId++;

        emit JobPosted(jobId, msg.sender, _title, _price);
    }

    event BidSubmitted(uint256 indexed jobId, uint256 indexed bidId, address indexed freelancer, string proposalText);

    function submitBid(uint256 _jobId, string memory _proposalText) external {
        Job storage job = jobs[_jobId];
        require(job.client != address(0), "AIEscrow: Job does not exist");
        require(job.status == Status.Open, "AIEscrow: Job is not open for bidding");
        require(bytes(_proposalText).length > 0, "AIEscrow: Proposal text cannot be empty");
        require(msg.sender != job.client, "AIEscrow: Client cannot submit a bid on their own job");

        uint256 bidId = bidsByJobId[_jobId].length; // Simple auto-incrementing bid ID per job
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

    function acceptBid(uint256 _jobId, uint256 _bidId) external onlyJobClient(_jobId) {
        Job storage job = jobs[_jobId];
        require(job.status == Status.Open, "AIEscrow: Job is not open for bidding");
        require(_bidId < bidsByJobId[_jobId].length, "AIEscrow: Invalid bid ID");

        Bid storage acceptedBid = bidsByJobId[_jobId][_bidId];
        job.freelancer = acceptedBid.freelancer;
        job.status = Status.Assigned;

        jobsByFreelancer[acceptedBid.freelancer].push(_jobId);

        emit BidAccepted(_jobId, _bidId, msg.sender, acceptedBid.freelancer);
    }

    function getBidsForJob(uint256 _jobId) external view returns (Bid[] memory) {
        require(jobs[_jobId].client != address(0), "AIEscrow: Job does not exist");
        return bidsByJobId[_jobId];
    }

    function getJobCount() external view returns (uint256) {
        return nextJobId;
    }



    function depositForJob(uint256 _jobId) external payable nonReentrant onlyJobClient(_jobId) atJobStatus(_jobId, Status.Assigned) {
        Job storage job = jobs[_jobId];
        require(msg.value == job.price, "AIEscrow: Incorrect deposit amount"); // Now checking against job.price

        job.status = Status.FundsDeposited;
        emit FundsDeposited(_jobId, msg.value); // msg.value is the actual amount received
    }

    function submitWork(uint256 _jobId, string memory _resultIPFSHash) external onlyJobFreelancer(_jobId) atJobStatus(_jobId, Status.FundsDeposited) {
        require(bytes(_resultIPFSHash).length > 0, "AIEscrow: Result IPFS hash cannot be empty");

        Job storage job = jobs[_jobId];
        job.resultIPFSHash = _resultIPFSHash;
        job.status = Status.WorkSubmitted;
        emit WorkSubmitted(_jobId, job.freelancer, _resultIPFSHash);
    }

    function verifyWork(uint256 _jobId, bool _isApproved) external nonReentrant onlyAiAgent atJobStatus(_jobId, Status.WorkSubmitted) {
        Job storage job = jobs[_jobId];
        job.status = Status.Verified;
        emit WorkVerified(_jobId, _isApproved);

        if (_isApproved) {
            _releaseFunds(_jobId);
        } else {
            // For MVP, if work is rejected, we cancel it.
            // Future iterations could involve a dispute/arbitration process.
            job.status = Status.Cancelled;
        }
    }

    // =================================================================
    // Internal Functions
    // =================================================================

    function _releaseFunds(uint256 _jobId) internal {
        Job storage job = jobs[_jobId];
        // A final check on status, although verifyWork controls this flow.
        require(job.status == Status.Verified, "AIEscrow: Job not in verified status for fund release");

        job.status = Status.Completed;
        (bool success, ) = job.freelancer.call{value: job.price}("");
        require(success, "AIEscrow: Failed to release funds to freelancer");

        emit FundsReleased(_jobId, job.freelancer, job.price);
    }
}
