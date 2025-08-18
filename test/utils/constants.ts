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

export const TRANSACTION_ORCHESTRATOR = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TRANSACTION_ORCHESTRATOR"));

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

/**
 * TRANSACTION ORCHESTRATOR 
 */
export const TRANSACTION_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TRANSACTION_ADMIN_ROLE"));

// Agricultural specific constants for testing
export const CATTLE_TAG_1 = "CATTLE-001";
export const CATTLE_TAG_2 = "CATTLE-002";
export const RFID_1 = "RFID-123456789";
export const RFID_2 = "RFID-987654321";

// Farm locations
export const FARM_SECTOR_A1 = "Farm-Sector-A1";
export const FARM_SECTOR_A2 = "Farm-Sector-A2";
export const FARM_SECTOR_B1 = "Farm-Sector-B1";
export const DAIRY_TANK_1 = "Dairy-Tank-1";
export const DAIRY_TANK_2 = "Dairy-Tank-2";
export const SILO_A = "Silo-A";
export const SILO_B = "Silo-B";

// Agricultural process types
export const CATTLE_REGISTRATION = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CATTLE_REGISTRATION"));
export const MILK_PRODUCTION = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MILK_PRODUCTION"));
export const GRAIN_STORAGE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GRAIN_STORAGE"));
export const ORGANIC_CERTIFICATION = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ORGANIC_CERTIFICATION"));

// Agricultural nature types  
export const LIVESTOCK = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("LIVESTOCK"));
export const DAIRY = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY"));
export const SOYBEAN = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SOYBEAN"));
export const CORN = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CORN"));
export const ORGANIC = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ORGANIC"));

// Agricultural stage types
export const REGISTRATION = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REGISTRATION"));
export const COLLECTION = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("COLLECTION"));
export const HARVEST = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("HARVEST"));
export const CERTIFICATION = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CERTIFICATION"));
export const PROCESSING = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROCESSING"));
export const STORAGE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("STORAGE"));

// Batch identifiers for agricultural products
export const BATCH_MILK_001 = "BATCH-MILK-001";
export const BATCH_SOY_001 = "BATCH-SOY-001";
export const BATCH_SOY_002 = "BATCH-SOY-002";
export const HARVEST_2024_CORN_001 = "HARVEST-2024-CORN-001";
export const GPS_COORD_12345 = "GPS-COORD-12345";
export const QUALITY_CERT_ABC123 = "QUALITY-CERT-ABC123";