import { ethers } from "hardhat";

async function main() {
  // Load environment variables
  const initialAiAgentAddress = process.env.AI_AGENT_ADDRESS;
  const initialAiAgentFeeWallet = process.env.AI_AGENT_FEE_WALLET;

  // Basic validation
  if (!initialAiAgentAddress) {
    throw new Error("AI_AGENT_ADDRESS is not set in your .env file.");
  }
  if (!initialAiAgentFeeWallet) {
    throw new Error("AI_AGENT_FEE_WALLET is not set in your .env file.");
  }
  
  console.log('Deploying AIEscrowMarketplace contract...');
  console.log(`Using AI Agent Address: ${initialAiAgentAddress}`);
  console.log(`Using AI Agent Fee Wallet Address: ${initialAiAgentFeeWallet}`);

  const AIEscrowMarketplace = await ethers.getContractFactory('AIEscrowMarketplace');
  const escrow = await AIEscrowMarketplace.deploy(initialAiAgentAddress, initialAiAgentFeeWallet);

  await escrow.waitForDeployment();

  console.log(`AIEscrowMarketplace contract deployed to: ${escrow.target}`);
  console.log('------------------------------------------------------------------');
  console.log(
    'Deployment complete! Update your frontend and AI agent .env files with this new contract address.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});