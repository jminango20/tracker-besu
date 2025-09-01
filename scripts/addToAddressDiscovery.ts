import { ethers, network } from "hardhat";
import { DeploymentUtils } from "./lib/deploymentUtils";
import { getAddressDiscoveryAdmin } from "./lib/signerUtils";

async function main() {
  console.log(` Adding contracts to AddressDiscovery for network: ${network.name}`);

  const adminSigner = await getAddressDiscoveryAdmin();

  const deployments = DeploymentUtils.loadDeployments(network.name);
  
  // Get addresses
  const addressDiscoveryAddress = deployments.AddressDiscovery?.address;
  const accessChannelManagerAddress = deployments.AccessChannelManager?.address;
  const schemaRegistryAddress = deployments.SchemaRegistry?.address;
  const processRegistryAddress = deployments.ProcessRegistry?.address;
  const assetRegistryAddress = deployments.AssetRegistry?.address;
  const transactionOrchestratorAddress = deployments.TransactionOrchestrator?.address;
  
  if (
    !addressDiscoveryAddress || 
    !accessChannelManagerAddress || 
    !schemaRegistryAddress ||
    !processRegistryAddress ||
    !assetRegistryAddress ||
    !transactionOrchestratorAddress
  ) {
    throw new Error("Missing contract addresses in deployment file");
  }
  
  // Connect to AddressDiscovery
  const addressDiscovery = await ethers.getContractAt("AddressDiscovery", addressDiscoveryAddress, adminSigner);
  
  console.log("Registering contracts in AddressDiscovery...");
  
  // Register AccessChannelManager
  const accessChannelManagerId = ethers.id("ACCESS_CHANNEL_MANAGER");
  try {
    const currentACM = await addressDiscovery.getContractAddress(accessChannelManagerId);
    if (currentACM.toLowerCase() !== accessChannelManagerAddress.toLowerCase()) {
      const tx1 = await addressDiscovery.updateAddress(accessChannelManagerId, accessChannelManagerAddress);
      await tx1.wait();
      console.log(`✅ Updated ACCESS_CHANNEL_MANAGER address in AddressDiscovery`);
    } else {
      console.log(`ℹ️ ACCESS_CHANNEL_MANAGER already registered in AddressDiscovery`);
    }
  } catch (error) {
    const tx1 = await addressDiscovery.updateAddress(accessChannelManagerId, accessChannelManagerAddress);
    await tx1.wait();
    console.log(`✅ Registered ACCESS_CHANNEL_MANAGER in AddressDiscovery`);
  }
  
  // Register SchemaRegistry
  const schemaRegistryId = ethers.id("SCHEMA_REGISTRY");
  try {
    const currentSR = await addressDiscovery.getContractAddress(schemaRegistryId);
    if (currentSR.toLowerCase() !== schemaRegistryAddress.toLowerCase()) {
      const tx2 = await addressDiscovery.updateAddress(schemaRegistryId, schemaRegistryAddress);
      await tx2.wait();
      console.log(`✅ Updated SCHEMA_REGISTRY address in AddressDiscovery`);
    } else {
      console.log(`ℹ️ SCHEMA_REGISTRY already registered in AddressDiscovery`);
    }
  } catch (error) {
    const tx2 = await addressDiscovery.updateAddress(schemaRegistryId, schemaRegistryAddress);
    await tx2.wait();
    console.log(`✅ Registered SCHEMA_REGISTRY in AddressDiscovery`);
  }

  // Register ProcessRegistry
  const processRegistryId = ethers.id("PROCESS_REGISTRY");
  try {
    const currentSR = await addressDiscovery.getContractAddress(processRegistryId);
    if (currentSR.toLowerCase() !== processRegistryAddress.toLowerCase()) {
      const tx2 = await addressDiscovery.updateAddress(processRegistryId, processRegistryAddress);
      await tx2.wait();
      console.log(`✅ Updated PROCESS_REGISTRY address in AddressDiscovery`);
    } else {
      console.log(`ℹ️ PROCESS_REGISTRY already registered in AddressDiscovery`);
    }
  } catch (error) {
    const tx2 = await addressDiscovery.updateAddress(processRegistryId, processRegistryAddress);
    await tx2.wait();
    console.log(`✅ Registered PROCESS_REGISTRY in AddressDiscovery`);
  }

  // Asset ProcessRegistry
  const assetRegistryId = ethers.id("ASSET_REGISTRY");
  try {
    const currentSR = await addressDiscovery.getContractAddress(assetRegistryId);
    if (currentSR.toLowerCase() !== assetRegistryAddress.toLowerCase()) {
      const tx2 = await addressDiscovery.updateAddress(assetRegistryId, assetRegistryAddress);
      await tx2.wait();
      console.log(`✅ Updated ASSET_REGISTRY address in AddressDiscovery`);
    } else {
      console.log(`ℹ️ ASSET_REGISTRY already registered in AddressDiscovery`);
    }
  } catch (error) {
    const tx2 = await addressDiscovery.updateAddress(assetRegistryId, assetRegistryAddress);
    await tx2.wait();
    console.log(`✅ Registered ASSET_REGISTRY in AddressDiscovery`);
  }

  // Asset ProcessRegistry
  const transactionOrchestratorId = ethers.id("TRANSACTION_ORCHESTRATOR");
  try {
    const currentSR = await addressDiscovery.getContractAddress(transactionOrchestratorId);
    if (currentSR.toLowerCase() !== transactionOrchestratorAddress.toLowerCase()) {
      const tx2 = await addressDiscovery.updateAddress(transactionOrchestratorId, transactionOrchestratorAddress);
      await tx2.wait();
      console.log(`✅ Updated TRANSACTION_ORCHESTRATOR address in AddressDiscovery`);
    } else {
      console.log(`ℹ️ TRANSACTION_ORCHESTRATOR already registered in AddressDiscovery`);
    }
  } catch (error) {
    const tx2 = await addressDiscovery.updateAddress(transactionOrchestratorId, transactionOrchestratorAddress);
    await tx2.wait();
    console.log(`✅ Registered TRANSACTION_ORCHESTRATOR in AddressDiscovery`);
  }
  
  console.log(`Setup completed successfully!`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}