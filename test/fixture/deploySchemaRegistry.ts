import hre from "hardhat";
import { deployAddressDiscovery } from "./deployAddressDiscovery";
import { deployAccessChannelManager } from "./deployAccessChannelManager";
import { getTestAccounts } from "../utils/index"; 

export async function deploySchemaRegistry() {

  const accounts = await getTestAccounts();

  // Deploy AddressDiscovery first
  const addressDiscovery = await deployAddressDiscovery();

  // Deploy AccessChannelManager
  const accessChannelManager = await deployAccessChannelManager();

  // Register AccessChannelManager in AddressDiscovery
  const ACCESS_CHANNEL_MANAGER = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ACCESS_CHANNEL_MANAGER"));
  await addressDiscovery.connect(accounts.deployer).updateAddress(ACCESS_CHANNEL_MANAGER, accessChannelManager.target);

  // Deploy SchemaRegistry
  const SchemaRegistry = await hre.ethers.getContractFactory("SchemaRegistry");
  const schemaRegistry = await SchemaRegistry.deploy(addressDiscovery);

  await schemaRegistry.waitForDeployment();

  // Register SchemaRegistry in AddressDiscovery
  const SCHEMA_REGISTRY = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_REGISTRY"));
  await addressDiscovery.connect(accounts.deployer).updateAddress(SCHEMA_REGISTRY, schemaRegistry.target);

  return {
    schemaRegistry,
    addressDiscovery,
    accessChannelManager
  };
}