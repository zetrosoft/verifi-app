
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs.js";
import { expect } from "chai";
import pkg from 'hardhat';
const { ethers } = pkg;

describe("AIEscrowMarketplace", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployAIEscrowMarketplaceFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, aiAgent, client, freelancer] = await ethers.getSigners();
    const jobAmount = ethers.parseEther("1.0");

    const AIEscrowMarketplace = await ethers.getContractFactory("AIEscrowMarketplace");
    const escrowMarketplace = await AIEscrowMarketplace.deploy(aiAgent.address);

    return { escrowMarketplace, owner, aiAgent, client, freelancer, jobAmount };
  }

  describe("Deployment", function () {
    it("Should set the right AI Agent address", async function () {
      const { escrowMarketplace, aiAgent } = await loadFixture(deployAIEscrowMarketplaceFixture);
      expect(await escrowMarketplace.aiAgentAddress()).to.equal(aiAgent.address);
    });

    it("Should set the right owner", async function () {
      const { escrowMarketplace, owner } = await loadFixture(deployAIEscrowMarketplaceFixture);
      expect(await escrowMarketplace.owner()).to.equal(owner.address);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow the owner to set a new AI Agent address", async function () {
      const { escrowMarketplace, owner, client } = await loadFixture(deployAIEscrowMarketplaceFixture);
      const newAiAgentAddress = client.address; // Use another account as the new agent

      await expect(escrowMarketplace.connect(owner).setAiAgentAddress(newAiAgentAddress))
        .to.emit(escrowMarketplace, "AiAgentAddressUpdated")
        .withArgs(newAiAgentAddress);

      expect(await escrowMarketplace.aiAgentAddress()).to.equal(newAiAgentAddress);
    });

    it("Should prevent non-owners from setting a new AI Agent address", async function () {
      const { escrowMarketplace, client } = await loadFixture(deployAIEscrowMarketplaceFixture);
      const newAiAgentAddress = client.address;

      await expect(escrowMarketplace.connect(client).setAiAgentAddress(newAiAgentAddress))
        .to.be.revertedWithCustomError(escrowMarketplace, "OwnableUnauthorizedAccount")
        .withArgs(client.address);
    });
  });

  describe("Job Lifecycle", function () {
    const workDescriptionIPFSHash = "Qm...";
    const resultIPFSHash = "QmResult...";

    it("Should allow a client to create a job", async function () {
      const { escrowMarketplace, client, freelancer, jobAmount } = await loadFixture(deployAIEscrowMarketplaceFixture);
      const jobId = 0;

      await expect(escrowMarketplace.connect(client).createJob(freelancer.address, jobAmount, workDescriptionIPFSHash))
        .to.emit(escrowMarketplace, "JobCreated")
        .withArgs(jobId, client.address, freelancer.address, jobAmount);

      const job = await escrowMarketplace.jobs(jobId);
      expect(job.client).to.equal(client.address);
      expect(job.freelancer).to.equal(freelancer.address);
      expect(job.amount).to.equal(jobAmount);
      expect(job.status).to.equal(0); // Status.Created
    });

    it("Should allow the client to deposit funds", async function () {
      const { escrowMarketplace, client, freelancer, jobAmount } = await loadFixture(deployAIEscrowMarketplaceFixture);
      const jobId = 0;
      await escrowMarketplace.connect(client).createJob(freelancer.address, jobAmount, workDescriptionIPFSHash);

      await expect(escrowMarketplace.connect(client).depositFunds(jobId, { value: jobAmount }))
        .to.emit(escrowMarketplace, "FundsDeposited")
        .withArgs(jobId, jobAmount);

      const job = await escrowMarketplace.jobs(jobId);
      expect(job.status).to.equal(1); // Status.FundsDeposited
      expect(await ethers.provider.getBalance(await escrowMarketplace.getAddress())).to.equal(jobAmount);
    });
    
    it("Should prevent depositing incorrect fund amount", async function () {
        const { escrowMarketplace, client, freelancer, jobAmount } = await loadFixture(deployAIEscrowMarketplaceFixture);
        const jobId = 0;
        await escrowMarketplace.connect(client).createJob(freelancer.address, jobAmount, workDescriptionIPFSHash);
        
        const wrongAmount = ethers.parseEther("0.5");
        await expect(escrowMarketplace.connect(client).depositFunds(jobId, { value: wrongAmount }))
            .to.be.revertedWith("AIEscrow: Incorrect deposit amount");
    });

    it("Should allow the freelancer to submit work", async function () {
      const { escrowMarketplace, client, freelancer, jobAmount } = await loadFixture(deployAIEscrowMarketplaceFixture);
      const jobId = 0;
      await escrowMarketplace.connect(client).createJob(freelancer.address, jobAmount, workDescriptionIPFSHash);
      await escrowMarketplace.connect(client).depositFunds(jobId, { value: jobAmount });

      await expect(escrowMarketplace.connect(freelancer).submitWork(jobId, resultIPFSHash))
        .to.emit(escrowMarketplace, "WorkSubmitted")
        .withArgs(jobId, freelancer.address, resultIPFSHash);

      const job = await escrowMarketplace.jobs(jobId);
      expect(job.resultIPFSHash).to.equal(resultIPFSHash);
      expect(job.status).to.equal(2); // Status.WorkSubmitted
    });

    it("Should allow AI agent to verify and approve work, releasing funds", async function () {
      const { escrowMarketplace, aiAgent, client, freelancer, jobAmount } = await loadFixture(deployAIEscrowMarketplaceFixture);
      const jobId = 0;
      await escrowMarketplace.connect(client).createJob(freelancer.address, jobAmount, workDescriptionIPFSHash);
      await escrowMarketplace.connect(client).depositFunds(jobId, { value: jobAmount });
      await escrowMarketplace.connect(freelancer).submitWork(jobId, resultIPFSHash);

      const freelancerInitialBalance = await ethers.provider.getBalance(freelancer.address);

      const tx = await escrowMarketplace.connect(aiAgent).verifyWork(jobId, true);
      
      await expect(tx)
        .to.emit(escrowMarketplace, "WorkVerified")
        .withArgs(jobId, true);

      await expect(tx)
        .to.emit(escrowMarketplace, "FundsReleased")
        .withArgs(jobId, freelancer.address, jobAmount);
        
      const job = await escrowMarketplace.jobs(jobId);
      expect(job.status).to.equal(4); // Status.Completed

      const freelancerFinalBalance = await ethers.provider.getBalance(freelancer.address);
      expect(freelancerFinalBalance).to.be.gt(freelancerInitialBalance);
      expect(await ethers.provider.getBalance(await escrowMarketplace.getAddress())).to.equal(0);
    });

    it("Should allow AI agent to verify and reject work, cancelling the job", async function () {
      const { escrowMarketplace, aiAgent, client, freelancer, jobAmount } = await loadFixture(deployAIEscrowMarketplaceFixture);
      const jobId = 0;
      await escrowMarketplace.connect(client).createJob(freelancer.address, jobAmount, workDescriptionIPFSHash);
      await escrowMarketplace.connect(client).depositFunds(jobId, { value: jobAmount });
      await escrowMarketplace.connect(freelancer).submitWork(jobId, resultIPFSHash);
      
      await expect(escrowMarketplace.connect(aiAgent).verifyWork(jobId, false))
        .to.emit(escrowMarketplace, "WorkVerified")
        .withArgs(jobId, false);
        
      const job = await escrowMarketplace.jobs(jobId);
      expect(job.status).to.equal(5); // Status.Cancelled

      // Funds remain in the contract for now in MVP. Future version would handle refunds.
      expect(await ethers.provider.getBalance(await escrowMarketplace.getAddress())).to.equal(jobAmount);
    });

     it("Should prevent non-AI agent from verifying work", async function () {
        const { escrowMarketplace, client, freelancer, jobAmount } = await loadFixture(deployAIEscrowMarketplaceFixture);
        const jobId = 0;
        await escrowMarketplace.connect(client).createJob(freelancer.address, jobAmount, workDescriptionIPFSHash);
        await escrowMarketplace.connect(client).depositFunds(jobId, { value: jobAmount });
        await escrowMarketplace.connect(freelancer).submitWork(jobId, resultIPFSHash);

        await expect(escrowMarketplace.connect(client).verifyWork(jobId, true))
            .to.be.revertedWith("AIEscrow: Caller is not the AI Agent");
    });
  });
});
