import hre from "hardhat";
import { getTestAccounts } from "../utils/index"; 

export async function deployAccessChannelManager() {

  const { deployer, user, member1, member2, member3 } = await getTestAccounts();
  // Deploy AccessChannelManager contract
  const AccessChannelManager = await hre.ethers.getContractFactory("AccessChannelManager");
  const accessChannelManager = await AccessChannelManager.deploy();

  return {
    accessChannelManager,
    deployer,
    user,
    member1,
    member2,
    member3
  };
}