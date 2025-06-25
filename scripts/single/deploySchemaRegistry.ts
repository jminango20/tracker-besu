import { network } from "hardhat";
import { DeploymentUtils } from "../lib/deploymentUtils";

async function main() {
  // Get AddressDiscovery address from deployments
  const addressDiscoveryAddress = DeploymentUtils.getContractAddress("AddressDiscovery", network.name);
  
  if (!addressDiscoveryAddress) {
    throw new Error("AddressDiscovery not deployed. Please deploy it first.");
  }
  
  console.log(`Using AddressDiscovery at: ${addressDiscoveryAddress}`);
  
  await DeploymentUtils.deployContract("SchemaRegistry", [addressDiscoveryAddress]);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}