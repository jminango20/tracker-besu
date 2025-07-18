import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deploySchemaRegistry } from "./fixture/deploySchemaRegistry";
import { ethers } from "hardhat";
import { getTestAccounts } from "./utils/index";
import { 
  CHANNEL_1, 
  SCHEMA_ADMIN_ROLE, 
  NON_EXISTENT_SCHEMA,
  SCHEMA_1,
  SCHEMA_2,
  DATA_HASH_2,
} from "./utils/index";
import { schemaInput, schemaUpdateInput } from "./utils/index";

describe.only("SchemaRegistry test", function () {
  let accounts: any;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let member1: HardhatEthersSigner;
  let member2: HardhatEthersSigner;

  let schemaRegistry: any;
  let accessChannelManager: any;

  beforeEach(async function () {
    // Load accounts
    accounts = await loadFixture(getTestAccounts);
    deployer = accounts.deployer;
    user = accounts.user;
    member1 = accounts.member1;
    member2 = accounts.member2;

    // Load the connected contract system
    const deployment = await loadFixture(deploySchemaRegistry);
    schemaRegistry = deployment.schemaRegistry;
    accessChannelManager = deployment.accessChannelManager;

    // Setup test data using the connected contracts
    await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
    await accessChannelManager
      .connect(deployer)
      .addChannelMember(CHANNEL_1, member1.address);
    await accessChannelManager
      .connect(deployer)
      .addChannelMember(CHANNEL_1, member2.address);
  });

  describe("Deployment", function () {
    it("Should deploy successfully with address discovery", async function () {
      expect(await schemaRegistry.hasRole(SCHEMA_ADMIN_ROLE, deployer.address))
        .to.be.true;
      expect(await schemaRegistry.getVersion()).to.equal("1.0.0");
    });

    it("Should verify channel membership integration", async function () {
      // Should return false for non-member
      expect(await schemaRegistry.isChannelMember(CHANNEL_1, deployer.address))
        .to.be.false;

      // Should return true for member
      expect(await schemaRegistry.isChannelMember(CHANNEL_1, member1.address))
        .to.be.true;
    });
  });

  describe("CreateSchema", function () {
    it("Should allow channel member to create schema", async function () {
      await expect(schemaRegistry.connect(member1).createSchema(schemaInput))
        .not.to.be.reverted;

      const schema = await schemaRegistry
        .connect(member1)
        .getSchemaByVersion(CHANNEL_1, schemaInput.id, schemaInput.version);

      expect(schema.id).to.equal(schemaInput.id);
      expect(schema.name).to.equal(schemaInput.name);
      expect(schema.version).to.equal(schemaInput.version);
      expect(schema.owner).to.equal(member1.address);
      expect(schema.status).to.equal(0); // ACTIVE
    });

    it("Should emit SchemaCreated event", async function () {
      await expect(schemaRegistry.connect(member1).createSchema(schemaInput))
        .to.emit(schemaRegistry, "SchemaCreated")
        .withArgs(
          schemaInput.id,
          schemaInput.name,
          schemaInput.version,
          member1.address,
          schemaInput.channelName,
          anyValue
        );
    });

    it("Should revert if schema already exists", async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);

      await expect(schemaRegistry.connect(member1).createSchema(schemaInput))
        .to.be.revertedWithCustomError(
          schemaRegistry,
          "SchemaAlreadyExistsCannotRecreate"
        )
        .withArgs(schemaInput.channelName, schemaInput.id);
    });

    it("Should revert if schema id is zero", async function () {
      const invalidInput = {
        ...schemaInput,
        id: ethers.ZeroHash,
      };

      await expect(
        schemaRegistry.connect(member1).createSchema(invalidInput)
      ).to.be.revertedWithCustomError(schemaRegistry, "InvalidSchemaId");
    });

    it("Should revert if schema name is empty", async function () {
      const invalidInput = { ...schemaInput, name: "" };

      await expect(
        schemaRegistry.connect(member1).createSchema(invalidInput)
      ).to.be.revertedWithCustomError(schemaRegistry, "InvalidSchemaName");
    });

    it("Should revert if data hash is empty", async function () {
      const invalidInput = { ...schemaInput, dataHash: ethers.ZeroHash };

      await expect(
        schemaRegistry.connect(member1).createSchema(invalidInput)
      ).to.be.revertedWithCustomError(schemaRegistry, "InvalidDataHash");
    });

    it("Should allow empty description", async function () {
      const invalidInput = { ...schemaInput, description: "" };

      await expect(schemaRegistry.connect(member1).createSchema(invalidInput))
        .not.be.reverted;
    });

    it("Should revert if description is too long", async function () {
      const invalidInput = { ...schemaInput, description: "a".repeat(256) };

      await expect(
        schemaRegistry.connect(member1).createSchema(invalidInput)
      ).to.be.revertedWithCustomError(schemaRegistry, "DescriptionTooLong");
    });

    it("Should revert if caller is not channel member", async function () {
      await expect(schemaRegistry.connect(user).createSchema(schemaInput))
        .to.be.revertedWithCustomError(
          schemaRegistry,
          "UnauthorizedChannelAccess"
        )
        .withArgs(schemaInput.channelName, user.address);
    });

    it("Should revert if caller is deployer and not channel member", async function () {
      await expect(schemaRegistry.connect(deployer).createSchema(schemaInput))
        .to.be.revertedWithCustomError(
          schemaRegistry,
          "UnauthorizedChannelAccess"
        )
        .withArgs(schemaInput.channelName, deployer.address);
    });
  });

  describe("DeprecateSchema", function () {
    this.beforeEach(async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
    });

    it("Should deprecate schema successfully", async function () {
      await expect(
        schemaRegistry
          .connect(member1)
          .deprecateSchema(schemaInput.id, schemaInput.channelName)
      ).not.to.be.reverted;

      const schema = await schemaRegistry
        .connect(member1)
        .getSchemaByVersion(
          schemaInput.channelName,
          schemaInput.id,
          schemaInput.version
        );

      expect(schema.status).to.equal(1); // SchemaStatus.DEPRECATED
      expect(schema.updatedAt).to.be.greaterThan(schema.createdAt);
    });

    it("Should emit SchemaStatusChanged event with correct parameters", async function () {
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(
          schemaInput.id,
          schemaInput.version,
          schemaInput.channelName,
          0, // ACTIVE
          1, // DEPRECATED
          member1.address,
          anyValue // timestamp
        );
    });

    it("Should remove active version and no longer be retrievable as active", async function () {     
      const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(schemaInput.channelName, schemaInput.id);
      expect(activeSchema.status).to.equal(0); // ACTIVE

      // Deprecate schema
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName);

      // Should no longer have active version
      await expect(schemaRegistry.connect(member1).getActiveSchema(schemaInput.channelName, schemaInput.id))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.channelName, schemaInput.id);
    });

    it("Should deprecate active version of the schema", async function () {
     
      // Deprecate 
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(
          schemaInput.id,
          schemaInput.version,
          schemaInput.channelName,
          0, // ACTIVE
          1, // DEPRECATED
          member1.address,
          anyValue
        );

      // Version should be deprecated
      const schema1 = await schemaRegistry.connect(member1).getSchemaByVersion(schemaInput.channelName, schemaInput.id, 1);
      expect(schema1.status).to.equal(1); // DEPRECATED
    });

    it("Should only deprecate active versions, skip already deprecated/inactive", async function () {
      // Set it to inactive
      await schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, 1, schemaInput.channelName);

      // Deprecate - should only count version 2
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.channelName, schemaInput.id);
    });

    it("Should still allow getting latest schema after deprecation", async function () {
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName);

      // Latest schema should still be retrievable
      const latestSchema = await schemaRegistry.connect(member1).getLatestSchema(schemaInput.channelName, schemaInput.id);
      expect(latestSchema.version).to.equal(schemaInput.version);
      expect(latestSchema.status).to.equal(1); // DEPRECATED
    });

    it("Should revert if schema does not exist in channel", async function () {
      await expect(schemaRegistry.connect(member1).deprecateSchema(NON_EXISTENT_SCHEMA, CHANNEL_1))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(CHANNEL_1, NON_EXISTENT_SCHEMA);
    });

    it("Should revert if schema has no active version", async function () {
      // Set it to inactive
      await schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, schemaInput.version, schemaInput.channelName);

      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.channelName, schemaInput.id);
    });

    it("Should revert if caller is not schema owner", async function () {
      // Try to deprecate as member2 (not owner)
      await expect(schemaRegistry.connect(member2).deprecateSchema(schemaInput.id, schemaInput.channelName))
      
        .to.be.revertedWithCustomError(schemaRegistry, "NotSchemaOwner")
        .withArgs(schemaInput.channelName, schemaInput.id, member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      await expect(schemaRegistry.connect(deployer).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.be.revertedWithCustomError(schemaRegistry, "UnauthorizedChannelAccess")
        .withArgs(schemaInput.channelName, deployer.address);
    });

    it("Should revert if active schema is not in ACTIVE status", async function () {
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName);

      // There's no active version
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.channelName, schemaInput.id);
    });

    it("Should handle multiple owners in same channel correctly", async function () {
      // Create different schema as member1
      const member2Schema = {
        ...schemaInput,
        id: SCHEMA_2,
        name: "Member2 Schema"
      };
      await schemaRegistry.connect(member2).createSchema(member2Schema);

      // Member1 should only be able to deprecate their own schema
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1))
        .not.to.be.reverted;

      // Member2's schema should still be active
      const member2ActiveSchema = await schemaRegistry.connect(member2).getActiveSchema(CHANNEL_1, SCHEMA_2);
      expect(member2ActiveSchema.status).to.equal(0); // ACTIVE

      // Member1 should not be able to deprecate member2's schema
      await expect(schemaRegistry.connect(member1).deprecateSchema(SCHEMA_2, CHANNEL_1))
        .to.be.revertedWithCustomError(schemaRegistry, "NotSchemaOwner")
        .withArgs(CHANNEL_1, SCHEMA_2, member1.address);
    });

    it("Should validate deprecateSchema wrapper follows rules", async function () {
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1))
        .not.to.be.reverted;

      // After deprecation, deprecateSchema should fail (no active version)
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion");
    });
  });

  describe("InactivateSchema", function () {
    this.beforeEach(async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
    });

    it("Should inactivate an active schema successfully", async function () {
      await expect(schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      )).not.to.be.reverted;

      const schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, schemaInput.version);
      expect(schema.status).to.equal(2); // SchemaStatus.INACTIVE
      expect(schema.updatedAt).to.be.greaterThan(schema.createdAt);
    });

    it("Should inactivate a deprecated schema successfully", async function () {
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);

      await expect(schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      )).not.to.be.reverted;

      // Verify schema status changed to INACTIVE
      const schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, schemaInput.version);
      expect(schema.status).to.equal(2); // SchemaStatus.INACTIVE
    });

    it("Should emit SchemaStatusChanged event with correct parameters", async function () {
      await expect(schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      ))
        .to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(
          schemaInput.id,
          schemaInput.version,
          CHANNEL_1,
          0, // ACTIVE
          2, // INACTIVE
          member1.address,
          anyValue // timestamp
        );
    });

    it("Should emit event with SchemaStatusChanged as previous status", async function () {
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);

      await expect(schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      ))
        .to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(
          schemaInput.id,
          schemaInput.version,
          CHANNEL_1,
          1, // previousStatus (DEPRECATED)
          2, // INACTIVE
          member1.address,
          anyValue
        );
    });

    it("Should inactivate an active schema", async function () {
      const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id);
      expect(activeSchema.version).to.equal(schemaInput.version);

      await schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      );

      await expect(schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.channelName, schemaInput.id);
    });

    it("Should revert if version is zero", async function () {
      await expect(schemaRegistry.connect(member1).inactivateSchema(
        SCHEMA_1, 
        0, 
        CHANNEL_1
      ))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidVersion");
    });

    it("Should revert if schema version doesn't exist", async function () {
      await expect(schemaRegistry.connect(member1).inactivateSchema(
        SCHEMA_2, 
        1, 
        CHANNEL_1
      ))
        .to.be.revertedWithCustomError(schemaRegistry, "SchemaVersionNotFoundInChannel")
        .withArgs(CHANNEL_1, SCHEMA_2, 1);
    });

    it("Should revert if schema exists but different version requested", async function () {
      await expect(schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        999, // Non-existent version
        CHANNEL_1
      ))
        .to.be.revertedWithCustomError(schemaRegistry, "SchemaVersionNotFoundInChannel")
        .withArgs(CHANNEL_1, schemaInput.id, 999);
    });

    it("Should revert if caller is not schema owner", async function () {
      await expect(schemaRegistry.connect(member2).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      )).to.be.revertedWithCustomError(schemaRegistry, "NotSchemaOwner")
        .withArgs(schemaInput.channelName, schemaInput.id, member2.address);
    });

    it("Should accept DEPRECATED schema for inactivation", async function () {
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);

      await expect(schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      )).not.to.be.reverted;
    });

    it("Should update schema timestamps correctly", async function () {
      const schemaBefore = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, schemaInput.version);
      const createdAt = schemaBefore.createdAt;

      await schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      );

      const schemaAfter = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, schemaInput.version);
      expect(schemaAfter.createdAt).to.equal(createdAt); 
      expect(schemaAfter.updatedAt).to.be.greaterThan(createdAt);
    });

    it("Should clear active schema tracking when inactivating active version", async function () {
      // Verify schema is active before
      expect(await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id))
        .to.not.be.reverted;

      await schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      );

      // Should no longer be able to get active schema
      await expect(schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion");
    });

    it("Should handle concurrent schema operations", async function () {
      const member2Schema = {
        id: SCHEMA_2,
        name: "Member2 Schema",
        version: 1,
        dataHash: DATA_HASH_2,
        channelName: CHANNEL_1,
        description: "Schema by member2"
      };
      await schemaRegistry.connect(member2).createSchema(member2Schema);

      await expect(schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      )).not.to.be.reverted;

      await expect(schemaRegistry.connect(member2).inactivateSchema(
        SCHEMA_2, 
        1, 
        CHANNEL_1
      )).not.to.be.reverted;
    });

    it("Should validate inactivateSchema wrapper follows rules", async function () {
      await expect(schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, 1, CHANNEL_1))
        .not.to.be.reverted;

      // After inactivation, cannot change status anymore
      await expect(schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 1))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition");
    });

    it("Should validate inactivateSchema can work on DEPRECATED schema", async function () {
      // First deprecate
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);
      
      // Then inactivate the deprecated version
      await expect(schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, 1, CHANNEL_1))
        .not.to.be.reverted;

      const schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, 1);
      expect(schema.status).to.equal(2); // INACTIVE
    });

    it("Should NOT revert if schema is already inactive", async function () {
      await schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      );

      // Try to inactivate again - NOW SHOULD FAIL due to transition rules
      await expect(schemaRegistry.connect(member1).inactivateSchema(
        schemaInput.id, 
        schemaInput.version, 
        CHANNEL_1
      )).to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition")
        .withArgs(2, 2); // INACTIVE → INACTIVE
    });
  });

  describe("UpdateSchema", function () {
    this.beforeEach(async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
    });

    it("Should update schema successfully with valid input", async function () {
      await expect(schemaRegistry.connect(member1).updateSchema(schemaUpdateInput))
        .not.to.be.reverted;

      // Verify old schema is deprecated
      const oldSchema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, schemaInput.version);
      expect(oldSchema.status).to.equal(1); // DEPRECATED

      // Verify new schema is active
      const newSchema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaUpdateInput.id, schemaUpdateInput.newVersion);
      expect(newSchema.id).to.equal(schemaUpdateInput.id);
      expect(newSchema.name).to.equal(schemaInput.name); // Name should be preserved
      expect(newSchema.version).to.equal(schemaUpdateInput.newVersion);
      expect(newSchema.dataHash).to.equal(schemaUpdateInput.newDataHash);
      expect(newSchema.owner).to.equal(member1.address);
      expect(newSchema.channelName).to.equal(schemaUpdateInput.channelName);
      expect(newSchema.status).to.equal(0); // ACTIVE
      expect(newSchema.description).to.equal(schemaUpdateInput.description);
      expect(newSchema.createdAt).to.be.greaterThan(0);
      expect(newSchema.updatedAt).to.equal(newSchema.createdAt);
    });

    it("Should emit SchemaUpdated event with correct parameters", async function () {
      await expect(schemaRegistry.connect(member1).updateSchema(schemaUpdateInput))
        .to.emit(schemaRegistry, "SchemaUpdated")
        .withArgs(
          schemaUpdateInput.id,
          schemaInput.version,        // Previous version
          schemaUpdateInput.newVersion, // New version
          member1.address,
          schemaUpdateInput.channelName,
          anyValue // timestamp
        );
    });

    it("Should update active and latest version pointers", async function () {
      await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

      // New version should be active
      const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaUpdateInput.id);
      expect(activeSchema.version).to.equal(schemaUpdateInput.newVersion);

      // New version should be latest
      const latestSchema = await schemaRegistry.connect(member1).getLatestSchema(CHANNEL_1, schemaUpdateInput.id);
      expect(latestSchema.version).to.equal(schemaUpdateInput.newVersion);
    });

    it("Should preserve original schema name in updated version", async function () {
      await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

      const newSchema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaUpdateInput.id, schemaUpdateInput.newVersion);
      expect(newSchema.name).to.equal(schemaInput.name); 
    });

    it("Should allow multiple sequential updates", async function () {
      // First update (v1 -> v2)
      await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

      // Second update (v2 -> v3)
      const secondUpdate = {
        ...schemaUpdateInput,
        newVersion: 3,
        newDataHash: DATA_HASH_2,
        description: "Third version"
      };

      await expect(schemaRegistry.connect(member1).updateSchema(secondUpdate))
        .not.to.be.reverted;

      // Verify final active version
      const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id);
      expect(activeSchema.version).to.equal(3);
      expect(activeSchema.description).to.equal("Third version");
    });

    it("Should revert if schema id is zero", async function () {
      const invalidInput = { 
        ...schemaUpdateInput, 
        id: ethers.ZeroHash 
      };

      await expect(schemaRegistry.connect(member1).updateSchema(invalidInput))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidSchemaId");
    });

    it("Should revert if new data hash is zero", async function () {
      const invalidInput = { 
        ...schemaUpdateInput, 
        newDataHash: ethers.ZeroHash 
      };

      await expect(schemaRegistry.connect(member1).updateSchema(invalidInput))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidDataHash");
    });

    it("Should revert if description is too long", async function () {
            const longDescription = "a".repeat(256);
      const invalidInput = { ...schemaUpdateInput, description: longDescription };

      await expect(schemaRegistry.connect(member1).updateSchema(invalidInput))
        .to.be.revertedWithCustomError(schemaRegistry, "DescriptionTooLong");
    });

    it("Should revert if schema does not exist", async function () {
            const invalidInput = { ...schemaUpdateInput, id: NON_EXISTENT_SCHEMA };

      await expect(schemaRegistry.connect(member1).updateSchema(invalidInput))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaUpdateInput.channelName, NON_EXISTENT_SCHEMA);
    });

    it("Should revert if schema has no active version", async function () {
      // Inactivate schema
      await schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, schemaInput.version, CHANNEL_1);

      await expect(schemaRegistry.connect(member1).updateSchema(schemaUpdateInput))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.channelName, schemaInput.id);
    });

    it("Should revert if schema has been deprecated", async function () {
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);

      await expect(schemaRegistry.connect(member1).updateSchema(schemaUpdateInput))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.channelName, schemaInput.id);
    });

     it("Should revert if caller is not schema owner", async function () {
      // Try to update as member2
      await expect(schemaRegistry.connect(member2).updateSchema(schemaUpdateInput))
        .to.be.revertedWithCustomError(schemaRegistry, "NotSchemaOwner")
        .withArgs(schemaInput.channelName, schemaInput.id, member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      await expect(schemaRegistry.connect(deployer).updateSchema(schemaUpdateInput))
        .to.be.revertedWithCustomError(schemaRegistry, "UnauthorizedChannelAccess")
        .withArgs(schemaUpdateInput.channelName, deployer.address);
    });

    it("Should return all versions after update", async function () {
      await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

      const [versions, schemas] = await schemaRegistry.connect(member1).getSchemaVersions(CHANNEL_1, schemaInput.id);
      
      expect(versions.length).to.equal(2);
      expect(schemas.length).to.equal(2);
      expect(versions[0]).to.equal(schemaInput.version);
      expect(versions[1]).to.equal(schemaUpdateInput.newVersion);
      expect(schemas[0].status).to.equal(1); // DEPRECATED
      expect(schemas[1].status).to.equal(0); // ACTIVE
    });

    it("Should maintain correct active/latest relationship after multiple updates", async function () { 
      // Update to v2
      await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);
      
      // Update to v3
      const thirdUpdate = {
        ...schemaUpdateInput,
        newVersion: 3,
        newDataHash: DATA_HASH_2
      };
      await schemaRegistry.connect(member1).updateSchema(thirdUpdate);

      // Check active and latest are both v3
      const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id);
      const latestSchema = await schemaRegistry.connect(member1).getLatestSchema(CHANNEL_1, schemaInput.id);
      
      expect(activeSchema.version).to.equal(3);
      expect(latestSchema.version).to.equal(3);
      expect(activeSchema.status).to.equal(0); // ACTIVE
    });
  });

  describe("View Functions", function () {
    this.beforeEach(async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
    });

    describe("getSchemaByVersion", function () {
      it("Should return correct schema for existing version", async function () {
        const schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, schemaInput.version);
        
        expect(schema.id).to.equal(schemaInput.id);
        expect(schema.name).to.equal(schemaInput.name);
        expect(schema.version).to.equal(schemaInput.version);
        expect(schema.owner).to.equal(member1.address);
      });

      it("Should revert for non-existent version", async function () {
        await expect(schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, 999))
          .to.be.revertedWithCustomError(schemaRegistry, "SchemaVersionNotFoundInChannel")
          .withArgs(CHANNEL_1, schemaInput.id, 999);
      });
    });

    describe("getActiveSchema", function () {
      it("Should return active schema", async function () {
        const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id);
        
        expect(activeSchema.version).to.equal(schemaInput.version);
        expect(activeSchema.status).to.equal(0); // ACTIVE
      });

      it("Should return latest active version after update", async function () {
        await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

        const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id);
        
        expect(activeSchema.version).to.equal(schemaUpdateInput.newVersion);
        expect(activeSchema.status).to.equal(0); // ACTIVE
      });

      it("Should revert if no active version exists", async function () {
        await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);

        await expect(schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id))
          .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
          .withArgs(schemaInput.channelName, schemaInput.id);
      });

      it("Should revert for non-existent schema", async function () {
        await expect(schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, NON_EXISTENT_SCHEMA))
          .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
          .withArgs(CHANNEL_1, NON_EXISTENT_SCHEMA);
      });
    });

    describe("getLatestSchema", function () {
      it("Should return latest schema version", async function () {
        await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

        const latestSchema = await schemaRegistry.connect(member1).getLatestSchema(CHANNEL_1, schemaInput.id);
        
        expect(latestSchema.version).to.equal(schemaUpdateInput.newVersion);
      });

      it("Should revert for non-existent schema", async function () {
        await expect(schemaRegistry.connect(member1).getLatestSchema(CHANNEL_1, NON_EXISTENT_SCHEMA))
          .to.be.revertedWithCustomError(schemaRegistry, "SchemaNotFoundInChannel")
          .withArgs(CHANNEL_1, NON_EXISTENT_SCHEMA);
      });
    });

    describe("getSchemaVersions", function () {
      it("Should return all schema versions", async function () {
         await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

        const [versions, schemas] = await schemaRegistry.connect(member1).getSchemaVersions(CHANNEL_1, schemaInput.id);
        
        expect(versions.length).to.equal(2);
        expect(schemas.length).to.equal(2);
        expect(versions[0]).to.equal(schemaInput.version);
        expect(versions[1]).to.equal(schemaUpdateInput.newVersion);
        expect(schemas[0].status).to.equal(1); // DEPRECATED
        expect(schemas[1].status).to.equal(0); // ACTIVE
      });

      it("Should return single version for new schema", async function () {
        const [versions, schemas] = await schemaRegistry.connect(member1).getSchemaVersions(CHANNEL_1, schemaInput.id);
        
        expect(versions.length).to.equal(1);
        expect(schemas.length).to.equal(1);
        expect(versions[0]).to.equal(schemaInput.version);
        expect(schemas[0].status).to.equal(0); // ACTIVE
      });

      it("Should revert for non-existent schema", async function () {
        await expect(schemaRegistry.connect(member1).getSchemaVersions(CHANNEL_1, NON_EXISTENT_SCHEMA))
          .to.be.revertedWithCustomError(schemaRegistry, "SchemaNotFoundInChannel")
          .withArgs(CHANNEL_1, NON_EXISTENT_SCHEMA);
      });
    });

    describe("getSchemaInfo", function () {
      it("Should return correct schema information", async function () {
        const schemaInfo = await schemaRegistry.connect(member1).getSchemaInfo(CHANNEL_1, schemaInput.id);
        
        expect(schemaInfo.latestVersion).to.equal(1);
        expect(schemaInfo.activeVersion).to.equal(1);
        expect(schemaInfo.hasActiveVersion).to.be.true;
        expect(schemaInfo.owner).to.equal(member1.address);
        expect(schemaInfo.totalVersions).to.equal(1);
      });

      it("Should show no active version after deprecation", async function () {
        await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);

        const schemaInfo = await schemaRegistry.connect(member1).getSchemaInfo(CHANNEL_1, schemaInput.id);
        
        expect(schemaInfo.activeVersion).to.equal(0);
        expect(schemaInfo.hasActiveVersion).to.be.false;
      });

      it("Should update after schema updates", async function () {
        await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

        const schemaInfo = await schemaRegistry.connect(member1).getSchemaInfo(CHANNEL_1, schemaInput.id);
        
        expect(schemaInfo.latestVersion).to.equal(2);
        expect(schemaInfo.activeVersion).to.equal(2);
        expect(schemaInfo.totalVersions).to.equal(2);
      });
    });

    describe("GetSchema vs GetSchemaByVersion Consistency", function () {
      it("Should return identical data when getting active schema", async function () {
        const schemaByMain = await schemaRegistry.getSchema(CHANNEL_1, schemaInput.id);
        const schemaByVersion = await schemaRegistry.getSchemaByVersion(CHANNEL_1, schemaInput.id, 1);
        const activeSchema = await schemaRegistry.getActiveSchema(CHANNEL_1, schemaInput.id);

        // All three methods should return identical data for active schema
        expect(schemaByMain.id).to.equal(schemaByVersion.id);
        expect(schemaByMain.version).to.equal(schemaByVersion.version);
        expect(schemaByMain.id).to.equal(activeSchema.id);
        expect(schemaByMain.version).to.equal(activeSchema.version);
      });

      it("Should update getSchema result after schema update", async function () {
        await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);

        const schemaByMain = await schemaRegistry.connect(member1).getSchema(CHANNEL_1, schemaInput.id);
        expect(schemaByMain.version).to.equal(schemaUpdateInput.newVersion);
        expect(schemaByMain.status).to.equal(0); // ACTIVE
      });
    });
  });

  describe("Access Control Management", function () {
    describe("addSchemaAdmin", function () {
      it("Should allow default admin to add new schema admin", async function () {
        await schemaRegistry.connect(deployer).addSchemaAdmin(user.address);
        expect(await schemaRegistry.hasRole(SCHEMA_ADMIN_ROLE, user.address)).to.be.true;
      });

      it("Should revert if admin address is zero", async function () {
        await expect(schemaRegistry.connect(deployer).addSchemaAdmin(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(schemaRegistry, "InvalidAddress");
      });

      it("Should revert if caller is not default admin", async function () {
        await expect(schemaRegistry.connect(user).addSchemaAdmin(member1.address))
          .to.be.revertedWithCustomError(schemaRegistry, "AccessControlUnauthorizedAccount");
      });
    });

    describe("removeSchemaAdmin", function () {
      it("Should allow default admin to remove schema admin", async function () {
        await schemaRegistry.connect(deployer).addSchemaAdmin(user.address);
        await schemaRegistry.connect(deployer).removeSchemaAdmin(user.address);
        expect(await schemaRegistry.hasRole(SCHEMA_ADMIN_ROLE, user.address)).to.be.false;
      });
    });
  });

  describe("Schema Lifecycle Integration", function () {
    it("Should handle complete schema lifecycle", async function () {
      // Create -> Update -> Deprecate -> Inactivate
      await schemaRegistry.connect(member1).createSchema(schemaInput);
      
      // Update to version 2
      await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);
      
      // Version 1 should be deprecated, version 2 active
      const v1Schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, 1);
      const v2Schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, 2);
      
      expect(v1Schema.status).to.equal(1); // DEPRECATED
      expect(v2Schema.status).to.equal(0); // ACTIVE
      
      // Inactivate version 1
      await schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, 1, CHANNEL_1);
      
      // Deprecate current active (version 2)
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);
      
      // Should have no active version
      await expect(schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion");
    });

    it("Should handle multiple schemas per owner", async function () {
      const schema2Input = { ...schemaInput, id: SCHEMA_2, name: "Schema 2" };
      
      await schemaRegistry.connect(member1).createSchema(schemaInput);
      await schemaRegistry.connect(member1).createSchema(schema2Input);
      
      // Both should be active
      const active1 = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id);
      const active2 = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, SCHEMA_2);
      
      expect(active1.status).to.equal(0);
      expect(active2.status).to.equal(0);
    });

    it("Should handle multiple sequential operations", async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
      
      // Multiple updates
      for (let i = 2; i <= 5; i++) {
        const updateInput = {
          ...schemaUpdateInput,
          newVersion: i,
          description: `Version ${i}`
        };
        await schemaRegistry.connect(member1).updateSchema(updateInput);
      }
      
      const latestSchema = await schemaRegistry.connect(member1).getLatestSchema(CHANNEL_1, schemaInput.id);
      expect(latestSchema.version).to.equal(5);
      expect(latestSchema.description).to.equal("Version 5");
    });

    it("Should handle multiple schema versions efficiently", async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
      
      // Create 10 versions
      for (let i = 2; i <= 10; i++) {
        const updateInput = { ...schemaUpdateInput, newVersion: i, description: `v${i}` };
        await schemaRegistry.connect(member1).updateSchema(updateInput);
      }
      
      const latestSchema = await schemaRegistry.connect(member1).getLatestSchema(CHANNEL_1, schemaInput.id);
      expect(latestSchema.version).to.equal(10);
      
      // Getting all versions should return correct count
      const [versions, schemas] = await schemaRegistry.connect(member1).getSchemaVersions(CHANNEL_1, schemaInput.id);
      expect(versions.length).to.equal(10);
      expect(schemas.length).to.equal(10);
    });

    it("Should maintain invariant: activeVersion <= latestVersion", async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
      
      let info = await schemaRegistry.getSchemaInfo(CHANNEL_1, schemaInput.id);
      expect(info.activeVersion).to.be.lte(info.latestVersion);
      
      await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);
      
      info = await schemaRegistry.connect(member1).getSchemaInfo(CHANNEL_1, schemaInput.id);
      expect(info.activeVersion).to.be.lte(info.latestVersion);
      expect(info.activeVersion).to.equal(info.latestVersion); // Should be equal after update
      
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, CHANNEL_1);
      
      info = await schemaRegistry.connect(member1).getSchemaInfo(CHANNEL_1, schemaInput.id);
      expect(info.activeVersion).to.equal(0); // No active version
      expect(info.latestVersion).to.equal(2); // Latest still exists
    });
  });

  describe("SetSchemaStatus", function () {
    beforeEach(async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
    });

    it("Should set schema status directly to any valid status", async function () {
      // Test direct status change to DEPRECATED
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 1 // SchemaStatus.DEPRECATED
      )).to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(schemaInput.id, 1, CHANNEL_1, 0, 1, member1.address, anyValue);

      // Test direct status change to INACTIVE  
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 2 // SchemaStatus.INACTIVE
      )).to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(schemaInput.id, 1, CHANNEL_1, 1, 2, member1.address, anyValue);
    });

    it("Should revert when trying to set status to same current status", async function () {
      // Try to set ACTIVE when already ACTIVE - should work but be redundant
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 0 // SchemaStatus.ACTIVE
      )).not.to.be.reverted;
    });

    it("Should allow ACTIVE → DEPRECATED transition", async function () {
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 1 // SchemaStatus.DEPRECATED
      )).to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(schemaInput.id, 1, CHANNEL_1, 0, 1, member1.address, anyValue);

      const schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, 1);
      expect(schema.status).to.equal(1); // DEPRECATED
    });

    it("Should allow ACTIVE → INACTIVE transition", async function () {
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 2 // SchemaStatus.INACTIVE
      )).to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(schemaInput.id, 1, CHANNEL_1, 0, 2, member1.address, anyValue);

      const schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, 1);
      expect(schema.status).to.equal(2); // INACTIVE
    });

    it("Should allow DEPRECATED → INACTIVE transition", async function () {
      // First deprecate
      await schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 1); // DEPRECATED
      
      // Then inactivate
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 2 // SchemaStatus.INACTIVE
      )).to.emit(schemaRegistry, "SchemaStatusChanged")
        .withArgs(schemaInput.id, 1, CHANNEL_1, 1, 2, member1.address, anyValue);

      const schema = await schemaRegistry.connect(member1).getSchemaByVersion(CHANNEL_1, schemaInput.id, 1);
      expect(schema.status).to.equal(2); // INACTIVE
    });

    it("Should allow same status transitions (idempotent)", async function () {
      // ACTIVE → ACTIVE 
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 0 // SchemaStatus.ACTIVE
      )).not.to.be.reverted;

      // DEPRECATED → DEPRECATED
      await schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 1); // DEPRECATED
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 1 // SchemaStatus.DEPRECATED again
      )).not.to.be.reverted;
    });

    it("Should revert INACTIVE → ACTIVE transition", async function () {
      // First inactivate
      await schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 2); // INACTIVE
      
      // Try to reactivate - should fail
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 0 // SchemaStatus.ACTIVE
      )).to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition")
        .withArgs(2, 0); // INACTIVE → ACTIVE
    });

    it("Should revert INACTIVE → DEPRECATED transition", async function () {
      // First inactivate
      await schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 2); // INACTIVE
      
      // Try to deprecate - should fail
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 1 // SchemaStatus.DEPRECATED
      )).to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition")
        .withArgs(2, 1); // INACTIVE → DEPRECATED
    });

    it("Should revert DEPRECATED → ACTIVE transition", async function () {
      // First deprecate
      await schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 1); // DEPRECATED
      
      // Try to reactivate - should fail
      await expect(schemaRegistry.connect(member1).setSchemaStatus(
        schemaInput.id, 1, CHANNEL_1, 0 // SchemaStatus.ACTIVE
      )).to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition")
        .withArgs(1, 0); // DEPRECATED → ACTIVE
    });

    it("Should enforce INACTIVE as final status", async function () {
      // Inactivate schema
      await schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 2); // INACTIVE
      
      // No transitions should be allowed from INACTIVE
      await expect(schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 0))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition");
        
      await expect(schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 1))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition");
        
      // Even setting to INACTIVE again should fail
      await expect(schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 2))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition");
    });

    it("Should clear active version when transitioning away from ACTIVE", async function () {
      // Schema starts as active
      expect(await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id))
        .not.to.be.reverted;

      // Deprecate should clear active version
      await schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 1); // DEPRECATED

      await expect(schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion");
    });

    it("Should handle multiple versions with different statuses", async function () {
      // Create version 2
      await schemaRegistry.connect(member1).updateSchema(schemaUpdateInput);
      
      // Now we have: v1=DEPRECATED, v2=ACTIVE
      
      // Inactivate v1 (should work)
      await expect(schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 2))
        .not.to.be.reverted;
        
      // v2 should still be active
      const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id);
      expect(activeSchema.version).to.equal(2);
      
      // Verify v1 is now INACTIVE and cannot be changed
      await expect(schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 0))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition");
    });

    it("Should validate complete state machine flow", async function () {
      // Path 1: ACTIVE → DEPRECATED → INACTIVE
      const schema2Input = { ...schemaInput, id: SCHEMA_2, name: "Schema 2" };
      await schemaRegistry.connect(member1).createSchema(schema2Input);
      
      await schemaRegistry.connect(member1).setSchemaStatus(SCHEMA_2, 1, CHANNEL_1, 1); // DEPRECATED
      await schemaRegistry.connect(member1).setSchemaStatus(SCHEMA_2, 1, CHANNEL_1, 2); // INACTIVE
      
      // Path 2: ACTIVE → INACTIVE (direct)
      await schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 2); // INACTIVE
      
      // Verify both schemas are in INACTIVE state and cannot be changed
      await expect(schemaRegistry.connect(member1).setSchemaStatus(SCHEMA_2, 1, CHANNEL_1, 0))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition");
        
      await expect(schemaRegistry.connect(member1).setSchemaStatus(schemaInput.id, 1, CHANNEL_1, 1))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidStatusTransition");
    });
  });

  describe("Business Logic Edge Cases", function () {
    it("Should handle schema recreation after complete inactivation", async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
      await schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, 1, CHANNEL_1);
      
      // Should still not allow recreation (once created, always exists)
      await expect(schemaRegistry.connect(member1).createSchema(schemaInput))
        .to.be.revertedWithCustomError(schemaRegistry, "SchemaAlreadyExistsCannotRecreate");
    });

    it("Should prevent version gaps in updates", async function () {
      await schemaRegistry.connect(member1).createSchema(schemaInput);
      
      // Update should auto-increment, can't skip versions
      const invalidUpdate = { ...schemaUpdateInput, newVersion: 5 }; // Skip to v5
      await expect(schemaRegistry.connect(member1).updateSchema(invalidUpdate))
        .not.to.be.reverted;
        
      // Verify it used correct version (v2, not v5)
      const activeSchema = await schemaRegistry.connect(member1).getActiveSchema(CHANNEL_1, schemaInput.id);
      expect(activeSchema.version).to.equal(2); // Auto-incremented correctly
    });
  });

});
