import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
  // TODO: Replace with your actual AI Agent address for deployment
  const initialAiAgentAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Hardhat #0 address as placeholder

  if (initialAiAgentAddress === '0x0000000000000000000000000000000000000000') {
    console.warn(
      'WARNING: initialAiAgentAddress is a placeholder. Please update it in deploy.ts before production deployment.',
    );
  }

  console.log('Deploying AIEscrowMarketplace contract (V2)...');
  console.log(`Using AI Agent Address: ${initialAiAgentAddress}`);

  const escrow = await ethers.deployContract('AIEscrowMarketplace', [initialAiAgentAddress]);

  await escrow.waitForDeployment();

  console.log(`AIEscrowMarketplace contract deployed to: ${escrow.target}`);
  console.log('------------------------------------------------------------------');
  console.log(
    'Deployment complete! Make sure to update your frontend and AI agent configurations with this new contract address.',
  );
  console.log('------------------------------------------------------------------');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
