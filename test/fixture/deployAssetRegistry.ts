import hre from "hardhat";
import { deployProcessRegistry } from "./deployProcessRegistry";
import { getTestAccounts } from "../utils/index"; 

export async function deployAssetRegistry() {
  
  const accounts = await getTestAccounts();

  // Deploy SchemaRegistry
  const {
    processRegistry,
    addressDiscovery,
    accessChannelManager,
    schemaRegistry,
    processInputWithSchemas,
    processInputWithoutSchemas,
    schemaInput1,
    schemaInput2
  } = await deployProcessRegistry();

  // Deploy AssetsRegistry
  const AssetRegistry = await hre.ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await AssetRegistry.deploy(addressDiscovery.target);

  await assetRegistry.waitForDeployment();

  // Register AssetsRegistry in AddressDiscovery
  const ASSET_REGISTRY = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_REGISTRY"));
  await addressDiscovery.connect(accounts.deployer).updateAddress(ASSET_REGISTRY, assetRegistry.target);

  return {
    assetRegistry,
    processRegistry,
    addressDiscovery,
    accessChannelManager,
    schemaRegistry,
    processInputWithSchemas,
    processInputWithoutSchemas,
    schemaInput1,
    schemaInput2
  };
}