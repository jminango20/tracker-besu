import { DeploymentUtils } from "../lib/deploymentUtils";
import { getDeployer } from "../lib/signerUtils";

async function main() {
  const deployer = await getDeployer();
  await DeploymentUtils.deployContractWithSigner("AddressDiscovery", [deployer.address], deployer);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}