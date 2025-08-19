import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  getTestAccounts,  
  CHANNEL_1,
  PROCESS_1,
  PROCESS_2,
  SCHEMA_1,
  SCHEMA_3,
  NON_EXISTENT_PROCESS,
  NATURE_1,
  NATURE_2,
  STAGE_1,
  STAGE_2,
  DATA_HASH_1,
  DATA_HASH_2,
  DATA_HASH_3,
  LOCATION_A,
  LOCATION_B,
  EXTERNAL_ID_1,
  EXTERNAL_ID_2,
  DEFAULT_AMOUNT
} from "./utils/index";
import hre from "hardhat";
import { deployTransactionOrchestrator } from "./fixture/deployTransactionOrchestrator";

describe("TransactionOrchestrator - Functional Tests", function () {

  let accounts: any;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let member1: HardhatEthersSigner;
  let member2: HardhatEthersSigner;

  beforeEach(async function () {
    accounts = await loadFixture(getTestAccounts);
    deployer = accounts.deployer;
    user = accounts.user;
    member1 = accounts.member1;
    member2 = accounts.member2;
  });

  describe("Process Validation & Integration", function () {
    it("Should validate process exists before executing transaction", async function () {
      const { transactionOrchestrator } = await loadFixture(deployTransactionOrchestrator);

      const invalidTransaction = {
        processId: NON_EXISTENT_PROCESS, // Process that doesn't exist
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: "Invalid process test",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(invalidTransaction))
        .to.be.revertedWithCustomError(transactionOrchestrator, "TransactionValidationFailed");
    });

    it("Should validate process action matches operation type", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // First create an asset to update
      const assetId = await createTestAsset(transactionOrchestrator, processRegistry, accounts.member1);

      // Create a process for UPDATE_ASSET action
      const updateProcessInput = {
        processId: PROCESS_2, // Different process ID
        natureId: NATURE_1,
        stageId: STAGE_2, // Different stage
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 1, // UPDATE_ASSET
        description: "Update asset process",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(updateProcessInput);

      // Submit UPDATE transaction
      const updateTransaction = {
        processId: PROCESS_2,
        natureId: NATURE_1,
        stageId: STAGE_2,
        channelName: CHANNEL_1,
        targetAssetIds: [assetId], // Provide the asset to update
        operationData: {
          initialAmount: 0, // Not used for UPDATE
          initialLocation: "",
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: DEFAULT_AMOUNT + 100, // New amount for update
          newProcessId: hre.ethers.ZeroHash,
          newLocation: LOCATION_B // New location for update
        },
        dataHashes: [DATA_HASH_2], // New data for update
        description: "Valid update transaction",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(updateTransaction))
        .not.to.be.reverted;

      // Invalid case: empty targetAssetIds for UPDATE operation
      const invalidUpdateTransaction = {
        ...updateTransaction,
        targetAssetIds: [], // Empty array - should cause panic
        description: "Invalid update - no target assets",
      };

      // This should revert due to array out of bounds when trying to access targetAssetIds[0]
      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(invalidUpdateTransaction))
        .to.be.revertedWithPanic(0x32); // Array accessed at out-of-bounds index
    });

    it("Should validate all required schemas exist for process", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        schemaRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create schema first
      const createSchemaInput3 = {
        id: SCHEMA_3,
        name: "Test Schema 3",
        dataHash: DATA_HASH_3,
        channelName: CHANNEL_1,
        description: "Test schema 3 description"
      };

      await schemaRegistry.connect(accounts.member1).createSchema(createSchemaInput3);

      // Create process with valid schema
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_3, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Valid schema process",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      const validTransaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: "Valid schema test",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(validTransaction))
        .not.to.be.reverted;
    });
  });

  describe("Asset ID Generation & Determinism", function () {
    it("Should generate unique asset IDs for different channels", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        accessChannelManager,
        schemaRegistry,
        assetRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create second channel
      const CHANNEL_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_2"));
      await accessChannelManager.connect(accounts.deployer).createChannel(CHANNEL_2);
      await accessChannelManager.connect(accounts.deployer).addChannelMember(CHANNEL_2, accounts.member1.address);

      // Create schema in both channels
      const createSchemaInputChannel1 = {
        id: SCHEMA_3,
        name: "Test Schema 3",
        dataHash: DATA_HASH_3,
        channelName: CHANNEL_1,
        description: "Test schema 3 description"
      };

      const createSchemaInputChannel2 = {
        id: SCHEMA_3,
        name: "Test Schema 3",
        dataHash: DATA_HASH_3,
        channelName: CHANNEL_2,
        description: "Test schema 3 description"
      };

      await schemaRegistry.connect(accounts.member1).createSchema(createSchemaInputChannel1);
      await schemaRegistry.connect(accounts.member1).createSchema(createSchemaInputChannel2);

      // Create identical processes in both channels
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_3, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Multi-channel test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);
      
      const processInput2 = { ...processInput, channelName: CHANNEL_2 };
      await processRegistry.connect(accounts.member1).createProcess(processInput2);

      // Submit identical transactions in both channels
      const transaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: "Channel 1 asset",
      };

      const transaction2 = { ...transaction, channelName: CHANNEL_2, description: "Channel 2 asset" };

      const tx1 = await transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction);
      const tx2 = await transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction2);

      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();

      // Extract asset IDs from events
      const getAssetId = (receipt: any) => {
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = transactionOrchestrator.interface.parseLog(log);
            return parsed?.name === "OperationExecuted";
          } catch {
            return false;
          }
        });
        const parsedEvent = transactionOrchestrator.interface.parseLog(event);
        return parsedEvent?.args.affectedAssets[0];
      };

      const assetId1 = getAssetId(receipt1);
      const assetId2 = getAssetId(receipt2);

      // Asset IDs should be different even with identical input
      expect(assetId1).to.not.equal(assetId2);

      // Verify assets exist in their respective channels
      const asset1 = await assetRegistry.getAsset(CHANNEL_1, assetId1);
      const asset2 = await assetRegistry.getAsset(CHANNEL_2, assetId2);

      expect(asset1.owner).to.equal(accounts.member1.address);
      expect(asset2.owner).to.equal(accounts.member1.address);
    });

    it("Should increment asset counter for sequential creations", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        assetRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create process
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Sequential creation test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      const baseTransaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: "Sequential asset",
      };

      // Create multiple assets sequentially
      const assetIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const tx = await transactionOrchestrator.connect(accounts.member1).submitTransaction(baseTransaction);
        const receipt = await tx.wait();
        
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = transactionOrchestrator.interface.parseLog(log);
            return parsed?.name === "OperationExecuted";
          } catch {
            return false;
          }
        });
        
        if (event) {
          const parsedEvent = transactionOrchestrator.interface.parseLog(event);
          assetIds.push(parsedEvent?.args.affectedAssets[0]);
        } else {
          console.error("No event found");
        }
      }

      // All asset IDs should be unique
      const uniqueIds = new Set(assetIds);
      expect(uniqueIds.size).to.equal(3);

      // All assets should exist
      for (const assetId of assetIds) {
        const asset = await assetRegistry.getAsset(CHANNEL_1, assetId);
        expect(asset.owner).to.equal(accounts.member1.address);
      }
    });
  });

  describe("Event Emission & Tracking", function () {
    it("Should emit all required events for CREATE operation", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Setup process
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Event emission test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      const transaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [EXTERNAL_ID_1],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1, DATA_HASH_2],
        description: "Event test asset",
      };

      const tx = await transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction);

      // Should emit OperationExecuted
      await expect(tx)
        .to.emit(transactionOrchestrator, "OperationExecuted")
        .withArgs(
          CHANNEL_1,
          PROCESS_1,
          NATURE_1,
          STAGE_1,
          accounts.member1.address,
          anyValue, // affectedAssets (generated)
          0, // CREATE operation
          anyValue, // blockNumber
          anyValue  // timestamp
        );

      // Should emit ProcessExecuted
      await expect(tx)
        .to.emit(transactionOrchestrator, "ProcessExecuted")
        .withArgs(
          CHANNEL_1,
          PROCESS_1,
          NATURE_1,
          STAGE_1,
          accounts.member1.address,
          anyValue  // timestamp
        );

      // Should emit AssetModified for each affected asset
      await expect(tx)
        .to.emit(transactionOrchestrator, "AssetModified");
    });

    it("Should emit correct events for complex operations with multiple assets", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        assetRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create initial assets
      await createTestAssetsForComplexOps(transactionOrchestrator, processRegistry, assetRegistry, accounts.member1);
      
      // Create GROUP process
      const groupProcessInput = {
        processId: PROCESS_2,
        natureId: NATURE_2,
        stageId: STAGE_2,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 4, // GROUP_ASSET
        description: "Group assets process",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(groupProcessInput);

      // Get created asset IDs
      const [asset1Id, asset2Id] = await getCreatedAssetIds(assetRegistry, accounts.member1);

      const groupTransaction = {
        processId: PROCESS_2,
        natureId: NATURE_2,
        stageId: STAGE_2,
        channelName: CHANNEL_1,
        targetAssetIds: [asset1Id, asset2Id],
        operationData: {
          initialAmount: 0,
          initialLocation: "",
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: LOCATION_B
        },
        dataHashes: [DATA_HASH_3],
        description: "Group test assets",
      };

      const tx = await transactionOrchestrator.connect(accounts.member1).submitTransaction(groupTransaction);
      const receipt = await tx.wait();

      // Should emit events for all affected assets (2 original + 1 group = 3 total)
      const assetModifiedEvents = receipt?.logs.filter(log => {
        try {
          const parsed = transactionOrchestrator.interface.parseLog(log);
          return parsed?.name === "AssetModified";
        } catch {
          return false;
        }
      });
      if (assetModifiedEvents === undefined) return;
      expect(assetModifiedEvents.length).to.equal(3); // 2 original assets + 1 group asset
    });
  });

  describe("Operation Data Mapping & Validation", function () {
    it("Should correctly map operation data for TRANSFER operation", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        assetRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create asset first
      const assetId = await createTestAsset(transactionOrchestrator, processRegistry, accounts.member1);

      // Create TRANSFER process
      const transferProcessInput = {
        processId: PROCESS_2,
        natureId: NATURE_1,
        stageId: STAGE_2,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 2, // TRANSFER_ASSET
        description: "Transfer asset process",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(transferProcessInput);

      const transferTransaction = {
        processId: PROCESS_2,
        natureId: NATURE_1,
        stageId: STAGE_2,
        channelName: CHANNEL_1,
        targetAssetIds: [assetId],
        operationData: {
          initialAmount: 0,
          initialLocation: "",
          targetOwner: accounts.member2.address, // Key field for transfer
          externalIds: [EXTERNAL_ID_2],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: LOCATION_B // New location after transfer
        },
        dataHashes: [DATA_HASH_2],
        description: "Transfer to member2",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(transferTransaction))
        .not.to.be.reverted;

      // Verify transfer occurred correctly
      const transferredAsset = await assetRegistry.getAsset(CHANNEL_1, assetId);
      expect(transferredAsset.owner).to.equal(accounts.member2.address);
      expect(transferredAsset.idLocal).to.equal(LOCATION_B);
      expect(transferredAsset.externalIds[0]).to.equal(EXTERNAL_ID_2);
    });

    it("Should correctly map operation data for SPLIT operation", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        assetRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create asset with appropriate amount for splitting
      const assetId = await createTestAssetWithAmount(transactionOrchestrator, processRegistry, accounts.member1, 1000);

      // Create SPLIT process
      const splitProcessInput = {
        processId: PROCESS_2,
        natureId: NATURE_2,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 3, // SPLIT_ASSET
        description: "Split asset process",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(splitProcessInput);

      const splitTransaction = {
        processId: PROCESS_2,
        natureId: NATURE_2,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [assetId],
        operationData: {
          initialAmount: 0,
          initialLocation: "",
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [400, 300, 300], // Key field for split
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: LOCATION_B
        },
        dataHashes: [DATA_HASH_1, DATA_HASH_2, DATA_HASH_3], // One for each split
        description: "Split into 3 parts",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(splitTransaction))
        .not.to.be.reverted;

      // Verify original asset is inactive
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, assetId);
      expect(originalAsset.status).to.equal(1); // INACTIVE
      expect(originalAsset.childAssets.length).to.equal(3);

      // Verify split assets exist with correct amounts
      for (let i = 0; i < 3; i++) {
        const splitAssetId = originalAsset.childAssets[i];
        const splitAsset = await assetRegistry.getAsset(CHANNEL_1, splitAssetId);
        expect(splitAsset.amount).to.equal([400, 300, 300][i]);
        expect(splitAsset.status).to.equal(0); // ACTIVE
        expect(splitAsset.idLocal).to.equal(LOCATION_B);
      }
    });
  });

  describe("Access Control & Security", function () {
    it("Should only allow channel members to submit transactions", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create process
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Access control test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      const transaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: "Unauthorized access test",
      };

      // User is not a channel member, should fail
      await expect(transactionOrchestrator.connect(accounts.user).submitTransaction(transaction))
        .to.be.revertedWithCustomError(transactionOrchestrator, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should respect asset ownership in operations", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Member1 creates asset
      const assetId = await createTestAsset(transactionOrchestrator, processRegistry, accounts.member1);

      // Create UPDATE process
      const updateProcessInput = {
        processId: PROCESS_2,
        natureId: NATURE_1,
        stageId: STAGE_2,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 1, // UPDATE_ASSET
        description: "Update asset process",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(updateProcessInput);

      const updateTransaction = {
        processId: PROCESS_2,
        natureId: NATURE_1,
        stageId: STAGE_2,
        channelName: CHANNEL_1,
        targetAssetIds: [assetId],
        operationData: {
          initialAmount: 0,
          initialLocation: "",
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: DEFAULT_AMOUNT + 100,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: LOCATION_B
        },
        dataHashes: [DATA_HASH_2],
        description: "Unauthorized update attempt",
      };

      // Member2 tries to update Member1's asset, should fail
      await expect(transactionOrchestrator.connect(accounts.member2).submitTransaction(updateTransaction))
        .to.be.revertedWithCustomError(transactionOrchestrator, "NotAssetOwner")
        .withArgs(CHANNEL_1, assetId, accounts.member2.address);
    });
  });

  describe("Pause/Resume Functionality", function () {
    it("Should allow admin to pause and resume transactions", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Setup process
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Pause test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      const transaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: "Pause test asset",
      };

      // Should work normally
      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction))
        .not.to.be.reverted;

      // Pause transactions
      await transactionOrchestrator.connect(accounts.deployer).pauseTransactions();

      // Should fail when paused
      //await (transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction));
      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction))
        .to.be.revertedWithCustomError(transactionOrchestrator, "EnforcedPause()");

      // Resume transactions
      await transactionOrchestrator.connect(accounts.deployer).resumeTransactions();

      // Should work again
      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction))
        .not.to.be.reverted;
    });

    it("Should only allow admin to pause/resume", async function () {
      const { transactionOrchestrator } = await loadFixture(deployTransactionOrchestrator);

      // Non-admin should not be able to pause
      await expect(transactionOrchestrator.connect(accounts.member1).pauseTransactions())
        .to.be.revertedWithCustomError(transactionOrchestrator, "AccessControlUnauthorizedAccount");

      // Non-admin should not be able to resume
      await expect(transactionOrchestrator.connect(accounts.member1).resumeTransactions())
        .to.be.revertedWithCustomError(transactionOrchestrator, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Error Handling & Edge Cases", function () {
    it("Should handle transformation with auto-generated transformationId", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        assetRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create asset
      const assetId = await createTestAsset(transactionOrchestrator, processRegistry, accounts.member1);

      // Create TRANSFORM process
      const transformProcessInput = {
        processId: PROCESS_2,
        natureId: NATURE_2,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 6, // TRANSFORM_ASSET
        description: "Transform asset process",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(transformProcessInput);

      const transformTransaction = {
        processId: PROCESS_2,
        natureId: NATURE_2,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [assetId],
        operationData: {
          initialAmount: 0,
          initialLocation: "",
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: DEFAULT_AMOUNT + 50,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: LOCATION_B
        },
        dataHashes: [DATA_HASH_2],
        description: "Transform with auto-generated ID",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(transformTransaction))
        .not.to.be.reverted;

      // Verify transformation occurred with auto-generated transformationId
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, assetId);
      expect(originalAsset.status).to.equal(1); // INACTIVE
      expect(originalAsset.childAssets.length).to.equal(1);

      const transformedAssetId = originalAsset.childAssets[0];
      const transformedAsset = await assetRegistry.getAsset(CHANNEL_1, transformedAssetId);
      expect(transformedAsset.amount).to.equal(DEFAULT_AMOUNT + 50);
    });

    it("Should validate dataHashes array limits", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create process
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "DataHashes limit test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      // Create transaction with too many dataHashes (exceeding MAX_DATA_HASHES)
      const tooManyHashes = new Array(21).fill(0).map((_, i) => `0x${i.toString().padStart(64, '0')}`);
      
      const invalidTransaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: tooManyHashes, // Exceeds limit
        description: "Too many hashes",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(invalidTransaction))
        .to.be.revertedWithCustomError(transactionOrchestrator, "TooManyDataHashes");
    });

    it("Should handle empty dataHashes array", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create process
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Empty dataHashes test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      const invalidTransaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [], // Empty array
        description: "Empty hashes test",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(invalidTransaction))
        .to.be.revertedWithCustomError(transactionOrchestrator, "EmptyDataHashes");
    });
  });

  describe("Gas Optimization & Performance", function () {
    it("Should handle batch operations efficiently", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        assetRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create multiple assets for grouping
      const assetIds: string[] = [];
      
      // Create process for asset creation
      const createProcessInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Batch test creation",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(createProcessInput);

      // Create 5 assets
      for (let i = 0; i < 5; i++) {
        const createTransaction = {
          processId: PROCESS_1,
          natureId: NATURE_1,
          stageId: STAGE_1,
          channelName: CHANNEL_1,
          targetAssetIds: [],
          operationData: {
            initialAmount: DEFAULT_AMOUNT / 5,
            initialLocation: LOCATION_A,
            targetOwner: hre.ethers.ZeroAddress,
            externalIds: [],
            splitAmounts: [],
            groupAmount: 0,
            newAmount: 0,
            newProcessId: hre.ethers.ZeroHash,
            newLocation: ""
          },
          dataHashes: [DATA_HASH_1],
          description: `Batch asset ${i}`,
        };

        const tx = await transactionOrchestrator.connect(accounts.member1).submitTransaction(createTransaction);
        const receipt = await tx.wait();
        
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = transactionOrchestrator.interface.parseLog(log);
            return parsed?.name === "OperationExecuted";
          } catch {
            return false;
          }
        });
        
        if (!event) {
          throw new Error("OperationExecuted event not found");
        }
        const parsedEvent = transactionOrchestrator.interface.parseLog(event);
        assetIds.push(parsedEvent?.args.affectedAssets[0]);
      }

      // Create GROUP process
      const groupProcessInput = {
        processId: PROCESS_2,
        natureId: NATURE_2,
        stageId: STAGE_2,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 4, // GROUP_ASSET
        description: "Batch group process",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(groupProcessInput);

      // Group all assets in single transaction
      const groupTransaction = {
        processId: PROCESS_2,
        natureId: NATURE_2,
        stageId: STAGE_2,
        channelName: CHANNEL_1,
        targetAssetIds: assetIds,
        operationData: {
          initialAmount: 0,
          initialLocation: "",
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: LOCATION_B
        },
        dataHashes: [DATA_HASH_2],
        description: "Group 5 assets efficiently",
      };

      const groupTx = await transactionOrchestrator.connect(accounts.member1).submitTransaction(groupTransaction);
      const groupReceipt = await groupTx.wait();
      
      // Should complete within reasonable gas limits
      expect(groupReceipt?.gasUsed).to.be.lessThan(5000000);

      // Verify all assets were grouped correctly
      const groupEvent = groupReceipt?.logs.find((log: any) => {
        try {
          const parsed = transactionOrchestrator.interface.parseLog(log);
          return parsed?.name === "OperationExecuted";
        } catch {
          return false;
        }
      });

      if (!groupEvent) {
        throw new Error("OperationExecuted event not found");
      }
      const parsedGroupEvent = transactionOrchestrator.interface.parseLog(groupEvent);
      const affectedAssets = parsedGroupEvent?.args.affectedAssets;
      
      // Should have 6 affected assets: 5 original + 1 group
      expect(affectedAssets.length).to.equal(6);
    });
  });

  describe("Cross-Contract Integration", function () {
    it("Should properly integrate with ProcessRegistry for validation", async function () {
      const { 
        transactionOrchestrator, 
        processRegistry,
        schemaRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create schema first
      const schemaInput = {
        id: SCHEMA_3,
        name: "Test Schema 3",
        channelName: CHANNEL_1,
        dataHash: DATA_HASH_3,
        description: "Integration test schema"
      };

      await schemaRegistry.connect(accounts.member1).createSchema(schemaInput);

      // Create process with specific validation rules
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Integration validation test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      // Submit transaction that should be validated by ProcessRegistry
      const transaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: "Integration test asset",
      };

      // Should succeed with proper validation
      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction))
        .not.to.be.reverted;

      // Try with wrong stage
      const invalidTransaction = { 
        ...transaction, 
        stageId: STAGE_2 // Wrong stage
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(invalidTransaction))
        .to.be.revertedWithCustomError(transactionOrchestrator, "TransactionValidationFailed");
    });

    it("Should handle address discovery updates gracefully", async function () {
      const { 
        transactionOrchestrator, 
        addressDiscovery,
        processRegistry
      } = await loadFixture(deployTransactionOrchestrator);

      // Create process
      const processInput = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        schemas: [{ schemaId: SCHEMA_1, version: 1 }],
        action: 0, // CREATE_ASSET
        description: "Address discovery test",
        channelName: CHANNEL_1,
      };

      await processRegistry.connect(accounts.member1).createProcess(processInput);

      const transaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: "Address discovery test",
      };

      await expect(transactionOrchestrator.connect(accounts.member1).submitTransaction(transaction))
        .not.to.be.reverted;

      // Admin can update address discovery
      const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
      const newAddressDiscovery = await AddressDiscovery.deploy(accounts.admin.address);
      await newAddressDiscovery.waitForDeployment();

      await transactionOrchestrator.connect(accounts.deployer).setAddressDiscovery(newAddressDiscovery.target);

      // Should use new address discovery
      expect(await transactionOrchestrator.getAddressDiscovery()).to.equal(newAddressDiscovery.target);
    });
  });

  // Helper functions for test setup
  async function createTestAsset(transactionOrchestrator: any, processRegistry: any, creator: HardhatEthersSigner): Promise<string> {
    // Create process
    const processInput = {
      processId: PROCESS_1,
      natureId: NATURE_1,
      stageId: STAGE_1,
      schemas: [{ schemaId: SCHEMA_1, version: 1 }],
      action: 0, // CREATE_ASSET
      description: "Helper asset creation",
      channelName: CHANNEL_1,
    };

    await processRegistry.connect(creator).createProcess(processInput);

    // Create asset
    const transaction = {
      processId: PROCESS_1,
      natureId: NATURE_1,
      stageId: STAGE_1,
      channelName: CHANNEL_1,
      targetAssetIds: [],
      operationData: {
        initialAmount: DEFAULT_AMOUNT,
        initialLocation: LOCATION_A,
        targetOwner: hre.ethers.ZeroAddress,
        externalIds: [],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: ""
      },
      dataHashes: [DATA_HASH_1],
      description: "Helper test asset",
    };

    const tx = await transactionOrchestrator.connect(creator).submitTransaction(transaction);
    const receipt = await tx.wait();
    
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = transactionOrchestrator.interface.parseLog(log);
        return parsed?.name === "OperationExecuted";
      } catch {
        return false;
      }
    });
    
    const parsedEvent = transactionOrchestrator.interface.parseLog(event);
    return parsedEvent?.args.affectedAssets[0];
  }

  async function createTestAssetWithAmount(transactionOrchestrator: any, processRegistry: any, creator: HardhatEthersSigner, amount: number): Promise<string> {
    // Create process
    const processInput = {
      processId: PROCESS_1,
      natureId: NATURE_1,
      stageId: STAGE_1,
      schemas: [{ schemaId: SCHEMA_1, version: 1 }],
      action: 0, // CREATE_ASSET
      description: "Helper asset creation with amount",
      channelName: CHANNEL_1,
    };

    await processRegistry.connect(creator).createProcess(processInput);

    // Create asset with specific amount
    const transaction = {
      processId: PROCESS_1,
      natureId: NATURE_1,
      stageId: STAGE_1,
      channelName: CHANNEL_1,
      targetAssetIds: [],
      operationData: {
        initialAmount: amount,
        initialLocation: LOCATION_A,
        targetOwner: hre.ethers.ZeroAddress,
        externalIds: [],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: ""
      },
      dataHashes: [DATA_HASH_1],
      description: "Helper test asset with amount",
    };

    const tx = await transactionOrchestrator.connect(creator).submitTransaction(transaction);
    const receipt = await tx.wait();
    
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = transactionOrchestrator.interface.parseLog(log);
        return parsed?.name === "OperationExecuted";
      } catch {
        return false;
      }
    });
    
    const parsedEvent = transactionOrchestrator.interface.parseLog(event);
    return parsedEvent?.args.affectedAssets[0];
  }

  async function createTestAssetsForComplexOps(transactionOrchestrator: any, processRegistry: any, assetRegistry: any, creator: HardhatEthersSigner): Promise<void> {
    // Create process for asset creation
    const processInput = {
      processId: PROCESS_1,
      natureId: NATURE_1,
      stageId: STAGE_1,
      schemas: [{ schemaId: SCHEMA_1, version: 1 }],
      action: 0, // CREATE_ASSET
      description: "Complex ops setup",
      channelName: CHANNEL_1,
    };

    await processRegistry.connect(creator).createProcess(processInput);

    // Create two assets
    for (let i = 0; i < 2; i++) {
      const transaction = {
        processId: PROCESS_1,
        natureId: NATURE_1,
        stageId: STAGE_1,
        channelName: CHANNEL_1,
        targetAssetIds: [],
        operationData: {
          initialAmount: DEFAULT_AMOUNT / 2,
          initialLocation: LOCATION_A,
          targetOwner: hre.ethers.ZeroAddress,
          externalIds: [],
          splitAmounts: [],
          groupAmount: 0,
          newAmount: 0,
          newProcessId: hre.ethers.ZeroHash,
          newLocation: ""
        },
        dataHashes: [DATA_HASH_1],
        description: `Complex ops asset ${i + 1}`,
      };

      await transactionOrchestrator.connect(creator).submitTransaction(transaction);
    }
  }

  async function getCreatedAssetIds(assetRegistry: any, owner: HardhatEthersSigner): Promise<string[]> {
    const [assetIds] = await assetRegistry.getAssetsByOwner(CHANNEL_1, owner.address, 1, 10);
    return assetIds;
  }
});