import { ethers, network } from "hardhat";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { DeploymentInfo, NetworkDeployments } from "./types";
import { Signer } from "ethers";

export class DeploymentUtils {
  private static deploymentsDir = "deployments";

  private static ensureDeploymentsDir() {
    if (!existsSync(this.deploymentsDir)) {
      mkdirSync(this.deploymentsDir, { recursive: true });
    }
  }

  private static getDeploymentFilePath(networkName: string): string {
    return join(this.deploymentsDir, `${networkName}.json`);
  }

  public static loadDeployments(networkName: string): NetworkDeployments {
    const filePath = this.getDeploymentFilePath(networkName);
    
    if (!existsSync(filePath)) {
      return {};
    }
    
    try {
      const content = readFileSync(filePath, 'utf8').trim();
      if (!content) {
        return {};
      }
      return JSON.parse(content) || {};
    } catch (error) {
      console.log("Creating new deployment file...");
      return {};
    }
  }

  public static saveDeployment(deploymentInfo: DeploymentInfo, networkName: string) {
    this.ensureDeploymentsDir();
    
    const deployments = this.loadDeployments(networkName);
    deployments[deploymentInfo.contractName] = deploymentInfo;
    
    const filePath = this.getDeploymentFilePath(networkName);
    writeFileSync(filePath, JSON.stringify(deployments, null, 2));
    
    console.log(`✅ Saved deployment info to: ${filePath}`);
  }

  public static async deployContract(
    contractName: string,
    args: any[] = []
  ): Promise<DeploymentInfo> {
    const [deployer] = await ethers.getSigners();
    return this.deployContractWithSigner(contractName, args, deployer);
  }

  public static async deployContractWithSigner(
    contractName: string,
    args: any[] = [],
    signer: Signer
  ): Promise<DeploymentInfo> {
    console.log(`\n Deploying ${contractName} to network: ${network.name}`);
    console.log(`Deployer: ${await signer.getAddress()}`);
    
    const ContractFactory = await ethers.getContractFactory(contractName, signer);
    const contract = await ContractFactory.deploy(...args);
    
    const deploymentTx = contract.deploymentTransaction();
    if (!deploymentTx) {
      throw new Error(`Failed to get deployment transaction for ${contractName}`);
    }
    
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    const receipt = await deploymentTx.wait();
    if (!receipt) {
      throw new Error(`Failed to get transaction receipt for ${contractName}`);
    }
    
    console.log(`✅ ${contractName} deployed to: ${contractAddress}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Transaction: ${deploymentTx.hash}`);
    
    const deploymentInfo: DeploymentInfo = {
      contractName,
      address: contractAddress,
      deployer: await signer.getAddress(),
      transactionHash: deploymentTx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      deploymentArgs: args,
      timestamp: Date.now()
    };
    
    this.saveDeployment(deploymentInfo, network.name);
    
    return deploymentInfo;
  }

  public static getContractAddress(contractName: string, networkName: string): string | null {
    const deployments = this.loadDeployments(networkName);
    return deployments[contractName]?.address || null;
  }
}