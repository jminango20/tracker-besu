import { ethers, network } from "hardhat";
import { DeploymentUtils } from "../lib/deploymentUtils";
import { getDefaultAdmin } from "../lib/signerUtils";

async function main() {
  const action = process.env.npm_config_action as string; // 'add' or 'remove'
  const role = process.env.npm_config_role as string; // 'admin' or 'authority'
  const targetAddress = process.env.npm_config_address as string;
  
  if (!action || !role || !targetAddress) {
    console.error("❌ Missing required parameters");
    console.log("Usage:");
    console.log("  npm run access-channel-admin:localhost --action=add --role=admin --address=0x1234...");
    console.log("  npm run access-channel-admin:localhost --action=add --role=authority --address=0x1234...");
    console.log("  npm run access-channel-admin:localhost --action=remove --role=admin --address=0x1234...");
    console.log("  npm run access-channel-admin:localhost --action=remove --role=authority --address=0x1234...");
    process.exit(1);
  }
  
  console.log(`Managing AccessChannelManager ${role} on network: ${network.name}`);
  
  const defaultAdminSigner = await getDefaultAdmin();
  const deployments = DeploymentUtils.loadDeployments(network.name);
  const contractAddress = deployments.AccessChannelManager?.address;
  
  if (!contractAddress) {
    throw new Error("AccessChannelManager not found in deployments.");
  }
  
  const contract = await ethers.getContractAt("AccessChannelManager", contractAddress, defaultAdminSigner);
  
  let tx;
  if (role === "admin") {
    if (action === "add") {
      tx = await contract.addChannelAdmin(targetAddress);
      console.log(`✅ Adding channel admin: ${targetAddress}`);
    } else {
      tx = await contract.removeChannelAdmin(targetAddress);
      console.log(`✅ Removing channel admin: ${targetAddress}`);
    }
  } else if (role === "authority") {
    if (action === "add") {
      tx = await contract.addChannelAuthority(targetAddress);
      console.log(`✅ Adding channel authority: ${targetAddress}`);
    } else {
      tx = await contract.removeChannelAuthority(targetAddress);
      console.log(`✅ Removing channel authority: ${targetAddress}`);
    }
  } else {
    throw new Error("Role must be 'admin' or 'authority'");
  }
  
  await tx.wait();
  console.log(`AccessChannelManager ${role} ${action} completed!`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}