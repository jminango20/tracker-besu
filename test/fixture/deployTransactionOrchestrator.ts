import hre from "hardhat";
import { deployAssetRegistry } from "./deployAssetRegistry";
import { getTestAccounts, CHANNEL_1 } from "../utils/index"; 

export async function deployTransactionOrchestrator() {
  
  const accounts = await getTestAccounts();

  const {
    assetRegistry,
    processRegistry,
    addressDiscovery,
    accessChannelManager,
    schemaRegistry,
    processInputWithSchemas,
    processInputWithoutSchemas,
    schemaInput1,
    schemaInput2
  } = await deployAssetRegistry();

  // Deploy TransactionOrchestrator
  const TransactionOrchestrator = await hre.ethers.getContractFactory("TransactionOrchestrator");
  const transactionOrchestrator = await TransactionOrchestrator.deploy(addressDiscovery.target);

  await transactionOrchestrator.waitForDeployment();

  const TRANSACTION_ORCHESTRATOR = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TRANSACTION_ORCHESTRATOR"));
  await addressDiscovery.connect(accounts.deployer).updateAddress(TRANSACTION_ORCHESTRATOR, transactionOrchestrator.target);

  return {
    transactionOrchestrator,
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