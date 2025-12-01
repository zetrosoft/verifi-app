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
        Created,
        FundsDeposited,
        WorkSubmitted,
        Verified,
        Completed,
        Cancelled // Untuk penanganan sengketa di masa depan
    }

    struct Job {
        address payable client;
        address payable freelancer;
        uint256 amount;
        string workDescriptionIPFSHash;
        string resultIPFSHash;
        Status status;
    }

    mapping(uint256 => Job) public jobs;

    // =================================================================
    // Events
    // =================================================================

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event FundsDeposited(uint256 indexed jobId, uint256 amount);
    event WorkSubmitted(uint256 indexed jobId, address indexed freelancer, string resultIPFSHash);
    event WorkVerified(uint256 indexed jobId, bool isApproved);
    event FundsReleased(uint256 indexed jobId, address indexed recipient, uint256 amount);
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

    function createJob(address payable _freelancer, uint256 _amount, string memory _workDescriptionIPFSHash) external {
        require(_freelancer != address(0), "AIEscrow: Invalid freelancer address");
        require(_amount > 0, "AIEscrow: Amount must be greater than zero");
        require(bytes(_workDescriptionIPFSHash).length > 0, "AIEscrow: Work description IPFS hash cannot be empty");

        uint256 jobId = nextJobId;
        jobs[jobId] = Job({
            client: payable(msg.sender),
            freelancer: _freelancer,
            amount: _amount,
            workDescriptionIPFSHash: _workDescriptionIPFSHash,
            resultIPFSHash: "",
            status: Status.Created
        });

        nextJobId++;
        emit JobCreated(jobId, msg.sender, _freelancer, _amount);
    }

    function depositFunds(uint256 _jobId) external payable nonReentrant onlyJobClient(_jobId) atJobStatus(_jobId, Status.Created) {
        Job storage job = jobs[_jobId];
        require(msg.value == job.amount, "AIEscrow: Incorrect deposit amount");

        job.status = Status.FundsDeposited;
        emit FundsDeposited(_jobId, msg.value);
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
        (bool success, ) = job.freelancer.call{value: job.amount}("");
        require(success, "AIEscrow: Failed to release funds to freelancer");

        emit FundsReleased(_jobId, job.freelancer, job.amount);
    }
}
