import { ethers } from "hardhat";
import * as dotenv from "dotenv";

const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` });

export async function getDeployer() {
  // Try private key first
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (deployerPrivateKey) {
    const signer = new ethers.Wallet(deployerPrivateKey, ethers.provider);
    console.log(`Using deployer from private key: ${signer.address}`);
    return signer;
  }
  
  // Try address
  const deployerAddress = process.env.DEPLOYER_ADDRESS;
  if (deployerAddress) {
    const signer = await ethers.getSigner(deployerAddress);
    console.log(`Using deployer from address: ${signer.address}`);
    return signer;
  }
  
  // Default to first signer
  const signers = await ethers.getSigners();
  const signer = signers[0];
  console.log(`Using default deployer: ${signer.address}`);
  return signer;
}

export async function getAddressDiscoveryAdmin() {
  const adminPrivateKey = process.env.ADDRESS_DISCOVERY_ADMIN_ROLE_PRIVATE_KEY;
  if (adminPrivateKey) {
    const signer = new ethers.Wallet(adminPrivateKey, ethers.provider);
    console.log(`Using admin from private key: ${signer.address}`);
    return signer;
  }
  
  return getDeployer();
}