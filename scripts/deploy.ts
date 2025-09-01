// scripts/deploy.ts
import { ethers, network } from "hardhat";
import { DeploymentUtils } from "./lib/deploymentUtils";
import * as dotenv from "dotenv";

const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` });

async function main() {
  console.log(`\n Deploying all contracts to network: ${network.name}`);
  console.log(` Using environment: ${env}`);

  let deployer;

  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  
  if (deployerPrivateKey) {
      console.log(`Using specified deployer private key`);
      // Create signer from private key
      deployer = new ethers.Wallet(deployerPrivateKey, ethers.provider);
      console.log(`Deployer address: ${deployer.address}`);
    } else {
      console.log(`Using default deployer (first signer)`);
      const signers = await ethers.getSigners();
      deployer = signers[0];
      console.log(`Deployer address: ${deployer.address}`);
    }

  try {

    // 1. Deploy AddressDiscovery
    const addressDiscoveryInfo = await DeploymentUtils.deployContractWithSigner("AddressDiscovery", [deployer.address], deployer);

    // 2. Deploy AccessChannelManager
    await DeploymentUtils.deployContractWithSigner("AccessChannelManager", [], deployer);

    // 3. Deploy SchemaRegistry
    await DeploymentUtils.deployContractWithSigner("SchemaRegistry", [addressDiscoveryInfo.address], deployer);

    // 4. Deploy ProcessRegistry
    await DeploymentUtils.deployContractWithSigner("ProcessRegistry", [addressDiscoveryInfo.address], deployer);

    // 5. Deploy AssetRegistry
    await DeploymentUtils.deployContractWithSigner("AssetRegistry", [addressDiscoveryInfo.address], deployer);

    // 6. Deploy TransactionOrchestrator
    await DeploymentUtils.deployContractWithSigner("TransactionOrchestrator", [addressDiscoveryInfo.address], deployer);

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