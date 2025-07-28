import hre from "hardhat";
import { deploySchemaRegistry } from "./deploySchemaRegistry";
import { getTestAccounts } from "../utils/index"; 
import { 
    CHANNEL_1, 
    SCHEMA_1,
    SCHEMA_2,
    DATA_HASH_1,
    DATA_HASH_2,
    PROCESS_1,
    PROCESS_2,
    NATURE_1,
    NATURE_2,
    STAGE_1,
    STAGE_2
} from "../utils/index";

export async function deployProcessRegistry() {
  
  const accounts = await getTestAccounts();

  // Deploy SchemaRegistry
  const {schemaRegistry, addressDiscovery, accessChannelManager} = await deploySchemaRegistry();

  // Deploy ProcessRegistry
  const ProcessRegistry = await hre.ethers.getContractFactory("ProcessRegistry");
  const processRegistry = await ProcessRegistry.deploy(addressDiscovery.target);

  await processRegistry.waitForDeployment();

  // Register ProcessRegistry in AddressDiscovery
  const PROCESS_REGISTRY = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROCESS_REGISTRY"));
  await addressDiscovery.connect(accounts.deployer).updateAddress(PROCESS_REGISTRY, processRegistry.target);

  // Create test channel and add members
  await accessChannelManager.connect(accounts.deployer).createChannel(CHANNEL_1);
  await accessChannelManager.connect(accounts.deployer).addChannelMember(CHANNEL_1, accounts.member1.address);
  await accessChannelManager.connect(accounts.deployer).addChannelMember(CHANNEL_1, accounts.member2.address);

  const schemaInput1 = {
    id: SCHEMA_1,
    name: "Test Schema 1",
    dataHash: DATA_HASH_1,
    channelName: CHANNEL_1,
    description: "Test schema 1 description"
  };

  const schemaInput2 = {
    id: SCHEMA_2,
    name: "Test Schema 2", 
    dataHash: DATA_HASH_2,
    channelName: CHANNEL_1,
    description: "Test schema 2 description"
  };

  await schemaRegistry.connect(accounts.member1).createSchema(schemaInput1);
  await schemaRegistry.connect(accounts.member1).createSchema(schemaInput2);

  // Process input templates
  const processInputWithSchemas = {
    processId: PROCESS_1,
    natureId: NATURE_1,
    stageId: STAGE_1,
    schemas: [
        { schemaId: SCHEMA_1, version: 1 },
        { schemaId: SCHEMA_2, version: 1 }
    ],
    action: 0, // CREATE_ASSET
    description: "Test process with schemas",
    channelName: CHANNEL_1,
  };

  const processInputWithoutSchemas = {
    processId: PROCESS_2,
    natureId: NATURE_2,
    stageId: STAGE_2,
    schemas: [],
    action: 3, // VIEW_ASSET (doesn't require schemas)
    description: "Test process without schemas",
    channelName: CHANNEL_1,
  };

  return {
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