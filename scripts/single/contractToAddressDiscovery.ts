// scripts/single/contractToAddressDiscovery.ts
import { ethers, network } from "hardhat";
import { DeploymentUtils } from "../lib/deploymentUtils";
import { getAddressDiscoveryAdmin } from "../lib/signerUtils";

async function main() {
  // Get contract name from npm config
  const contractName = process.env.npm_config_contract as string;
  
  if (!contractName) {
    console.error("❌ Please provide --contract argument");
    console.log("Usage examples:");
    console.log(" npm run address-discovery:single-contract:localhost --contract=ContractName");
    process.exit(1);
  }
  
  console.log(`Adding ${contractName} to AddressDiscovery on network: ${network.name}`);
  
  const adminSigner = await getAddressDiscoveryAdmin();
  
  const deployments = DeploymentUtils.loadDeployments(network.name);
  
  const addressDiscoveryAddress = deployments.AddressDiscovery?.address;
  if (!addressDiscoveryAddress) {
    throw new Error("AddressDiscovery not found in deployments. Please deploy it first.");
  }
  
  // Get contract address
  const contractAddress = deployments[contractName]?.address;
  if (!contractAddress) {
    throw new Error(`${contractName} not found in deployments. Please deploy it first.`);
  }
  
  console.log(` Found ${contractName} at: ${contractAddress}`);
  console.log(` Using AddressDiscovery at: ${addressDiscoveryAddress}`);
  
  // Connect to AddressDiscovery with admin signer
  const addressDiscovery = await ethers.getContractAt("AddressDiscovery", addressDiscoveryAddress, adminSigner);
  
  // Register contract
  const contractId = ethers.id(contractName);
  console.log(`Registering ${contractName} in AddressDiscovery...`);
  
  try {
    const currentAddress = await addressDiscovery.getContractAddress(contractId);
    if (currentAddress.toLowerCase() === contractAddress.toLowerCase()) {
      console.log(`ℹ️ ${contractName} already registered with correct address`);
    } else {
      console.log(`⚠️ ${contractName} registered with different address, updating...`);
      const tx = await addressDiscovery.updateAddress(contractId, contractAddress);
      await tx.wait();
      console.log(`✅ Updated ${contractName} address in AddressDiscovery`);
    }
  } catch (error) {
    // Contract not registered, register it
    const tx = await addressDiscovery.updateAddress(contractId, contractAddress);
    await tx.wait();
    console.log(`✅ Registered ${contractName} in AddressDiscovery`);
  }
  
  console.log(`${contractName} successfully added to AddressDiscovery!`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}