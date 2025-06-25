// scripts/deploy.ts
import { ethers, network } from "hardhat";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

interface DeploymentInfo {
  contractName: string;
  address: string;
  deployer: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  deploymentArgs: any[];
  timestamp: number;
}

interface NetworkDeployments {
  [contractName: string]: DeploymentInfo;
}

class DeploymentManager {
  private deploymentsDir = "deployments";
  private networkName: string;

  constructor(networkName: string) {
    this.networkName = networkName;
    this.ensureDeploymentsDir();
  }

  private ensureDeploymentsDir() {
    if (!existsSync(this.deploymentsDir)) {
      mkdirSync(this.deploymentsDir, { recursive: true });
    }
  }

  private getDeploymentFilePath(): string {
    return join(this.deploymentsDir, `${this.networkName}.json`);
  }

  public loadDeployments(): NetworkDeployments {
    const filePath = this.getDeploymentFilePath();
    
    if (!existsSync(filePath)) {
      return {};
    }
    
    try {
      const content = readFileSync(filePath, 'utf8').trim();
      
      // Check if file is empty
      if (!content) {
        console.log(`Deployment file is empty, starting fresh...`);
        return {};
      }
      
      const parsed = JSON.parse(content);
      return parsed || {};
      
    } catch (error) {
      console.log(`Invalid JSON in deployment file, starting fresh...`);
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Optionally backup the corrupted file
      const backupPath = `${filePath}.backup.${Date.now()}`;
      try {
        const corruptedContent = readFileSync(filePath, 'utf8');
        writeFileSync(backupPath, corruptedContent);
        console.log(`Backed up corrupted file to: ${backupPath}`);
      } catch (backupError) {
        console.log(`   Could not backup corrupted file`);
      }
      
      return {};
    }
  }

  public saveDeployment(deploymentInfo: DeploymentInfo) {
    const deployments = this.loadDeployments();
    deployments[deploymentInfo.contractName] = deploymentInfo;
    
    const filePath = this.getDeploymentFilePath();
    writeFileSync(filePath, JSON.stringify(deployments, null, 2));
    
    console.log(`✅ Saved deployment info for ${deploymentInfo.contractName} to ${filePath}`);
  }

  public getContractAddress(contractName: string): string | null {
    const deployments = this.loadDeployments();
    return deployments[contractName]?.address || null;
  }

  public clearDeployments() {
    const filePath = this.getDeploymentFilePath();
    try {
      writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
      console.log(`Cleared previous deployments for ${this.networkName}`);
    } catch (error) {
      console.log(`Error clearing deployments: ${error instanceof Error ? error.message : 'Unknown error'}`);
      try {
        if (existsSync(filePath)) {
          const fs = require('fs');
          fs.unlinkSync(filePath);
          console.log(`Deleted corrupted deployment file`);
        }
      } catch (deleteError) {
        console.log(`❌ Could not clear deployment file`);
      }
    }
  }

  public hasExistingDeployments(): boolean {
    const deployments = this.loadDeployments();
    return Object.keys(deployments).length > 0;
  }

  public ensureValidDeploymentFile() {
    const filePath = this.getDeploymentFilePath();
    
    if (!existsSync(filePath)) {
      // Create empty deployment file
      writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
      console.log(`Created fresh deployment file: ${filePath}`);
      return;
    }
    
   try {
      this.loadDeployments();
    } catch (error) {
      console.log(`Fixing corrupted deployment file...`);
      writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
    }
  }
}

async function deployContract(
  contractName: string,
  args: any[] = [],
  deploymentManager: DeploymentManager
) {
  console.log("STARTING DEPLOYMENT");  
  console.log(`\n Deploying ${contractName}...`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const ContractFactory = await ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(...args);
  
  const deploymentTx = contract.deploymentTransaction();
  if (!deploymentTx) {
    throw new Error(`Failed to get deployment transaction for ${contractName}`);
  }
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  // Get transaction receipt for gas info
  const receipt = await deploymentTx.wait();
  if (!receipt) {
    throw new Error(`Failed to get transaction receipt for ${contractName}`);
  }
  
  const deploymentInfo: DeploymentInfo = {
    contractName,
    address: contractAddress,
    deployer: deployer.address,
    transactionHash: deploymentTx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    deploymentArgs: args,
    timestamp: Date.now()
  };
  
  deploymentManager.saveDeployment(deploymentInfo);
  
  console.log(`✅ ${contractName} deployed to: ${contractAddress}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`   Transaction: ${deploymentTx.hash}`);
  
  return contract;
}

async function main() {
  console.log(`\n Deploying to network: ${network.name}`);
  
  const deploymentManager = new DeploymentManager(network.name);
  const [deployer] = await ethers.getSigners();
    
  // Check if contracts are already deployed
  const existingDeployments = deploymentManager.loadDeployments();
  if (Object.keys(existingDeployments).length > 0) {
    console.log(`\n Previous deployments found:`, Object.keys(existingDeployments));
    console.log(`Will deploy fresh contracts and overwrite deployment file...`);
    // Clear the deployment file to start fresh
    deploymentManager.clearDeployments();
  }
  
  try {
    // 1. Deploy AddressDiscovery 
    console.log(`\n Deploying fresh AddressDiscovery...`);
    const addressDiscovery = await deployContract("AddressDiscovery", [deployer.address], deploymentManager);
    
    // 2. Deploy AccessChannelManager
    console.log(`\n Deploying fresh AccessChannelManager...`);
    const accessChannelManager = await deployContract("AccessChannelManager", [], deploymentManager);
    
    // 3. Deploy SchemaRegistry 
    console.log(`\n Deploying fresh SchemaRegistry...`);
    const addressDiscoveryAddress = await addressDiscovery.getAddress();
    const schemaRegistry = await deployContract("SchemaRegistry", [addressDiscoveryAddress], deploymentManager);
    
    console.log(`\n Deployment completed successfully!`);
    console.log(` Deployment info saved to: deployments/${network.name}.json`);
    
    // Display summary
    console.log(`\n Deployment Summary:`);
    console.log(`   AddressDiscovery: ${await addressDiscovery.getAddress()}`);
    console.log(`   AccessChannelManager: ${await accessChannelManager.getAddress()}`);
    console.log(`   SchemaRegistry: ${await schemaRegistry.getAddress()}`);
    
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

export { main as deployAll };