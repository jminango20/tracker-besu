import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deploySchemaRegistry } from "./fixture/deploySchemaRegistry";
import { ethers } from "hardhat";
import { getTestAccounts } from "./utils/index";
import { 
  CHANNEL_1, 
  SCHEMA_ADMIN_ROLE 
} from "./utils/index";
import { schemaInput } from "./utils/index";

describe("SchemaRegistry test", function () {

  let accounts: any;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let member1: HardhatEthersSigner;

  let schemaRegistry: any;
  let accessChannelManager: any;
  let addressDiscovery: any;
  
  beforeEach(async function () {
    // Load accounts
    accounts = await loadFixture(getTestAccounts);
    deployer = accounts.deployer;
    user = accounts.user;
    member1 = accounts.member1;

    // Load the connected contract system
    const deployment = await loadFixture(deploySchemaRegistry);
    schemaRegistry = deployment.schemaRegistry;
    accessChannelManager = deployment.accessChannelManager;
    addressDiscovery = deployment.addressDiscovery;

    // Setup test data using the connected contracts
    await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
    await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);
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

        const schema = await schemaRegistry.connect(member1).getSchema(
          CHANNEL_1,
          schemaInput.id,
          schemaInput.version
        );

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
          .withArgs(
            schemaInput.channelName,
            schemaInput.id,
            schemaInput.version
          );
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

        await expect(
            schemaRegistry.connect(member1).createSchema(invalidInput)
        ).not.be.reverted;
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
});
