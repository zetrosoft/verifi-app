import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { AIEscrowMarketplace } from '../typechain-types';

describe('AIEscrowMarketplace V2', function () {
  let aiEscrowMarketplace: AIEscrowMarketplace;

  let client: SignerWithAddress;
  let freelancer1: SignerWithAddress;
  let freelancer2: SignerWithAddress;
  let aiAgent: SignerWithAddress;

  const JOB_TITLE = 'Develop a DApp Frontend';
  const JOB_DESCRIPTION_IPFS_HASH = 'QmDescriptionHash123';
  const JOB_PRICE = ethers.parseEther('1'); // 1 ETH
  const JOB_DEADLINE = Math.floor(Date.now() / 1000) + 3600 * 24 * 7; // 7 days from now

  beforeEach(async function () {
    [client, freelancer1, freelancer2, aiAgent, ..._addrs] = await ethers.getSigners();

    const AIEscrowMarketplaceFactory = await ethers.getContractFactory('AIEscrowMarketplace');
    aiEscrowMarketplace = (await AIEscrowMarketplaceFactory.deploy(aiAgent.address)) as AIEscrowMarketplace;
    await aiEscrowMarketplace.waitForDeployment();
  });

  describe('Job Posting', function () {
    it('Should allow a client to post a new job', async function () {
      await expect(
        aiEscrowMarketplace.connect(client).postJob(JOB_TITLE, JOB_DESCRIPTION_IPFS_HASH, JOB_PRICE, JOB_DEADLINE),
      )
        .to.emit(aiEscrowMarketplace, 'JobPosted')
        .withArgs(0, client.address, JOB_TITLE, JOB_PRICE);

      const job = await aiEscrowMarketplace.jobs(0);
      expect(job.client).to.equal(client.address);
      expect(job.title).to.equal(JOB_TITLE);
      expect(job.price).to.equal(JOB_PRICE);
      expect(job.deadline).to.equal(JOB_DEADLINE);
      expect(job.status).to.equal(0); // Status.Open
    });

    it('Should not allow posting a job with empty title or description', async function () {
      await expect(
        aiEscrowMarketplace.connect(client).postJob('', JOB_DESCRIPTION_IPFS_HASH, JOB_PRICE, JOB_DEADLINE),
      ).to.be.revertedWith('AIEscrow: Job title cannot be empty');

      await expect(
        aiEscrowMarketplace.connect(client).postJob(JOB_TITLE, '', JOB_PRICE, JOB_DEADLINE),
      ).to.be.revertedWith('AIEscrow: Work description IPFS hash cannot be empty');
    });

    it('Should not allow posting a job with zero price or past deadline', async function () {
      await expect(
        aiEscrowMarketplace.connect(client).postJob(JOB_TITLE, JOB_DESCRIPTION_IPFS_HASH, 0, JOB_DEADLINE),
      ).to.be.revertedWith('AIEscrow: Price must be greater than zero');

      await expect(
        aiEscrowMarketplace
          .connect(client)
          .postJob(JOB_TITLE, JOB_DESCRIPTION_IPFS_HASH, JOB_PRICE, Math.floor(Date.now() / 1000) - 100),
      ).to.be.revertedWith('AIEscrow: Deadline must be in the future');
    });
  });

  describe('Bidding', function () {
    let jobId: number;

    beforeEach(async function () {
      await aiEscrowMarketplace.connect(client).postJob(JOB_TITLE, JOB_DESCRIPTION_IPFS_HASH, JOB_PRICE, JOB_DEADLINE);
      jobId = 0;
    });

    it('Should allow a freelancer to submit a bid', async function () {
      const PROPOSAL_TEXT = 'I can do this for you!';
      await expect(aiEscrowMarketplace.connect(freelancer1).submitBid(jobId, PROPOSAL_TEXT))
        .to.emit(aiEscrowMarketplace, 'BidSubmitted')
        .withArgs(jobId, 0, freelancer1.address, PROPOSAL_TEXT);

      const bids = await aiEscrowMarketplace.bidsByJobId(jobId);
      expect(bids.length).to.equal(1);
      expect(bids[0].freelancer).to.equal(freelancer1.address);
      expect(bids[0].proposalText).to.equal(PROPOSAL_TEXT);
    });

    it('Should not allow submitting a bid for a non-existent job', async function () {
      await expect(
        aiEscrowMarketplace.connect(freelancer1).submitBid(
          999, // non-existent jobId
          'Proposal',
        ),
      ).to.be.revertedWith('AIEscrow: Job does not exist');
    });

    it('Should not allow submitting a bid for a job not in Open status', async function () {
      // First accept a bid, changing status to Assigned
      await aiEscrowMarketplace.connect(freelancer1).submitBid(jobId, 'Proposal 1');
      await aiEscrowMarketplace.connect(client).acceptBid(jobId, 0);

      await expect(aiEscrowMarketplace.connect(freelancer2).submitBid(jobId, 'Proposal 2')).to.be.revertedWith(
        'AIEscrow: Job is not open for bidding',
      );
    });

    it('Should not allow the client to submit a bid on their own job', async function () {
      await expect(aiEscrowMarketplace.connect(client).submitBid(jobId, "Client's proposal")).to.be.revertedWith(
        'AIEscrow: Client cannot submit a bid on their own job',
      );
    });

    it('Should allow multiple freelancers to submit bids', async function () {
      await aiEscrowMarketplace.connect(freelancer1).submitBid(jobId, 'Proposal 1');
      await aiEscrowMarketplace.connect(freelancer2).submitBid(jobId, 'Proposal 2');

      const bids = await aiEscrowMarketplace.bidsByJobId(jobId);
      expect(bids.length).to.equal(2);
      expect(bids[0].freelancer).to.equal(freelancer1.address);
      expect(bids[1].freelancer).to.equal(freelancer2.address);
    });
  });

  describe('Bid Acceptance', function () {
    let jobId: number;
    let bidId1: number;
    let bidId2: number;

    beforeEach(async function () {
      await aiEscrowMarketplace.connect(client).postJob(JOB_TITLE, JOB_DESCRIPTION_IPFS_HASH, JOB_PRICE, JOB_DEADLINE);
      jobId = 0;

      await aiEscrowMarketplace.connect(freelancer1).submitBid(jobId, 'Proposal by F1');
      bidId1 = 0;
      await aiEscrowMarketplace.connect(freelancer2).submitBid(jobId, 'Proposal by F2');
      bidId2 = 1;
    });

    it('Should allow the client to accept a valid bid', async function () {
      await expect(aiEscrowMarketplace.connect(client).acceptBid(jobId, bidId1))
        .to.emit(aiEscrowMarketplace, 'BidAccepted')
        .withArgs(jobId, bidId1, client.address, freelancer1.address);

      const job = await aiEscrowMarketplace.jobs(jobId);
      expect(job.freelancer).to.equal(freelancer1.address);
      expect(job.status).to.equal(1); // Status.Assigned
      expect(await aiEscrowMarketplace.jobsByFreelancer(freelancer1.address)).to.include(jobId);
    });

    it('Should not allow accepting a bid for a non-existent job', async function () {
      await expect(aiEscrowMarketplace.connect(client).acceptBid(999, bidId1)).to.be.revertedWith(
        'AIEscrow: Job does not exist',
      );
    });

    it('Should not allow accepting a bid if not the job client', async function () {
      await expect(aiEscrowMarketplace.connect(freelancer1).acceptBid(jobId, bidId1)).to.be.revertedWith(
        'AIEscrow: Caller is not the job client',
      );
    });

    it('Should not allow accepting a bid if job is not in Open status', async function () {
      await aiEscrowMarketplace.connect(client).acceptBid(jobId, bidId1); // First acceptance
      await expect(aiEscrowMarketplace.connect(client).acceptBid(jobId, bidId2)) // Try to accept another
        .to.be.revertedWith('AIEscrow: Job is not open for bidding');
    });

    it('Should not allow accepting an invalid bid ID', async function () {
      await expect(aiEscrowMarketplace.connect(client).acceptBid(jobId, 999)).to.be.revertedWith(
        'AIEscrow: Invalid bid ID',
      );
    });
  });

  describe('Fund Deposit', function () {
    let jobId: number;

    beforeEach(async function () {
      await aiEscrowMarketplace.connect(client).postJob(JOB_TITLE, JOB_DESCRIPTION_IPFS_HASH, JOB_PRICE, JOB_DEADLINE);
      jobId = 0;
      await aiEscrowMarketplace.connect(freelancer1).submitBid(jobId, 'Proposal by F1');
      await aiEscrowMarketplace.connect(client).acceptBid(jobId, 0); // Job status -> Assigned
    });

    it('Should allow the client to deposit funds for an assigned job', async function () {
      await expect(aiEscrowMarketplace.connect(client).depositForJob(jobId, { value: JOB_PRICE }))
        .to.emit(aiEscrowMarketplace, 'FundsDeposited')
        .withArgs(jobId, JOB_PRICE);

      const job = await aiEscrowMarketplace.jobs(jobId);
      expect(job.status).to.equal(2); // Status.FundsDeposited
    });

    it('Should not allow depositing funds if not the job client', async function () {
      await expect(
        aiEscrowMarketplace.connect(freelancer1).depositForJob(jobId, { value: JOB_PRICE }),
      ).to.be.revertedWith('AIEscrow: Caller is not the job client');
    });

    it('Should not allow depositing incorrect amount', async function () {
      await expect(
        aiEscrowMarketplace.connect(client).depositForJob(jobId, { value: ethers.parseEther('0.5') }),
      ).to.be.revertedWith('AIEscrow: Incorrect deposit amount');
    });

    it('Should not allow depositing funds if job is not in Assigned status', async function () {
      // Change status to FundsDeposited
      await aiEscrowMarketplace.connect(client).depositForJob(jobId, { value: JOB_PRICE });

      await expect(aiEscrowMarketplace.connect(client).depositForJob(jobId, { value: JOB_PRICE })).to.be.revertedWith(
        'AIEscrow: Job is not in the required status',
      );
    });
  });

  describe('Work Submission & Verification', function () {
    let jobId: number;
    const RESULT_IPFS_HASH = 'QmResultHash456';

    beforeEach(async function () {
      await aiEscrowMarketplace.connect(client).postJob(JOB_TITLE, JOB_DESCRIPTION_IPFS_HASH, JOB_PRICE, JOB_DEADLINE);
      jobId = 0;
      await aiEscrowMarketplace.connect(freelancer1).submitBid(jobId, 'Proposal by F1');
      await aiEscrowMarketplace.connect(client).acceptBid(jobId, 0); // Job status -> Assigned
      await aiEscrowMarketplace.connect(client).depositForJob(jobId, { value: JOB_PRICE }); // Job status -> FundsDeposited
    });

    it('Should allow freelancer to submit work', async function () {
      await expect(aiEscrowMarketplace.connect(freelancer1).submitWork(jobId, RESULT_IPFS_HASH))
        .to.emit(aiEscrowMarketplace, 'WorkSubmitted')
        .withArgs(jobId, freelancer1.address, RESULT_IPFS_HASH);

      const job = await aiEscrowMarketplace.jobs(jobId);
      expect(job.resultIPFSHash).to.equal(RESULT_IPFS_HASH);
      expect(job.status).to.equal(3); // Status.WorkSubmitted
    });

    it('Should not allow submitting work if not the job freelancer', async function () {
      await expect(aiEscrowMarketplace.connect(freelancer2).submitWork(jobId, RESULT_IPFS_HASH)).to.be.revertedWith(
        'AIEscrow: Caller is not the job freelancer',
      );
    });

    it('Should not allow submitting work for job not in FundsDeposited status', async function () {
      const job = await aiEscrowMarketplace.jobs(jobId);
      // Manually change status to test
      job.status = 0; // Status.Open
      await expect(aiEscrowMarketplace.connect(freelancer1).submitWork(jobId, RESULT_IPFS_HASH)).to.be.revertedWith(
        'AIEscrow: Job is not in the required status',
      );
    });

    it('Should allow AI Agent to verify work and release funds if approved', async function () {
      await aiEscrowMarketplace.connect(freelancer1).submitWork(jobId, RESULT_IPFS_HASH);

      const initialFreelancerBalance = await ethers.provider.getBalance(freelancer1.address);

      await expect(aiEscrowMarketplace.connect(aiAgent).verifyWork(jobId, true))
        .to.emit(aiEscrowMarketplace, 'WorkVerified')
        .withArgs(jobId, true)
        .and.to.emit(aiEscrowMarketplace, 'FundsReleased')
        .withArgs(jobId, freelancer1.address, JOB_PRICE);

      const job = await aiEscrowMarketplace.jobs(jobId);
      expect(job.status).to.equal(4); // Status.Completed (after _releaseFunds completes)

      const finalFreelancerBalance = await ethers.provider.getBalance(freelancer1.address);
      expect(finalFreelancerBalance - initialFreelancerBalance).to.be.closeTo(JOB_PRICE, ethers.parseEther('0.0001')); // Allowing small gas fee diff
    });

    it('Should allow AI Agent to verify work and cancel job if rejected', async function () {
      await aiEscrowMarketplace.connect(freelancer1).submitWork(jobId, RESULT_IPFS_HASH);
      await expect(aiEscrowMarketplace.connect(aiAgent).verifyWork(jobId, false))
        .to.emit(aiEscrowMarketplace, 'WorkVerified')
        .withArgs(jobId, false);

      const job = await aiEscrowMarketplace.jobs(jobId);
      expect(job.status).to.equal(5); // Status.Cancelled
    });

    it('Should not allow non-AI Agent to verify work', async function () {
      await aiEscrowMarketplace.connect(freelancer1).submitWork(jobId, RESULT_IPFS_HASH);
      await expect(aiEscrowMarketplace.connect(client).verifyWork(jobId, true)).to.be.revertedWith(
        'AIEscrow: Caller is not the AI Agent',
      );
    });
  });
});
