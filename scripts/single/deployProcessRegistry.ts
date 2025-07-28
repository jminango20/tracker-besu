import { network } from "hardhat";
import { DeploymentUtils } from "../lib/deploymentUtils";
import { getDeployer } from "../lib/signerUtils";

async function main() {
  // Get AddressDiscovery address from deployments
  const addressDiscoveryAddress = DeploymentUtils.getContractAddress("AddressDiscovery", network.name);
  
  if (!addressDiscoveryAddress) {
    throw new Error("AddressDiscovery not deployed. Please deploy it first.");
  }
  
  console.log(`Using AddressDiscovery at: ${addressDiscoveryAddress}`);

  const deployer = await getDeployer();
  // Deploy ProcessRegistry contract with AddressDiscovery address as constructor argument
  await DeploymentUtils.deployContractWithSigner("ProcessRegistry", [addressDiscoveryAddress], deployer);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}