import hre from "hardhat";

export const DEFAULT_ADMIN_ROLE: string = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const ADDRESS_DISCOVERY_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ADDRESS_DISCOVERY_ADMIN_ROLE"));

// Mock for adddress discovery
export const CONTRACT_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONTRACT_1"));
export const CONTRACT_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONTRACT_2"));
export const NON_EXISTENT_CONTRACT = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT_CONTRACT"));

export const contractAddress1 = hre.ethers.Wallet.createRandom().address;
export const contractAddress2 = hre.ethers.Wallet.createRandom().address;

// For Access Channel Manager tests
export const CHANNEL_AUTHORITY_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_AUTHORITY_ROLE"));
export const CHANNEL_ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_ADMIN_ROLE"));

// Define test channel names
export const CHANNEL_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_1"));
export const CHANNEL_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_2"));
export const NON_EXISTENT_CHANNEL = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT"));
