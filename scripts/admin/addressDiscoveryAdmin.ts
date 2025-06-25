import { ethers, network } from "hardhat";
import { DeploymentUtils } from "../lib/deploymentUtils";
import { getAddressDiscoveryAdmin } from "../lib/signerUtils";

async function main() {
  const action = process.env.npm_config_action as string; // 'add' or 'remove'
  const targetAddress = process.env.npm_config_address as string;
  
  if (!action || !targetAddress) {
    console.error("❌ Missing required parameters");
    console.log("Usage:");
    console.log("  npm run address-discovery-admin:localhost --action=add --address=0x1234...");
    console.log("  npm run address-discovery-admin:localhost --action=remove --address=0x1234...");
    process.exit(1);
  }
  
  console.log(`Managing AddressDiscovery admin on network: ${network.name}`);
  
  const adminSigner = await getAddressDiscoveryAdmin();
  const deployments = DeploymentUtils.loadDeployments(network.name);
  const contractAddress = deployments.AddressDiscovery?.address;
  
  if (!contractAddress) {
    throw new Error("AddressDiscovery not found in deployments.");
  }
  
  const contract = await ethers.getContractAt("AddressDiscovery", contractAddress, adminSigner);
  
  let tx;
  if (action === "add") {
    tx = await contract.addAdmin(targetAddress);
    console.log(`✅ Adding admin: ${targetAddress}`);
  } else if (action === "remove") {
    tx = await contract.removeAdmin(targetAddress);
    console.log(`✅ Removing admin: ${targetAddress}`);
  } else {
    throw new Error("Action must be 'add' or 'remove'");
  }
  
  await tx.wait();
  console.log(`AddressDiscovery admin ${action} completed!`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
