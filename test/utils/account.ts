import hre from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export interface TestAccounts {
  deployer: HardhatEthersSigner;
  admin: HardhatEthersSigner;
  otherAdmin: HardhatEthersSigner;
  user: HardhatEthersSigner;
  member1: HardhatEthersSigner;
  member2: HardhatEthersSigner;
  member3: HardhatEthersSigner;
  nonMember: HardhatEthersSigner;
  // Add more roles as needed
}


export async function getTestAccounts(): Promise<TestAccounts> {
  const signers = await hre.ethers.getSigners();

  return {
    deployer: signers[0],    // Always the first account
    admin: signers[1],       // Contract admin
    otherAdmin: signers[2],  // Secondary admin for role testing
    user: signers[3],        // Regular user
    member1: signers[4],     // Member 1 of channel
    member2: signers[5],     // Member 2 of channel
    member3: signers[6],     // Member 3 of channel
    nonMember: signers[7]
  };
}