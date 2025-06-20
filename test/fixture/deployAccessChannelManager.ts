import hre from "hardhat";

export async function deployAccessChannelManager() {

  const [deployer, user, member1, member2, member3] = await hre.ethers.getSigners();

  // Deploy AccessChannelManager contract
  const AccessChannelManager = await hre.ethers.getContractFactory("AccessChannelManager");
  const accessChannelManager = await AccessChannelManager.deploy();

  // Define test channel names
  const CHANNEL_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_1"));
  const CHANNEL_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_2"));
  const NON_EXISTENT_CHANNEL = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT"));

  // Get role constants
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const CHANNEL_AUTHORITY_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_AUTHORITY_ROLE"));
  const CHANNEL_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_ADMIN_ROLE"));

  return {
    accessChannelManager,
    deployer,
    user,
    member1,
    member2,
    member3,
    CHANNEL_1,
    CHANNEL_2,
    NON_EXISTENT_CHANNEL,
    DEFAULT_ADMIN_ROLE,
    CHANNEL_AUTHORITY_ROLE,
    CHANNEL_ADMIN_ROLE
  };
}