import { ethers } from "hardhat";

async function main() {
  const [client, freelancer] = await ethers.getSigners();
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Ganti dengan alamat kontrak Anda
  const contractABI = require("../artifacts/contracts/AIEscrowMarketplace.sol/AIEscrowMarketplace.json").abi;

  const contract = new ethers.Contract(contractAddress, contractABI, client); // Connect as client initially

  const jobId = 0; // Asumsi job pertama yang Anda posting memiliki ID 0
  const jobPrice = ethers.parseEther("0.5"); // Sesuaikan dengan harga job yang Anda posting

  console.log(`Simulating progress for Job ID: ${jobId}`);
  console.log(`Client: ${client.address}`);
  console.log(`Freelancer: ${freelancer.address}`);

  // 1. Freelancer submits a bid
  console.log("1. Freelancer submits a bid...");
  const freelancerContract = contract.connect(freelancer);
  await freelancerContract.submitBid(jobId, "Saya siap mengerjakan proyek ini!");
  console.log("   Bid submitted.");

  // 2. Client accepts the bid...
  console.log("2. Client accepts the bid...");
  let bids;
  try {
    bids = await contract.getBidsForJob(jobId);
    console.log("Decoded bids from getBidsForJob (raw):", bids); // Diagnostic log
    console.log("Number of bids:", bids.length);

    if (bids.length === 0) {
      throw new Error("No bids found for the job. Cannot accept bid.");
    }
  } catch (e: any) {
    console.error("Error calling getBidsForJob:", e.message);
    console.error("This might indicate an ABI mismatch or decoding issue.");
    throw e; // Re-throw the error to stop execution
  }

  const bidId = bids[0].bidId; // Ambil bidId dari bid pertama
  await contract.acceptBid(jobId, bidId);
  console.log("   Bid accepted.");

  // 3. Client deposits funds
  console.log("3. Client deposits funds...");
  await contract.depositForJob(jobId, { value: jobPrice });
  console.log("   Funds deposited.");

  // 4. Freelancer submits work
  console.log("4. Freelancer submits work...");
  await freelancerContract.submitWork(jobId, "ipfs://QmWgX... (hash hasil kerja)"); // Ganti dengan hash IPFS dummy
  console.log("   Work submitted.");

  console.log("Script simulasi selesai. AI Agent akan memverifikasi pekerjaan.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
