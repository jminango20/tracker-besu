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
  
  if (
    !addressDiscoveryAddress || 
    !accessChannelManagerAddress || 
    !schemaRegistryAddress ||
    !processRegistryAddress
  ) {
    throw new Error("Missing contract addresses in deployment file");
  }
  
  // Connect to AddressDiscovery
  const addressDiscovery = await ethers.getContractAt("AddressDiscovery", addressDiscoveryAddress, adminSigner);
  
  console.log("Registering contracts in AddressDiscovery...");
  
  // Register AccessChannelManager
  const accessChannelManagerId = ethers.id("AccessChannelManager");
  try {
    const currentACM = await addressDiscovery.getContractAddress(accessChannelManagerId);
    if (currentACM.toLowerCase() !== accessChannelManagerAddress.toLowerCase()) {
      const tx1 = await addressDiscovery.updateAddress(accessChannelManagerId, accessChannelManagerAddress);
      await tx1.wait();
      console.log(`✅ Updated AccessChannelManager address in AddressDiscovery`);
    } else {
      console.log(`ℹ️ AccessChannelManager already registered in AddressDiscovery`);
    }
  } catch (error) {
    const tx1 = await addressDiscovery.updateAddress(accessChannelManagerId, accessChannelManagerAddress);
    await tx1.wait();
    console.log(`✅ Registered AccessChannelManager in AddressDiscovery`);
  }
  
  // Register SchemaRegistry
  const schemaRegistryId = ethers.id("SchemaRegistry");
  try {
    const currentSR = await addressDiscovery.getContractAddress(schemaRegistryId);
    if (currentSR.toLowerCase() !== schemaRegistryAddress.toLowerCase()) {
      const tx2 = await addressDiscovery.updateAddress(schemaRegistryId, schemaRegistryAddress);
      await tx2.wait();
      console.log(`✅ Updated SchemaRegistry address in AddressDiscovery`);
    } else {
      console.log(`ℹ️ SchemaRegistry already registered in AddressDiscovery`);
    }
  } catch (error) {
    const tx2 = await addressDiscovery.updateAddress(schemaRegistryId, schemaRegistryAddress);
    await tx2.wait();
    console.log(`✅ Registered SchemaRegistry in AddressDiscovery`);
  }

  // Register ProcessRegistry
  const processRegistryId = ethers.id("ProcessRegistry");
  try {
    const currentSR = await addressDiscovery.getContractAddress(processRegistryId);
    if (currentSR.toLowerCase() !== processRegistryAddress.toLowerCase()) {
      const tx2 = await addressDiscovery.updateAddress(processRegistryId, processRegistryAddress);
      await tx2.wait();
      console.log(`✅ Updated ProcessRegistry address in AddressDiscovery`);
    } else {
      console.log(`ℹ️ ProcessRegistry already registered in AddressDiscovery`);
    }
  } catch (error) {
    const tx2 = await addressDiscovery.updateAddress(processRegistryId, processRegistryAddress);
    await tx2.wait();
    console.log(`✅ Registered ProcessRegistry in AddressDiscovery`);
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