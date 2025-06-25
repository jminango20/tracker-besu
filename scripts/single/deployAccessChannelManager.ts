import { DeploymentUtils } from "../lib/deploymentUtils";

async function main() {
  await DeploymentUtils.deployContract("AccessChannelManager");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}