import hre from "hardhat";

export async function deployAddressDiscovery() {
    const [deployer, admin, otherAdmin, user, contractAddress1, contractAddress2, nonExistentContract] = await hre.ethers.getSigners();

    const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
    const addressDiscovery = await AddressDiscovery.deploy(admin.address);

    await addressDiscovery.waitForDeployment();

    // Set contract addresses for testing
    const CONTRACT_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONTRACT_1"));
    const CONTRACT_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONTRACT_2"));
    const NON_EXISTENT_CONTRACT = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT_CONTRACT"));

    // Get role constants
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const ADDRESS_DISCOVERY_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ADDRESS_DISCOVERY_ADMIN_ROLE"));

    return {
      addressDiscovery,
      deployer,
      admin,
      otherAdmin,
      user,
      CONTRACT_1,
      CONTRACT_2,
      NON_EXISTENT_CONTRACT,
      contractAddress1,
      contractAddress2,
      nonExistentContract,
      DEFAULT_ADMIN_ROLE,
      ADDRESS_DISCOVERY_ADMIN_ROLE
    };
  }