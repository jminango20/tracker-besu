// scripts/deploy.ts
import { ethers, network } from "hardhat";
import { DeploymentUtils } from "./lib/deploymentUtils";


async function main() {
  console.log(`\n Deploying all contracts to network: ${network.name}`);
  
  const [deployer] = await ethers.getSigners();

  try {

    // 1. Deploy AddressDiscovery
    const addressDiscoveryInfo = await DeploymentUtils.deployContract("AddressDiscovery", [deployer.address]);

    // 2. Deploy AccessChannelManager
    await DeploymentUtils.deployContract("AccessChannelManager");

    // 3. Deploy SchemaRegistry
    await DeploymentUtils.deployContract("SchemaRegistry", [addressDiscoveryInfo.address]);

    console.log(`\n All contracts deployed successfully!`);
    console.log(`Deployment info saved to: deployments/${network.name}.json`);

  } catch (error) {
    console.error(`❌ Deployment failed:`, error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}