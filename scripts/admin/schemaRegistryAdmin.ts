import { ethers, network } from "hardhat";
import { DeploymentUtils } from "../lib/deploymentUtils";
import { getDefaultAdmin } from "../lib/signerUtils";

async function main() {
  const action = process.env.npm_config_action as string; // 'add' or 'remove'
  const targetAddress = process.env.npm_config_address as string;
  
  if (!action || !targetAddress) {
    console.error("❌ Missing required parameters");
    console.log("Usage:");
    console.log("  npm run schema-registry-admin:localhost --action=add --address=0x1234...");
    console.log("  npm run schema-registry-admin:localhost --action=remove --address=0x1234...");
    process.exit(1);
  }
  
  console.log(`Managing SchemaRegistry admin on network: ${network.name}`);
  
  const defaultAdminSigner = await getDefaultAdmin();
  const deployments = DeploymentUtils.loadDeployments(network.name);
  const contractAddress = deployments.SchemaRegistry?.address;
  
  if (!contractAddress) {
    throw new Error("SchemaRegistry not found in deployments.");
  }
  
  const contract = await ethers.getContractAt("SchemaRegistry", contractAddress, defaultAdminSigner);
  
  let tx;
  if (action === "add") {
    tx = await contract.addSchemaAdmin(targetAddress);
    console.log(`✅ Adding schema admin: ${targetAddress}`);
  } else if (action === "remove") {
    tx = await contract.removeSchemaAdmin(targetAddress);
    console.log(`✅ Removing schema admin: ${targetAddress}`);
  } else {
    throw new Error("Action must be 'add' or 'remove'");
  }
  
  await tx.wait();
  console.log(`SchemaRegistry admin ${action} completed!`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}