import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
  const initialAiAgentAddress = "0x63F0028E2fE0Aa5c5fbb3ac7A270B5fefcC497FA";

  console.log("Deploying AIEscrowMarketplace contract...");
  console.log(`The address for the AI Agent will be: ${initialAiAgentAddress}`);
  
  const escrow = await ethers.deployContract("AIEscrowMarketplace", [initialAiAgentAddress]);

  await escrow.waitForDeployment();

  console.log(`AIEscrowMarketplace contract deployed to: ${escrow.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
