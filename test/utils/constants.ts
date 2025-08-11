import hre from "hardhat";

export const DEFAULT_ADMIN_ROLE: string = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const ADDRESS_DISCOVERY_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ADDRESS_DISCOVERY_ADMIN_ROLE"));

/**
 * ADDRESS DISCOVERY
 */
// Mock for adddress discovery
export const CONTRACT_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONTRACT_1"));
export const CONTRACT_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONTRACT_2"));
export const NON_EXISTENT_CONTRACT = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT_CONTRACT"));

export const contractAddress1 = hre.ethers.Wallet.createRandom().address;
export const contractAddress2 = hre.ethers.Wallet.createRandom().address;

/**
 * ACCESS CHANNEL MANAGER
 */
// For Access Channel Manager tests
export const CHANNEL_AUTHORITY_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_AUTHORITY_ROLE"));
export const CHANNEL_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_ADMIN_ROLE"));

// Define test channel names
export const CHANNEL_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_1"));
export const CHANNEL_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_2"));
export const NON_EXISTENT_CHANNEL = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT"));

/**
 * SCHEMA REGISTRY 
 */
export const SCHEMA_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_ADMIN_ROLE"));

// Define test schema data
export const SCHEMA_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_1"));
export const SCHEMA_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_2"));
export const NON_EXISTENT_SCHEMA = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT"));

export const DATA_HASH_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data_hash_1"));
export const DATA_HASH_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data_hash_2"));

/**
 * PROCESS REGISTRY
 */
export const PROCESS_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROCESS_ADMIN_ROLE"));

// Define test process data
export const PROCESS_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROCESS_1"));
export const PROCESS_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROCESS_2"));
export const NON_EXISTENT_PROCESS = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT_PROCESS"));
export const NATURE_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NATURE_1"));
export const NATURE_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NATURE_2"));
export const STAGE_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("STAGE_1"));
export const STAGE_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("STAGE_2"));


/**
 * ASSET REGISTRY
 */
export const ASSET_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_ADMIN_ROLE"));

// Define test asset IDs
export const ASSET_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_1"));
export const ASSET_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_2"));
export const ASSET_GROUP_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_GROUP_1"));
export const NON_EXISTENT_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT_ASSET"));

// Define test transformation IDs
export const TRANSFORMATION_1 = "BEEF-PROCESSING";
export const TRANSFORMATION_2 = "DAIRY-PROCESSING";

// Define test amounts
export const DEFAULT_AMOUNT = 100;
export const SPLIT_AMOUNT_1 = 40;
export const SPLIT_AMOUNT_2 = 60;

// Define test locations
export const LOCATION_A = "Location-A";
export const LOCATION_B = "Location-B"; 
export const LOCATION_C = "Location-C";

// Define additional data hashes for testing
export const DATA_HASH_3 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data_hash_3"));
export const DATA_HASH_4 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data_hash_4"));

// Define external IDs for testing
export const EXTERNAL_ID_1 = "EXT-001";
export const EXTERNAL_ID_2 = "EXT-002";
export const EXTERNAL_ID_3 = "EXT-003";
