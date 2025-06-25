import { ethers } from "hardhat";
import { DeploymentUtils } from "../lib/deploymentUtils";

async function main() {
  const [deployer] = await ethers.getSigners();
  await DeploymentUtils.deployContract("AddressDiscovery", [deployer.address]);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}