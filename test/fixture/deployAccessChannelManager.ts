import hre from "hardhat";

export async function deployAccessChannelManager() {

  // Deploy AccessChannelManager contract
  const AccessChannelManager = await hre.ethers.getContractFactory("AccessChannelManager");
  const accessChannelManager = await AccessChannelManager.deploy();

  await accessChannelManager.waitForDeployment();

  return accessChannelManager;
}