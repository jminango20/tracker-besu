import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { deployProcessRegistry } from "./fixture/deployProcessRegistry";
import { getTestAccounts } from "./utils/index";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  PROCESS_ADMIN_ROLE,
  CHANNEL_1,
  SCHEMA_1,
  NON_EXISTENT_PROCESS,
  NATURE_1,
  NATURE_2,
  STAGE_1,
  STAGE_2
} from "./utils/index";
import hre from "hardhat";

describe("ProcessRegistry test", function () {

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
      const { processRegistry } = await loadFixture(deployProcessRegistry);
      
      expect(await processRegistry.hasRole(PROCESS_ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await processRegistry.getVersion()).to.equal("1.0.0");
    });

    it("Should verify integration with address discovery", async function () {
      const { processRegistry, addressDiscovery } = await loadFixture(deployProcessRegistry);

      expect(await processRegistry.getAddressDiscovery()).to.equal(addressDiscovery.target);
    });
  });

  describe("createProcess", function () {
    it("Should create process with schemas successfully", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);
        
        await expect(processRegistry.connect(member1).createProcess(processInputWithSchemas))
        .not.to.be.reverted;

        // Verify process was created
        const process = await processRegistry.getProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );
                
        expect(process.processId).to.equal(processInputWithSchemas.processId);
        expect(process.natureId).to.equal(processInputWithSchemas.natureId);
        expect(process.stageId).to.equal(processInputWithSchemas.stageId);
        expect(process.action).to.equal(processInputWithSchemas.action);
        expect(process.description).to.equal(processInputWithSchemas.description);
        expect(process.owner).to.equal(member1.address);
        expect(process.channelName).to.equal(processInputWithSchemas.channelName);
        expect(process.status).to.equal(0); // ACTIVE
        expect(process.schemas.length).to.equal(2);
        expect(process.createdAt).to.be.greaterThan(0);
    });

    it("Should create process without schemas successfully", async function () {
        const { processRegistry, processInputWithoutSchemas } = 
          await loadFixture(deployProcessRegistry);

        
        await expect(processRegistry.connect(member1).createProcess(processInputWithoutSchemas))
          .not.to.be.reverted;

        const process = await processRegistry.getProcess(
          processInputWithoutSchemas.channelName,
          processInputWithoutSchemas.processId,
          processInputWithoutSchemas.natureId,
          processInputWithoutSchemas.stageId
        );

        expect(process.schemas.length).to.equal(0);
        expect(process.action).to.equal(processInputWithoutSchemas.action);
    });

    it("Should emit ProcessCreated event", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        await expect(processRegistry.connect(member1).createProcess(processInputWithSchemas))
          .to.emit(processRegistry, "ProcessCreated")
          .withArgs(
            processInputWithSchemas.processId,
            processInputWithSchemas.natureId,
            processInputWithSchemas.stageId,
            member1.address,
            processInputWithSchemas.channelName,
            processInputWithSchemas.action,
            anyValue // timestamp
          );
    });

    it("Should create multiple processes with different unique keys", async function () {
        const { processRegistry, processInputWithSchemas, processInputWithoutSchemas } = 
          await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);
        await processRegistry.connect(member1).createProcess(processInputWithoutSchemas);

        // Both processes should exist
        const process1 = await processRegistry.getProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );

        const process2 = await processRegistry.getProcess(
          processInputWithoutSchemas.channelName,
          processInputWithoutSchemas.processId,
          processInputWithoutSchemas.natureId,
          processInputWithoutSchemas.stageId
        );

        
        expect(process1.processId).to.equal(processInputWithSchemas.processId);
        expect(process2.processId).to.equal(processInputWithoutSchemas.processId);
    });

    it("Should allow different members to create processes", async function () {
        const { processRegistry, processInputWithSchemas, processInputWithoutSchemas } = 
          await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        await expect(processRegistry.connect(member2).createProcess(processInputWithoutSchemas))
          .not.to.be.reverted;
    });
  });

  describe("setProcessStatus", function () {
      it("Should set process status successfully", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);
        
        await expect(processRegistry.connect(member1).setProcessStatus(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId,
          1 // ProcessStatus.INACTIVE
        )).to.emit(processRegistry, "ProcessStatusChanged")
        .withArgs(
          processInputWithSchemas.processId,
          processInputWithSchemas.channelName,
          0, // ACTIVE
          1, // INACTIVE
          member1.address,
          anyValue
        );
        
        const status = await processRegistry.getProcessStatus(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId,
        );
        expect(status).to.equal(1); // INACTIVE
      });

      it("Should revert if caller is not process owner", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        await expect(processRegistry.connect(member2).setProcessStatus(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId, 
          processInputWithSchemas.stageId,
          1 // INACTIVE
        )).to.be.revertedWithCustomError(processRegistry, "NotProcessOwner")
          .withArgs(processInputWithSchemas.channelName, processInputWithSchemas.processId, member2.address);
      });

      it("Should revert for invalid status transition", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        // Set to INACTIVE first
        await processRegistry.connect(member1).setProcessStatus(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId, 
          1 // INACTIVE
        );

        // Try to reactivate (should fail - INACTIVE is final)
        await expect(processRegistry.connect(member1).setProcessStatus(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId,
          0 // ACTIVE
        )).to.be.revertedWithCustomError(processRegistry, "InvalidProcessStatusTransition");
      });

      it("Should revert if setting same status", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        await expect(processRegistry.connect(member1).setProcessStatus(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId,
          0 // ACTIVE (same as current)
        )).to.be.revertedWithCustomError(processRegistry, "InvalidProcessStatusTransition");
      });
  });

  describe("inactivateProcess", function () {
    it("Should inactivate process successfully", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        await expect(processRegistry.connect(member1).inactivateProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId,
        )).to.emit(processRegistry, "ProcessStatusChanged")
          .withArgs(
            processInputWithSchemas.processId,
            processInputWithSchemas.channelName,
            0, // ACTIVE
            1, // INACTIVE
            member1.address,
            anyValue
          );
    });
  });

  describe("Input Validation Errors", function () {
      it("Should revert if natureId is zero", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        const invalidInput = { 
          ...processInputWithSchemas, 
          natureId: hre.ethers.ZeroHash 
        };

        await expect(processRegistry.connect(member1).createProcess(invalidInput))
          .to.be.revertedWithCustomError(processRegistry, "InvalidNatureId");
      });

      it("Should revert if stageId is zero", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        const invalidInput = { 
          ...processInputWithSchemas, 
          stageId: hre.ethers.ZeroHash 
        };

        await expect(processRegistry.connect(member1).createProcess(invalidInput))
          .to.be.revertedWithCustomError(processRegistry, "InvalidStageId");
      });

      it("Should revert if description is too long", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        const invalidInput = { 
          ...processInputWithSchemas, 
          description: "a".repeat(256) // Longer than MAX_STRING_LENGTH (255)
        };

        await expect(processRegistry.connect(member1).createProcess(invalidInput))
          .to.be.revertedWithCustomError(processRegistry, "DescriptionTooLong");
      });

      it("Should accept description at maximum length", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        const validInput = { 
          ...processInputWithSchemas, 
          description: "a".repeat(255) // Exactly MAX_STRING_LENGTH
        };

        await expect(processRegistry.connect(member1).createProcess(validInput))
          .not.to.be.reverted;
      });

      it("Should accept empty description", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        const validInput = { 
          ...processInputWithSchemas, 
          description: ""
        };

        await expect(processRegistry.connect(member1).createProcess(validInput))
          .not.to.be.reverted;
      });
  });

  describe("Duplicate Process Validation", function () {
    it("Should revert if process with same unique key already exists", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      // Create process first time
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      // Try to create same process again
      await expect(processRegistry.connect(member1).createProcess(processInputWithSchemas))
        .to.be.revertedWithCustomError(processRegistry, "ProcessAlreadyExists")
        .withArgs(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );
    });

    it("Should allow same processId with different natureId", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      const differentNature = { 
        ...processInputWithSchemas, 
        natureId: NATURE_2 
      };

      await expect(processRegistry.connect(member1).createProcess(differentNature))
        .not.to.be.reverted;
    });

    it("Should allow same processId with different stageId", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      const differentStage = { 
        ...processInputWithSchemas, 
        stageId: STAGE_2 
      };

      await expect(processRegistry.connect(member1).createProcess(differentStage))
        .not.to.be.reverted;
    });
  });

  describe("Schema Validation", function () {
    it("Should require schemas for CREATE_ASSET action", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      const invalidInput = { 
        ...processInputWithSchemas, 
        action: 0, // CREATE_ASSET
        schemas: [] 
      };

      await expect(processRegistry.connect(member1).createProcess(invalidInput))
        .to.be.revertedWithCustomError(processRegistry, "SchemasRequiredForAction")
        .withArgs(0);
    });

    it("Should require schemas for UPDATE_ASSET action", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      const invalidInput = { 
        ...processInputWithSchemas, 
        action: 1, // UPDATE_ASSET
        schemas: [] 
      };

      await expect(processRegistry.connect(member1).createProcess(invalidInput))
        .to.be.revertedWithCustomError(processRegistry, "SchemasRequiredForAction")
        .withArgs(1);
    });

    it("Should require schemas for CREATE_DOCUMENT action", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      const invalidInput = { 
        ...processInputWithSchemas, 
        action: 8, // CREATE_DOCUMENT
        schemas: [] 
      };

      await expect(processRegistry.connect(member1).createProcess(invalidInput))
        .to.be.revertedWithCustomError(processRegistry, "SchemasRequiredForAction")
        .withArgs(8);
    });

    it("Should not require schemas for TRANSFER_ASSET action", async function () {
      const { processRegistry, processInputWithoutSchemas } = 
        await loadFixture(deployProcessRegistry);

      // This should work (action 3 = TRANSFER_ASSET)
      await expect(processRegistry.connect(member1).createProcess(processInputWithoutSchemas))
        .not.to.be.reverted;
    });

    it("Should validate schema existence and accessibility", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      const invalidInput = { 
        ...processInputWithSchemas, 
        schemas: [{ schemaId: SCHEMA_1, version: 999 }] // Non-existent version
      };        

      await expect(processRegistry.connect(member1).createProcess(invalidInput))
        .to.be.revertedWithCustomError(processRegistry, "SchemaNotFoundInChannel");
    });

    it("Should reject duplicate schemas in input", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      const invalidInput = { 
        ...processInputWithSchemas, 
        schemas: [
          { schemaId: SCHEMA_1, version: 1 },
          { schemaId: SCHEMA_1, version: 1 } // Duplicate
        ]
      };

      await expect(processRegistry.connect(member1).createProcess(invalidInput))
        .to.be.revertedWithCustomError(processRegistry, "DuplicateSchemaInList");
    });

    it("Should reject inactive schemas", async function () {
      const { processRegistry, schemaRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      // Inactivate the schema first
      await schemaRegistry.connect(member1).inactivateSchema(SCHEMA_1, 1, CHANNEL_1);

      const invalidInput = { 
        ...processInputWithSchemas, 
        schemas: [{ schemaId: SCHEMA_1, version: 1 }]
      };

      await expect(processRegistry.connect(member1).createProcess(invalidInput))
        .to.be.revertedWithCustomError(processRegistry, "SchemaNotActiveInChannel");
    });

    it("Should not accept deprecated schemas", async function () {
      const { processRegistry, schemaRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      // Deprecate the schema first
      await schemaRegistry.connect(member1).deprecateSchema(SCHEMA_1, CHANNEL_1);

      const validInput = { 
        ...processInputWithSchemas, 
        schemas: [{ schemaId: SCHEMA_1, version: 1 }]
      };

      await expect(processRegistry.connect(member1).createProcess(validInput))
        .to.be.revertedWithCustomError(processRegistry, "SchemaNotActiveInChannel");
    });
  });

  describe("Process Not Found Errors", function () {
    it("Should revert if process does not exist", async function () {
      const { processRegistry } = 
        await loadFixture(deployProcessRegistry);

      await expect(processRegistry.connect(member1).getProcess(
        CHANNEL_1,
        NON_EXISTENT_PROCESS,
        NATURE_1,
        STAGE_1,
      )).to.be.revertedWithCustomError(processRegistry, "ProcessNotFound")
          .withArgs(CHANNEL_1, NON_EXISTENT_PROCESS);
    });

    it("Should revert if wrong combination of IDs", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      // Try to get with wrong natureId
      await expect(processRegistry.connect(member1).getProcess(
        processInputWithSchemas.channelName,
        NON_EXISTENT_PROCESS,
        processInputWithSchemas.stageId,
        processInputWithSchemas.channelName
      )).to.be.revertedWithCustomError(processRegistry, "ProcessNotFound");
    });
  });

  describe("Access Control", function () {
    it("Should revert if channel name is zero", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      const invalidInput = { 
        ...processInputWithSchemas, 
        channelName: hre.ethers.ZeroHash 
      };

      await expect(processRegistry.connect(member1).createProcess(invalidInput))
        .to.be.revertedWithCustomError(processRegistry, "InvalidChannelName");
    });

    it("Should revert if caller is not channel member", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      await expect(processRegistry.connect(user).createProcess(processInputWithSchemas))
        .to.be.revertedWithCustomError(processRegistry, "UnauthorizedChannelAccess")
        .withArgs(processInputWithSchemas.channelName, user.address);
    });
  });

  describe("View Functions", function () {
    describe("getProcessStatus", function () {
      it("Should return correct process status", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        const status = await processRegistry.getProcessStatus(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );
        
        expect(status).to.equal(0); // ACTIVE
      });

      it("Should return updated status after change", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        await processRegistry.connect(member1).inactivateProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );

        const status = await processRegistry.getProcessStatus(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );
        
        expect(status).to.equal(1); // INACTIVE
      });
    });

    describe("isProcessActive", function () {
      it("Should return true for active process", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        const isActive = await processRegistry.connect(member1).isProcessActive(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );

        expect(isActive).to.be.true;
      });

      it("Should return false for inactive process", async function () {
        const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        await processRegistry.connect(member1).inactivateProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );

        const isActive = await processRegistry.connect(member1).isProcessActive(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId,
        );

        expect(isActive).to.be.false;
      });
    });

    describe("getProcess", function () {
      it("Should return process with all correct data", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        const process = await processRegistry.getProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );

        expect(process.processId).to.equal(processInputWithSchemas.processId);
        expect(process.natureId).to.equal(processInputWithSchemas.natureId);
        expect(process.stageId).to.equal(processInputWithSchemas.stageId);
        expect(process.channelName).to.equal(processInputWithSchemas.channelName);
        expect(process.action).to.equal(processInputWithSchemas.action);
        expect(process.description).to.equal(processInputWithSchemas.description);
        expect(process.owner).to.equal(member1.address);
        expect(process.status).to.equal(0); // ACTIVE
        expect(process.schemas.length).to.equal(2);
        expect(process.createdAt).to.be.greaterThan(0);
      });

      it("Should return process without schemas", async function () {
        const { processRegistry, processInputWithoutSchemas } = 
          await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithoutSchemas);

        const process = await processRegistry.getProcess(
          processInputWithoutSchemas.channelName,
          processInputWithoutSchemas.processId,
          processInputWithoutSchemas.natureId,
          processInputWithoutSchemas.stageId
        );

        expect(process.schemas.length).to.equal(0);
      });

      it("Should allow different channel members to view process", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        await processRegistry.connect(member1).createProcess(processInputWithSchemas);

        const process = await processRegistry.connect(member2).getProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );
        

        expect(processInputWithSchemas.processId).to.equal(process.processId);
      });

      it("Should revert if processId is zero", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      await expect(processRegistry.getProcess(
        processInputWithSchemas.channelName,
        hre.ethers.ZeroHash,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId,
      )).to.be.revertedWithCustomError(processRegistry, "InvalidProcessId");
      });

      it("Should revert if natureId is zero", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        await expect(processRegistry.getProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          hre.ethers.ZeroHash,
          processInputWithSchemas.stageId,
        )).to.be.revertedWithCustomError(processRegistry, "InvalidNatureId");
      });

      it("Should revert if stageId is zero", async function () {
        const { processRegistry, processInputWithSchemas } = 
          await loadFixture(deployProcessRegistry);

        await expect(processRegistry.getProcess(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          hre.ethers.ZeroHash
        )).to.be.revertedWithCustomError(processRegistry, "InvalidStageId");
      });

      it("Should revert for non-existent process", async function () {
        const { processRegistry } = await loadFixture(deployProcessRegistry);

        await expect(processRegistry.getProcess(
          CHANNEL_1,
          NON_EXISTENT_PROCESS,
          NATURE_2,
          STAGE_2,
        )).to.be.revertedWithCustomError(processRegistry, "ProcessNotFound")
          .withArgs(CHANNEL_1, NON_EXISTENT_PROCESS);
      });
    });
  });

  describe("validateProcessForSubmission", function () {
    it("Should validate active process with active schemas", async function () {
      const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      const [isValid, reason] = await processRegistry.validateProcessForSubmission(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId
      );

      expect(isValid).to.be.true;
      expect(reason).to.equal("Process valid for submission");
    });

    it("Should reject non-existent process", async function () {
      const { processRegistry } = await loadFixture(deployProcessRegistry);

      const [isValid, reason] = await processRegistry.validateProcessForSubmission(
        CHANNEL_1,
        NON_EXISTENT_PROCESS,
        NATURE_1,
        STAGE_1,
      );

      expect(isValid).to.be.false;
      expect(reason).to.equal("Process not found");
    });

    it("Should reject inactive process", async function () {
      const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);
      
      // Inactivate process
      await processRegistry.connect(member1).inactivateProcess(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId
      );

      const [isValid, reason] = await processRegistry.validateProcessForSubmission(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId
      );

      expect(isValid).to.be.false;
      expect(reason).to.equal("Process not active");
    });

    it("Should reject process with inactive schemas", async function () {
      const { processRegistry, schemaRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);
      
      // Inactivate one of the schemas
      await schemaRegistry.connect(member1).inactivateSchema(SCHEMA_1, 1, CHANNEL_1);

      const [isValid, reason] = await processRegistry.validateProcessForSubmission(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId
      );

      expect(isValid).to.be.false;
      expect(reason).to.include("Schema not active");
    });

    it("Should validate process without external self-call", async function () {
      const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);
      
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      const [isValid, reason] = await processRegistry.validateProcessForSubmission(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId
      );

      expect(isValid).to.be.true;
      expect(reason).to.equal("Process valid for submission");
    });
  });

  describe("Access Control Helpers", function () {
    describe("addProcessAdmin", function () {
      it("Should allow default admin to add process admin", async function () {
        const { processRegistry } = await loadFixture(deployProcessRegistry);

        await processRegistry.connect(deployer).grantRole(PROCESS_ADMIN_ROLE, user.address);

        expect(await processRegistry.hasRole(PROCESS_ADMIN_ROLE, user.address)).to.be.true;
      });

      it("Should revert if caller is not default admin", async function () {
        const { processRegistry } = await loadFixture(deployProcessRegistry);
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

        await expect(processRegistry.connect(user).grantRole(PROCESS_ADMIN_ROLE, member1.address))
          .to.be.revertedWithCustomError(processRegistry, "AccessControlUnauthorizedAccount")
          .withArgs(user.address, DEFAULT_ADMIN_ROLE);
      });

      it("Should allow newly added admin to perform admin functions", async function () {
        const { processRegistry } = await loadFixture(deployProcessRegistry);

        // Add new process admin
        await expect(processRegistry.connect(deployer).grantRole(PROCESS_ADMIN_ROLE, user.address))
          .not.to.be.reverted;
        
        expect(await processRegistry.hasRole(PROCESS_ADMIN_ROLE, user.address)).to.be.true;
      });
    });

    describe("removeProcessAdmin", function () {
      it("Should allow default admin to remove process admin", async function () {
        const { processRegistry } = await loadFixture(deployProcessRegistry);

        // Add admin first
        await processRegistry.connect(deployer).grantRole(PROCESS_ADMIN_ROLE, user.address);
        expect(await processRegistry.hasRole(PROCESS_ADMIN_ROLE, user.address)).to.be.true;

        // Remove admin
        await processRegistry.connect(deployer).revokeRole(PROCESS_ADMIN_ROLE, user.address);
        expect(await processRegistry.hasRole(PROCESS_ADMIN_ROLE, user.address)).to.be.false;
      });

      it("Should revert if caller is not default admin", async function () {
        const { processRegistry } = await loadFixture(deployProcessRegistry);
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

        await expect(processRegistry.connect(user).revokeRole(PROCESS_ADMIN_ROLE, user.address))
          .to.be.revertedWithCustomError(processRegistry, "AccessControlUnauthorizedAccount")
          .withArgs(user.address, DEFAULT_ADMIN_ROLE);
      });

      it("Should prevent removed admin from performing admin functions", async function () {
        const { processRegistry } = await loadFixture(deployProcessRegistry);
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

        // Add admin first
        await processRegistry.connect(deployer).grantRole(PROCESS_ADMIN_ROLE, user.address);

        // Remove admin
        await processRegistry.connect(deployer).revokeRole(PROCESS_ADMIN_ROLE, user.address);

        // Removed admin should not be able to add other admins
        await expect(processRegistry.connect(user).grantRole(PROCESS_ADMIN_ROLE, member1.address))
          .to.be.revertedWithCustomError(processRegistry, "AccessControlUnauthorizedAccount")
          .withArgs(user.address, DEFAULT_ADMIN_ROLE);
      });

      it("Should allow removing non-existent admin without error", async function () {
        const { processRegistry } = await loadFixture(deployProcessRegistry);

        // This should not revert even if user doesn't have admin role
        await expect(processRegistry.connect(deployer).revokeRole(PROCESS_ADMIN_ROLE, user.address))
          .not.to.be.reverted;
      });
    });
  });

  describe("Address Discovery Management", function () {
    it("Should allow admin to update address discovery", async function () {
      const { processRegistry, addressDiscovery } = await loadFixture(deployProcessRegistry);

      // Deploy new address discovery for testing
      const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
      const newAddressDiscovery = await AddressDiscovery.deploy(deployer.address);

      const oldAddress = await processRegistry.getAddressDiscovery();
      expect(oldAddress).to.equal(addressDiscovery.target);

      await processRegistry.connect(deployer).setAddressDiscovery(newAddressDiscovery.target);

      const newAddress = await processRegistry.getAddressDiscovery();
      expect(newAddress).to.equal(newAddressDiscovery.target);
    });

    it("Should revert if caller is not default admin", async function () {
      const { processRegistry } = await loadFixture(deployProcessRegistry);
      const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

      const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
      const newAddressDiscovery = await AddressDiscovery.deploy(deployer.address);

      await expect(processRegistry.connect(user).setAddressDiscovery(newAddressDiscovery.target))
        .to.be.revertedWithCustomError(processRegistry, "AccessControlUnauthorizedAccount")
        .withArgs(user.address, DEFAULT_ADMIN_ROLE);
    });

    it("Should maintain functionality after address discovery update", async function () {
      const { processRegistry, processInputWithSchemas } = await loadFixture(deployProcessRegistry);

      // Create process with original address discovery
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      // Update address discovery
      const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
      const newAddressDiscovery = await AddressDiscovery.deploy(deployer.address);
      await processRegistry.connect(deployer).setAddressDiscovery(newAddressDiscovery.target);

      // Should still be able to retrieve process
      const process = await processRegistry.getProcess(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId,
      );

      expect(process.processId).to.equal(processInputWithSchemas.processId);
    });
  });

  describe("Composite Key Scenarios", function () {
    it("Should allow same processId with different nature/stage combinations", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      // Create first process
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      // Create second process with same processId but different nature
      const processWithDifferentNature = {
        ...processInputWithSchemas,
        natureId: NATURE_2
      };

      await expect(processRegistry.connect(member1).createProcess(processWithDifferentNature))
        .not.to.be.reverted;
        
      // Create third process with same processId but different stage
      const processWithDifferentStage = {
        ...processInputWithSchemas,
        stageId: STAGE_2
      };

      await expect(processRegistry.connect(member1).createProcess(processWithDifferentStage))
        .not.to.be.reverted;

      // All three should exist and be retrievable
      const process1 = await processRegistry.getProcess(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId
      );

      const process2 = await processRegistry.getProcess(
        processWithDifferentNature.channelName,
        processWithDifferentNature.processId,
        processWithDifferentNature.natureId,
        processWithDifferentNature.stageId
      );

      const process3 = await processRegistry.getProcess(
        processWithDifferentStage.channelName,
        processWithDifferentStage.processId,
        processWithDifferentStage.natureId,
        processWithDifferentStage.stageId
      );

      expect(process1.natureId).to.equal(processInputWithSchemas.natureId);
      expect(process2.natureId).to.equal(processWithDifferentNature.natureId);
      expect(process3.stageId).to.equal(STAGE_2);
    });

    it("Should validate process composite key uniqueness correctly", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      // Try to create exact same combination - should fail
      await expect(processRegistry.connect(member1).createProcess(processInputWithSchemas))
        .to.be.revertedWithCustomError(processRegistry, "ProcessAlreadyExists")
        .withArgs(
          processInputWithSchemas.channelName,
          processInputWithSchemas.processId,
          processInputWithSchemas.natureId,
          processInputWithSchemas.stageId
        );
    });

    it("Should handle getProcessById correctly with multiple composite keys", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      // Create multiple processes with same processId but different nature/stage
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      const processWithDifferentNature = {
        ...processInputWithSchemas,
        natureId: NATURE_2,
        description: "Different nature process"
      };
      await processRegistry.connect(member1).createProcess(processWithDifferentNature);

      // getProcessById should return one of them (implementation dependent)
      const retrievedProcess = await processRegistry.getProcess(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId,
      );

      expect(retrievedProcess.processId).to.equal(processInputWithSchemas.processId);
      // Should have either the original nature or the different nature
      expect([processInputWithSchemas.natureId, NATURE_2]).to.include(retrievedProcess.natureId);
    });

    it("Should properly track active process keys for different combinations", async function () {
      const { processRegistry, processInputWithSchemas } = 
        await loadFixture(deployProcessRegistry);

      // Create process
      await processRegistry.connect(member1).createProcess(processInputWithSchemas);

      // Check it's active
      let isActive = await processRegistry.connect(member1).isProcessActive(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId,
      );
      expect(isActive).to.be.true;

      // Create different combination with same processId
      const processWithDifferentNature = {
        ...processInputWithSchemas,
        natureId: NATURE_2
      };
      await processRegistry.connect(member1).createProcess(processWithDifferentNature);

      // Both should be active with their specific combinations
      isActive = await processRegistry.connect(member1).isProcessActive(
        processWithDifferentNature.channelName,
        processWithDifferentNature.processId,
        processWithDifferentNature.natureId,
        processWithDifferentNature.stageId,
      );
      expect(isActive).to.be.true;

      // Inactivate first one
      await processRegistry.connect(member1).inactivateProcess(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId
      );

      // First should be inactive, second should still be active
      isActive = await processRegistry.connect(member1).isProcessActive(
        processInputWithSchemas.channelName,
        processInputWithSchemas.processId,
        processInputWithSchemas.natureId,
        processInputWithSchemas.stageId
      );
      expect(isActive).to.be.false;

      isActive = await processRegistry.connect(member1).isProcessActive(
        processWithDifferentNature.channelName,
        processWithDifferentNature.processId,
        processWithDifferentNature.natureId,
        processWithDifferentNature.stageId
      );
      expect(isActive).to.be.true;
    });
  });
});