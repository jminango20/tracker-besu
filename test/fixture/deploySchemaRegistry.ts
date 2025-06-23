import hre from "hardhat";

export async function deploySchemaRegistry() {
  // Get test accounts
  const [deployer, user, member1, member2] = await hre.ethers.getSigners();

  // Deploy AddressDiscovery first
  const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
  const addressDiscovery = await AddressDiscovery.deploy(deployer.address);

  // Deploy AccessChannelManager
  const AccessChannelManager = await hre.ethers.getContractFactory("AccessChannelManager");
  const accessChannelManager = await AccessChannelManager.deploy();

  // Register AccessChannelManager in AddressDiscovery
  const ACCESS_CHANNEL_MANAGER = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ACCESS_CHANNEL_MANAGER"));
  await addressDiscovery.connect(deployer).updateAddress(ACCESS_CHANNEL_MANAGER, accessChannelManager.target);

  // Deploy SchemaRegistry
  const SchemaRegistry = await hre.ethers.getContractFactory("SchemaRegistry");
  const schemaRegistry = await SchemaRegistry.deploy(addressDiscovery.target);

  // Define test channel names
  const CHANNEL_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_1"));
  const CHANNEL_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_2"));

  // Create test channel and add members
  await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
  await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

  // Define test schema data
  const SCHEMA_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_1"));
  const SCHEMA_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_2"));
  const NON_EXISTENT_SCHEMA = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT"));

  const DATA_HASH_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data_hash_1"));
  const DATA_HASH_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data_hash_2"));

  const schemaInput = {
    id: SCHEMA_1,
    name: "Test Schema",
    version: 1,
    dataHash: DATA_HASH_1,
    channelName: CHANNEL_1,
    description: "Test schema description"
  };

  const schemaUpdateInput = {
    id: SCHEMA_1,
    newVersion: 2,
    newDataHash: DATA_HASH_2,
    channelName: CHANNEL_1,
    description: "Updated schema description"
  };

  // Get role constants
  const SCHEMA_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_ADMIN_ROLE"));

  return {
    schemaRegistry,
    addressDiscovery,
    accessChannelManager,
    deployer,
    user,
    member1,
    member2,
    CHANNEL_1,
    CHANNEL_2,
    SCHEMA_1,
    SCHEMA_2,
    NON_EXISTENT_SCHEMA,
    DATA_HASH_1,
    DATA_HASH_2,
    schemaInput,
    schemaUpdateInput,
    SCHEMA_ADMIN_ROLE
  };
}