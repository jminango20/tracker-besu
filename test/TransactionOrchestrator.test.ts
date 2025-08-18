import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { deployAssetRegistry } from "./fixture/deployAssetRegistry";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  getTestAccounts,  
  TRANSACTION_ADMIN_ROLE,
  CHANNEL_1,
  PROCESS_1,
  SCHEMA_1,
  NON_EXISTENT_PROCESS,
  NATURE_1,
  NATURE_2,
  STAGE_1,
  STAGE_2,
  DATA_HASH_1,
  DATA_HASH_2,
} from "./utils/index";
import hre from "hardhat";
import { deployTransactionOrchestrator } from "./fixture/deployTransactionOrchestrator";

describe("TransactionOrchestrator test", function () {

  let accounts: any;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let member1: HardhatEthersSigner;
  let member2: HardhatEthersSigner;

  beforeEach(async function () {
    // Load accounts
    accounts = await loadFixture(getTestAccounts);
    deployer = accounts.deployer;
    user = accounts.user;
    member1 = accounts.member1;
    member2 = accounts.member2;
  });

  describe("Deployment", function () {
    it("Should deploy successfully with address discovery", async function () {
        const { transactionOrchestrator } = await loadFixture(deployTransactionOrchestrator);
        
        expect(await transactionOrchestrator.hasRole(TRANSACTION_ADMIN_ROLE, deployer.address)).to.be.true;
        expect(await transactionOrchestrator.getVersion()).to.equal("1.0.0");
    });
  
    it("Should verify integration with address discovery", async function () {
        const { transactionOrchestrator, addressDiscovery } = await loadFixture(deployTransactionOrchestrator);
  
        expect(await transactionOrchestrator.getAddressDiscovery()).to.equal(addressDiscovery.target);
      });
  });

  describe("submitTransaction - CREATE_ASSET", function () {
    it("Should allow channel member to create cattle asset through transaction", async function () {
      const { 
        transactionOrchestrator, 
        assetRegistry,
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create a process for cattle registration
      const createCattleProcessInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [
                { schemaId: SCHEMA_1, version: 1 }
            ],
        action: 0, // CREATE_ASSET
        description: "Register new cattle in farm system",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(createCattleProcessInput);

      // Submit transaction to create cattle asset
      const createCattleTransaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [], // Not needed for CREATE
        operationData: {
            initialAmount: 1, // 1 head of cattle
            initialLocation: "Farm-Sector-A1",
            targetOwner: hre.ethers.ZeroAddress, // Not needed for CREATE
            externalIds: ["CATTLE-001", "RFID-123456789"], // Cattle tag and RFID
            splitAmounts: [], // Not needed for CREATE
            groupAmount: 0, // Not needed for CREATE
            newAmount: 0, // Not needed for CREATE
            newProcessId: hre.ethers.ZeroHash, // Not needed for CREATE
            newLocation: "" // Not needed for CREATE
        },
        dataHashes: [DATA_HASH_1, DATA_HASH_2], // Cattle data: health records, vaccination
        description: "Register new cattle in farm system",
      };

      const tx = await transactionOrchestrator.connect(accounts.member1).submitTransaction(createCattleTransaction);
      const receipt = await tx.wait();

      // Find OperationExecuted event to get the generated asset ID
      const operationExecutedEvent = receipt?.logs.find(log => {
        try {
          const parsed = transactionOrchestrator.interface.parseLog(log);
          return parsed?.name === "OperationExecuted";
        } catch {
          return false;
        }
      });

      expect(operationExecutedEvent).to.not.be.undefined;
      
      if (operationExecutedEvent) {
        const parsedEvent = transactionOrchestrator.interface.parseLog(operationExecutedEvent);
        const affectedAssets = parsedEvent?.args.affectedAssets;
        
        expect(affectedAssets.length).to.equal(1);
        const generatedAssetId = affectedAssets[0];

        // Verify the asset exists in AssetRegistry with correct data
        const createdAsset = await assetRegistry.getAsset(CHANNEL_1, generatedAssetId);
        expect(createdAsset.assetId).to.equal(generatedAssetId);
        expect(createdAsset.owner).to.equal(accounts.member1.address);
        expect(createdAsset.amount).to.equal(1);
        expect(createdAsset.idLocal).to.equal("Farm-Sector-A1");
        expect(createdAsset.status).to.equal(0); // ACTIVE
        expect(createdAsset.operation).to.equal(0); // CREATE
        expect(createdAsset.dataHashes.length).to.equal(2);
        expect(createdAsset.dataHashes[0]).to.equal(DATA_HASH_1);
        expect(createdAsset.dataHashes[1]).to.equal(DATA_HASH_2);
        expect(createdAsset.externalIds.length).to.equal(2);
        expect(createdAsset.externalIds[0]).to.equal("CATTLE-001");
        expect(createdAsset.externalIds[1]).to.equal("RFID-123456789");
      }
    });
  });

});