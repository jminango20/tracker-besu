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
