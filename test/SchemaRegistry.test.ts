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
  SCHEMA_2,
} from "./utils/index";
import { schemaInput } from "./utils/index";

describe("SchemaRegistry test", function () {
  let accounts: any;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let member1: HardhatEthersSigner;
  let member2: HardhatEthersSigner;

  let schemaRegistry: any;
  let accessChannelManager: any;
  let addressDiscovery: any;

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
    addressDiscovery = deployment.addressDiscovery;

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
        .getSchema(CHANNEL_1, schemaInput.id, schemaInput.version);

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
          "SchemaAlreadyExistsInChannel"
        )
        .withArgs(schemaInput.channelName, schemaInput.id, schemaInput.version);
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

  describe.only("DeprecateSchema", function () {
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
        .getSchema(
          schemaInput.channelName,
          schemaInput.id,
          schemaInput.version
        );

      expect(schema.status).to.equal(1); // SchemaStatus.DEPRECATED
      expect(schema.updatedAt).to.be.greaterThan(schema.createdAt);
    });

    it("Should emit SchemaDeprecated event with correct parameters", async function () {
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.emit(schemaRegistry, "SchemaDeprecated")
        .withArgs(
          schemaInput.id,
          member1.address,
          CHANNEL_1,
          anyValue, // timestamp
          1 // deprecatedCount
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
        .withArgs(schemaInput.id);
    });

    it("Should deprecate multiple active versions of same schema", async function () {
      // Create multiple versions      
      const version2Input = { ...schemaInput, version: 2 };
      await schemaRegistry.connect(member1).createSchema(version2Input);

      const version3Input = { ...schemaInput, version: 3 };
      await schemaRegistry.connect(member1).createSchema(version3Input);

      // Deprecate all versions
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.emit(schemaRegistry, "SchemaDeprecated")
        .withArgs(
          schemaInput.id,
          member1.address,
          schemaInput.channelName,
          anyValue,
          3 // Should deprecate all 3 active versions
        );

      // All versions should be deprecated
      const schema1 = await schemaRegistry.connect(member1).getSchema(schemaInput.channelName, schemaInput.id, 1);
      const schema2 = await schemaRegistry.connect(member1).getSchema(schemaInput.channelName, schemaInput.id, 2);
      const schema3 = await schemaRegistry.connect(member1).getSchema(schemaInput.channelName, schemaInput.id, 3);

      expect(schema1.status).to.equal(1); // DEPRECATED
      expect(schema2.status).to.equal(1); // DEPRECATED
      expect(schema3.status).to.equal(1); // DEPRECATED
    });

    it("Should only deprecate active versions, skip already deprecated/inactive", async function () {
      // Set it to inactive
      await schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, 1, schemaInput.channelName);

      // Create version 2
      const version2Input = { ...schemaInput, version: 2 };
      await schemaRegistry.connect(member1).createSchema(version2Input);

      // Deprecate - should only count version 2
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.emit(schemaRegistry, "SchemaDeprecated")
        .withArgs(
          schemaInput.id,
          member1.address,
          CHANNEL_1,
          anyValue,
          1 // Only 1 active version was deprecated
        );
    });

    it("Should still allow getting latest schema after deprecation", async function () {
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName);

      // Latest schema should still be retrievable
      const latestSchema = await schemaRegistry.connect(member1).getLatestSchema(schemaInput.channelName, schemaInput.id);
      expect(latestSchema.version).to.equal(schemaInput.version);
      expect(latestSchema.status).to.equal(1); // DEPRECATED
    });

    it("Should revert if schema id is zero", async function () {
      const zeroSchemaId = ethers.ZeroHash;

      await expect(schemaRegistry.connect(member1).deprecateSchema(zeroSchemaId, CHANNEL_1))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidSchemaId");
    });

    it("Should revert if schema does not exist in channel", async function () {
      await expect(schemaRegistry.connect(member1).deprecateSchema(NON_EXISTENT_SCHEMA, CHANNEL_1))
        .to.be.revertedWithCustomError(schemaRegistry, "SchemaNotFoundInChannel")
        .withArgs(CHANNEL_1, NON_EXISTENT_SCHEMA);
    });

    it("Should revert if schema has no active version", async function () {
      // Set it to inactive
      await schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, schemaInput.version, schemaInput.channelName);

      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.id);
    });

    it("Should revert if caller is not schema owner", async function () {
      // Try to deprecate as member2 (not owner)
      await expect(schemaRegistry.connect(member2).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.be.revertedWithCustomError(schemaRegistry, "NotSchemaOwner")
        .withArgs(schemaInput.id, member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      await expect(schemaRegistry.connect(deployer).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.be.revertedWithCustomError(schemaRegistry, "UnauthorizedChannelAccess")
        .withArgs(schemaInput.channelName, deployer.address);
    });

    it("Should revert if channel name is zero", async function () {
      const zeroChannelName = ethers.ZeroHash;

      await expect(schemaRegistry.connect(deployer).deprecateSchema(schemaInput.id, zeroChannelName))
        .to.be.revertedWithCustomError(schemaRegistry, "InvalidChannelName")
        .withArgs(zeroChannelName);
    });

    it("Should revert if active schema is not in ACTIVE status", async function () {
      await schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName);

      // Create new version to have an active version again
      const version2Input = { ...schemaInput, version: 2 };
      await schemaRegistry.connect(member1).createSchema(version2Input);

      // Set it to inactive to version 2
      await schemaRegistry.connect(member1).inactivateSchema(schemaInput.id, 2, schemaInput.channelName);

      // There's no active version
      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.be.revertedWithCustomError(schemaRegistry, "NoActiveSchemaVersion")
        .withArgs(schemaInput.id);
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
        .withArgs(SCHEMA_2, member1.address);
    });

    it("Should handle schema with gaps in version numbers", async function () {
      // Create versions 1, 3, 5 (gaps in between)
      await schemaRegistry.connect(member1).createSchema({ ...schemaInput, version: 3 });
      await schemaRegistry.connect(member1).createSchema({ ...schemaInput, version: 5 });

      await expect(schemaRegistry.connect(member1).deprecateSchema(schemaInput.id, schemaInput.channelName))
        .to.emit(schemaRegistry, "SchemaDeprecated")
        .withArgs(
          schemaInput.id,
          member1.address,
          schemaInput.channelName,
          anyValue,
          3 // All 3 existing versions should be deprecated
        );
    });
  });
});
