
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";

describe("AIEscrowMarketplace", function () {
  async function deployMarketplaceFixture() {
    const [owner, aiAgent, client, freelancer1, freelancer2] = await hre.ethers.getSigners();

    const AIEscrowMarketplace = await hre.ethers.getContractFactory("AIEscrowMarketplace");
    const marketplace = await AIEscrowMarketplace.deploy(aiAgent.address);

    const jobPrice = hre.ethers.parseEther("1.0");

    return { marketplace, owner, aiAgent, client, freelancer1, freelancer2, jobPrice };
  }

  describe("Deployment", function () {
    it("Should set the right AI Agent address", async function () {
      const { marketplace, aiAgent } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.aiAgentAddress()).to.equal(aiAgent.address);
    });

    it("Should set the right owner", async function () {
      const { marketplace, owner } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.owner()).to.equal(owner.address);
    });
  });

  describe("Job Management", function () {
    it("Should allow a client to post a job", async function () {
        const { marketplace, client, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
    
        await expect(marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline))
            .to.emit(marketplace, "JobPosted")
            .withArgs(0, client.address, "Test Job", jobPrice);
    
        const job = await marketplace.jobs(0);
        expect(job.client).to.equal(client.address);
        expect(job.title).to.equal("Test Job");
        expect(job.price).to.equal(jobPrice);
        expect(job.status).to.equal(0); // Status.Open
    });

    it("Should allow freelancers to submit bids", async function () {
        const { marketplace, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
    
        await expect(marketplace.connect(freelancer1).submitBid(0, "My proposal"))
            .to.emit(marketplace, "BidSubmitted")
            .withArgs(0, 0, freelancer1.address, "My proposal");
    
        const bids = await marketplace.getBidsForJob(0);
        expect(bids.length).to.equal(1);
        expect(bids[0].freelancer).to.equal(freelancer1.address);
    });
    

    it("Should allow the client to accept a bid", async function () {
        const { marketplace, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
    
        await expect(marketplace.connect(client).acceptBid(0, 0))
            .to.emit(marketplace, "BidAccepted")
            .withArgs(0, 0, client.address, freelancer1.address);
    
        const job = await marketplace.jobs(0);
        expect(job.freelancer).to.equal(freelancer1.address);
        expect(job.status).to.equal(1); // Status.Assigned
    });

    it("Should return the correct job count", async function () {
        const { marketplace, client, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
    
        expect(await marketplace.getJobCount()).to.equal(0);
    
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
    
        expect(await marketplace.getJobCount()).to.equal(1);
    });
  });

  describe("Payment Flow", function () {
    
    it("Should allow the client to deposit funds", async function () {
        const { marketplace, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
    
        await expect(marketplace.connect(client).depositForJob(0, { value: jobPrice }))
            .to.emit(marketplace, "FundsDeposited")
            .withArgs(0, jobPrice);
    
        const job = await marketplace.jobs(0);
        expect(job.status).to.equal(2); // Status.FundsDeposited
        const contractBalance = await ethers.provider.getBalance(await marketplace.getAddress());
        expect(contractBalance).to.equal(jobPrice);
    });

    it("Should allow the freelancer to submit work", async function () {
        const { marketplace, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
    
        await expect(marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash"))
            .to.emit(marketplace, "WorkSubmitted")
            .withArgs(0, freelancer1.address, "result_ipfs_hash");
    
        const job = await marketplace.jobs(0);
        expect(job.status).to.equal(3); // Status.WorkSubmitted
        expect(job.resultIPFSHash).to.equal("result_ipfs_hash");
    });
    

    it("Should allow the AI Agent to verify work and approve", async function () {
        const { marketplace, aiAgent, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
    
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");
    
        await expect(marketplace.connect(aiAgent).verifyWork(0, true))
            .to.emit(marketplace, "WorkVerified")
            .withArgs(0, true);
    
        const job = await marketplace.jobs(0);
        expect(job.status).to.equal(4); // Status.Verified
    });
    

    it("Should allow the client to release funds", async function () {
        const { marketplace, aiAgent, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");
        await marketplace.connect(aiAgent).verifyWork(0, true);
    
        const freelancerBalanceBefore = await ethers.provider.getBalance(freelancer1.address);
        
        const tx = await marketplace.connect(client).clientReleaseFunds(0);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * tx.gasPrice;
    
        const freelancerBalanceAfter = await ethers.provider.getBalance(freelancer1.address);
    
        // No need to manually calculate the expected balance after considering gas fees
        // Instead, we can use changeEtherBalance matcher from Waffle
        await expect(tx).to.changeEtherBalance(freelancer1, jobPrice);
        
        const job = await marketplace.jobs(0);
        expect(job.status).to.equal(6); // Status.Completed
    });

    it("Should allow the AI Agent to verify work and reject, refunding the client", async function () {
        const { marketplace, aiAgent, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
    
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");
    
        const clientBalanceBefore = await ethers.provider.getBalance(client.address);
        const tx = await marketplace.connect(aiAgent).verifyWork(0, false);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * tx.gasPrice;
    
        await expect(tx).to.changeEtherBalance(client, jobPrice);
    
        const job = await marketplace.jobs(0);
        expect(job.status).to.equal(7); // Status.Cancelled
    });
    
    
  });

  describe("Dispute Flow", function () {
    
    it("Should allow the client to raise a dispute", async function () {
        const { marketplace, aiAgent, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");
        await marketplace.connect(aiAgent).verifyWork(0, true);
    
        await expect(marketplace.connect(client).raiseDispute(0, "Work not as described"))
            .to.emit(marketplace, "JobDisputed")
            .withArgs(0, client.address, "Work not as described");
    
        const job = await marketplace.jobs(0);
        expect(job.status).to.equal(5); // Status.Disputed
        expect(job.disputeReason).to.equal("Work not as described");
    });

    it("Should allow the AI Agent to resolve a dispute in favor of the freelancer", async function () {
        const { marketplace, aiAgent, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");
        await marketplace.connect(aiAgent).verifyWork(0, true);
        await marketplace.connect(client).raiseDispute(0, "Work not as described");
    
        await expect(marketplace.connect(aiAgent).resolveDispute(0, true))
            .to.emit(marketplace, "DisputeResolved")
            .withArgs(0, true);
        
        const job = await marketplace.jobs(0);
        expect(job.status).to.equal(6); // Status.Completed
    });
    
    it("Should allow the AI Agent to resolve a dispute in favor of the client", async function () {
        const { marketplace, aiAgent, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");
        await marketplace.connect(aiAgent).verifyWork(0, true);
        await marketplace.connect(client).raiseDispute(0, "Work not as described");
    
        const clientBalanceBefore = await ethers.provider.getBalance(client.address);
        const tx = await marketplace.connect(aiAgent).resolveDispute(0, false);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * tx.gasPrice;
    
        await expect(tx).to.changeEtherBalance(client, jobPrice);
    
        const job = await marketplace.jobs(0);
        expect(job.status).to.equal(7); // Status.Cancelled
    });
    
  });

  describe("Access Control", function() {
    it("Should only allow AI agent to verify work", async function() {
        const { marketplace, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");

        await expect(marketplace.connect(client).verifyWork(0, true))
            .to.be.revertedWith("AIEscrow: Caller is not the AI Agent");
    });

    it("Should revert if client accepts bid for non-existent job", async function () {
        const { marketplace, client } = await loadFixture(deployMarketplaceFixture);
        await expect(marketplace.connect(client).acceptBid(999, 0))
            .to.be.revertedWith("AIEscrow: Job does not exist");
    });

    it("Should only allow client to accept bid", async function() {
        const { marketplace, client, freelancer1, freelancer2, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");

        await expect(marketplace.connect(freelancer2).acceptBid(0, 0))
            .to.be.revertedWith("AIEscrow: Caller is not the job client");
    });

    it("Should only allow freelancer to submit work", async function() {
        const { marketplace, client, freelancer1, freelancer2, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });

        await expect(marketplace.connect(freelancer2).submitWork(0, "result_ipfs_hash"))
            .to.be.revertedWith("AIEscrow: Caller is not the job freelancer");
    });

    it("Should revert if freelancer not assigned tries to submit work", async function () {
        const { marketplace, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        // Freelancer is assigned, but try to submit work from a different account (simulating unassigned freelancer for this check)
        await expect(marketplace.connect(client).submitWork(0, "result_ipfs_hash")) // Client is not the freelancer
            .to.be.revertedWith("AIEscrow: Caller is not the job freelancer");
    });

    it("Should revert if non-client tries to deposit for job", async function () {
        const { marketplace, client, freelancer1, freelancer2, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);

        await expect(marketplace.connect(freelancer2).depositForJob(0, { value: jobPrice }))
            .to.be.revertedWith("AIEscrow: Caller is not the job client");
    });

    it("Should revert if non-client tries to raise dispute", async function () {
        const { marketplace, aiAgent, client, freelancer1, freelancer2, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");
        await marketplace.connect(aiAgent).verifyWork(0, true);

        await expect(marketplace.connect(freelancer2).raiseDispute(0, "Reason"))
            .to.be.revertedWith("AIEscrow: Caller is not the job client");
    });

    it("Should revert if non-client tries to release funds", async function () {
        const { marketplace, aiAgent, client, freelancer1, freelancer2, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);
        await marketplace.connect(freelancer1).submitBid(0, "My proposal");
        await marketplace.connect(client).acceptBid(0, 0);
        await marketplace.connect(client).depositForJob(0, { value: jobPrice });
        await marketplace.connect(freelancer1).submitWork(0, "result_ipfs_hash");
        await marketplace.connect(aiAgent).verifyWork(0, true);

        await expect(marketplace.connect(freelancer2).clientReleaseFunds(0))
            .to.be.revertedWith("AIEscrow: Caller is not the job client");
    });

    it("Should only allow actions at the correct job status", async function() {
        const { marketplace, client, freelancer1, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);

        await expect(marketplace.connect(client).depositForJob(0, { value: jobPrice }))
            .to.be.revertedWith("AIEscrow: Job is not in the required status");
    });
  });

  describe("Failure Cases", function() {
    it("Should fail to post a job with an invalid deadline", async function () {
        const { marketplace, client, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) - time.duration.days(7);
    
        await expect(marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline))
            .to.be.revertedWith("AIEscrow: Deadline must be in the future");
    });

    it("Should fail to submit a bid for a non-existent job", async function () {
        const { marketplace, freelancer1 } = await loadFixture(deployMarketplaceFixture);
    
        await expect(marketplace.connect(freelancer1).submitBid(999, "My proposal"))
            .to.be.revertedWith("AIEscrow: Job does not exist");
    });

    it("Should fail if the client tries to bid on their own job", async function () {
        const { marketplace, client, jobPrice } = await loadFixture(deployMarketplaceFixture);
        const deadline = (await time.latest()) + time.duration.days(7);
        await marketplace.connect(client).postJob("Test Job", "ipfs_hash", jobPrice, deadline);

        await expect(marketplace.connect(client).submitBid(0, "My proposal"))
            .to.be.revertedWith("AIEscrow: Client cannot submit a bid on their own job");
    });

    it("Should revert if a non-existent job is accessed by onlyJobClient modifier", async function () {
        const { marketplace, client } = await loadFixture(deployMarketplaceFixture);
        // We're calling a function that uses onlyJobClient with a non-existent jobId
        // The internal check for job.client != address(0) should fail
        await expect(marketplace.connect(client).clientReleaseFunds(999))
            .to.be.revertedWith("AIEscrow: Job does not exist");
    });
  });
});
