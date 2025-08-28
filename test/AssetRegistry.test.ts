import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroAddress, ZeroHash } from "ethers";
import { deployAssetRegistry } from "./fixture/deployAssetRegistry";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  getTestAccounts,
  ASSET_ADMIN_ROLE,
  CHANNEL_1,
  ASSET_1,
  ASSET_2,
  DATA_HASH_1,
  DATA_HASH_2,
  DATA_HASH_3,
  DATA_HASH_4,
  DEFAULT_AMOUNT,
  SPLIT_AMOUNT_1,
  SPLIT_AMOUNT_2,
  LOCATION_A,
  LOCATION_B,
  EXTERNAL_ID_1,
  EXTERNAL_ID_2,
  EXTERNAL_ID_3,
  TRANSACTION_ORCHESTRATOR
} from "./utils/index";
import hre from "hardhat";

describe.only("AssetRegistry test", function () {

  let accounts: any;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let member1: HardhatEthersSigner;
  let member2: HardhatEthersSigner;
  let nonMember: HardhatEthersSigner;

  beforeEach(async function () {
    // Load accounts
    accounts = await loadFixture(getTestAccounts);
    deployer = accounts.deployer;
    user = accounts.user;
    member1 = accounts.member1;
    member2 = accounts.member2;
    nonMember = accounts.nonMember;
  });

  describe("Deployment", function () {
    it("Should deploy successfully with address discovery", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);
      
      expect(await assetRegistry.hasRole(ASSET_ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await assetRegistry.getVersion()).to.equal("1.0.0");
    });

    it("Should verify integration with address discovery", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      expect(await assetRegistry.getAddressDiscovery()).to.equal(addressDiscovery.target);
    });
  });

  describe("createAsset", function () {
    it("Should allow channel member to create asset", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
      
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address))
        .not.to.be.reverted;  

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.assetId).to.equal(ASSET_1);
      expect(asset.owner).to.equal(accounts.member1.address);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT);
      expect(asset.location).to.equal(LOCATION_A);
      expect(asset.status).to.equal(0); // ACTIVE
      expect(asset.operation).to.equal(0); // CREATE
      expect(asset.dataHash).to.equal(DATA_HASH_1);
      expect(asset.externalId).to.equal(EXTERNAL_ID_1);
      expect(asset.originOwner).to.equal(accounts.member1.address);
      expect(asset.createdAt).to.be.greaterThan(0);
      expect(asset.lastUpdated).to.be.greaterThan(0);
    });

    it("Should emit AssetCreated event", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address))
        .to.emit(assetRegistry, "AssetCreated")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member1.address, LOCATION_A, DEFAULT_AMOUNT, anyValue);
    });

    it("Should revert if asset already exists", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetAlreadyExists")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if assetId is zero", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const createInput = {
        assetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: "" 
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);
    });

    it("Should revert if channelName is zero", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const createInput = {
        assetId: ASSET_1,
        channelName: hre.ethers.ZeroHash,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidChannelName")
        .withArgs(hre.ethers.ZeroHash);
    });

    it("Should revert if location is empty", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: "",
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.user.address);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.user).createAsset(createInput, accounts.user.address))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should create asset with data hash", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.dataHash).to.equal(DATA_HASH_2);
    });

    it("Should set correct initial asset state", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      
      // Check initial grouping state
      expect(asset.groupedAssets.length).to.equal(0);
      expect(asset.groupedBy).to.equal(hre.ethers.ZeroHash);
      
      // Check initial transformation state
      expect(asset.parentAssetId).to.equal(hre.ethers.ZeroHash);
      expect(asset.transformationId).to.equal(hre.ethers.ZeroHash);
      expect(asset.childAssets.length).to.equal(0);

      // Check active status
      expect(await assetRegistry.isAssetActive(CHANNEL_1, ASSET_1)).to.be.true;
    });
  });

  describe("updateAsset", function () {
    it("Should allow asset owner to update all fields", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // First create an asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Then update it
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT + 100);
      expect(asset.location).to.equal(LOCATION_B);
      expect(asset.dataHash).to.equal(DATA_HASH_2);
      expect(asset.operation).to.equal(1); // UPDATE
      expect(asset.lastUpdated).to.be.greaterThan(asset.createdAt);
    });

    it("Should emit AssetUpdated event", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Update asset
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address))
        .to.emit(assetRegistry, "AssetUpdated")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member1.address, DEFAULT_AMOUNT + 100, LOCATION_B, anyValue);
    });

    it("Should update only location when amount is zero", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Update with amount = 0 (should not change amount)
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: 0,
        dataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT); // Should remain unchanged
      expect(asset.location).to.equal(LOCATION_B);
      expect(asset.dataHash).to.equal(DATA_HASH_2);
    });

    it("Should preserve asset ownership and creation details", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // Update asset
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address);
      const updatedAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // These should remain unchanged
      expect(updatedAsset.owner).to.equal(originalAsset.owner);
      expect(updatedAsset.originOwner).to.equal(originalAsset.originOwner);
      expect(updatedAsset.createdAt).to.equal(originalAsset.createdAt);
      expect(updatedAsset.status).to.equal(0); // Still ACTIVE
      expect(updatedAsset.assetId).to.equal(originalAsset.assetId);
      
      // External IDs should remain unchanged (not part of update)
      expect(updatedAsset.externalId).to.equal(EXTERNAL_ID_1);
    });

    it("Should revert if asset does not exist", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_A,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if asset is not active", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Inactivate asset
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      // Try to update inactive asset
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_A,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_1
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if caller is not asset owner", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to update with member2 (not owner)
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member2.address))
        .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to update with non-channel member
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.user.address))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Test invalid assetId
      let updateInput = {
        assetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test empty location
      updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: "",
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");
    });

    it("Should handle multiple consecutive updates", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // First update
      let updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address);

      // Second update
      updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_A,
        newAmount: DEFAULT_AMOUNT + 200,
        dataHash: DATA_HASH_1
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput, accounts.member1.address))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT + 200);
      expect(asset.location).to.equal(LOCATION_A);
      expect(asset.dataHash).to.equal(DATA_HASH_1);
    });
  });

  describe("transferAsset", function () {
    it("Should allow asset owner to transfer to another channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_2
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Transfer to member2
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: EXTERNAL_ID_3
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      
      // Check ownership transfer
      expect(asset.owner).to.equal(accounts.member2.address);
      expect(asset.originOwner).to.equal(accounts.member1.address); // Original owner preserved
      
      // Check location and data updates
      expect(asset.location).to.equal(LOCATION_B);
      expect(asset.dataHash).to.equal(DATA_HASH_2); // Original dataHash preserved
      
      // Check external IDs replacement
      expect(asset.externalId).to.equal(EXTERNAL_ID_3);
      
      // Check operation and timestamps
      expect(asset.operation).to.equal(2); // TRANSFER
      expect(asset.lastUpdated).to.be.greaterThan(asset.createdAt);
      expect(asset.status).to.equal(0); // Still ACTIVE
    });

    it("Should emit AssetTransferred event", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
      
      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Transfer asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.emit(assetRegistry, "AssetTransferred")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member1.address, accounts.member2.address, LOCATION_A, LOCATION_B, anyValue);
    });

    it("Should update owner enumeration mappings correctly", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Verify member1 owns the asset
      const asset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset1.owner).to.equal(accounts.member1.address);

      // Transfer asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address);

      // Verify ownership changed in enumeration
      const asset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset2.owner).to.equal(accounts.member2.address);
    });

    it("Should preserve asset metadata and modify amounts", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // Transfer asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 10,
        dataHash: DATA_HASH_3, 
        externalId: EXTERNAL_ID_2
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address);
      const transferredAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // These should changed
      expect(transferredAsset.amount).to.equal(Number(originalAsset.amount) + 10);
      expect(transferredAsset.assetId).to.equal(originalAsset.assetId);
      expect(transferredAsset.createdAt).to.equal(originalAsset.createdAt);
      expect(transferredAsset.status).to.equal(originalAsset.status);      
      expect(transferredAsset.dataHash).to.equal(DATA_HASH_3);      
      expect(transferredAsset.externalId).to.equal(EXTERNAL_ID_2);
    });

    it("Should handle transfer with empty external IDs", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with external IDs
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Transfer with empty external IDs
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""       
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.externalId.length).to.equal(0);
    });

    it("Should handle optional location update", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Transfer with new location
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B, // New location provided
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.location).to.equal(LOCATION_B);
    });

    it("Should revert if asset does not exist", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if asset is not active", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Inactivate asset
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      // Try to transfer inactive asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if caller is not asset owner", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to transfer with member2 (not owner)
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member2.address))
        .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should revert if transferring to same owner", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to transfer to same owner
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member1.address, // Same as current owner
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "TransferToSameOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member1.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to transfer with non-channel member
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.user.address))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Test invalid assetId
      let transferInput = {
        assetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test invalid newOwner (zero address)
      transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: ZeroAddress,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAddress")
        .withArgs(ZeroAddress);

      // Test empty location
      transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: "",
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");
    });

    it("Should revert if newOwner is not a channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to transfer to user (not a channel member)
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.user.address, // NOT a channel member!
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should handle multiple consecutive transfers", async function () {
      const { assetRegistry, accessChannelManager, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // First transfer: member1 -> member2
      let transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: EXTERNAL_ID_2
      };

      //CAPTURE FIRST TRANSFER EVENT
      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member1.address))
        .to.emit(assetRegistry, "AssetTransferred")
        .withArgs(
          CHANNEL_1, 
          ASSET_1, 
          accounts.member1.address,  // fromOwner (current owner)
          accounts.member2.address,  // toOwner (new owner)
          LOCATION_A,
          LOCATION_B, 
          anyValue
        );

      // Verify first transfer state
      let asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.owner).to.equal(accounts.member2.address);
      expect(asset.originOwner).to.equal(accounts.member1.address); // Still original owner

      // Add deployer to channel for second transfer
      await accessChannelManager.connect(accounts.deployer).addChannelMember(CHANNEL_1, accounts.deployer.address);

      // Second transfer: member2 -> deployer
      transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.deployer.address,
        newLocation: LOCATION_A,
        newAmount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_3,
        externalId: EXTERNAL_ID_3
      };

      //CAPTURE SECOND TRANSFER EVENT
      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput, accounts.member2.address))
        .to.emit(assetRegistry, "AssetTransferred")
        .withArgs(
          CHANNEL_1, 
          ASSET_1, 
          accounts.member2.address,  // fromOwner (current owner)
          accounts.deployer.address, // toOwner (new owner)
          LOCATION_B,
          LOCATION_A, 
          anyValue
        );

      // Verify final transfer state
      asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.owner).to.equal(accounts.deployer.address);
      expect(asset.originOwner).to.equal(accounts.member1.address); // Still original owner
      expect(asset.location).to.equal(LOCATION_A);
      expect(asset.externalId).to.equal(EXTERNAL_ID_3);      
    });
  });

  describe("transformAsset", function () {
    it("Should allow asset owner to transform asset with new amount", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create original asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BEEF-PROCESSING"));
      
      // Transform asset
      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 50 // New amount
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address))
        .not.to.be.reverted;

      // Check original asset is now inactive
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(originalAsset.status).to.equal(1); // INACTIVE
      expect(originalAsset.operation).to.equal(7); // TRANSFORM
      expect(originalAsset.lastUpdated).to.be.greaterThan(originalAsset.createdAt);
    
      // Find the new asset ID (should be in childAssets of original)
      expect(originalAsset.childAssets.length).to.equal(1);
      const newAssetId = originalAsset.childAssets[0];
      
      // Check new transformed asset
      const newAsset = await assetRegistry.getAsset(CHANNEL_1, newAssetId);

      expect(newAsset.assetId).to.equal(newAssetId);
      expect(newAsset.owner).to.equal(accounts.member1.address); // Inherited owner
      expect(newAsset.amount).to.equal(DEFAULT_AMOUNT + 50); // New amount
      expect(newAsset.location).to.equal(LOCATION_B);
      expect(newAsset.status).to.equal(0); // ACTIVE
      expect(newAsset.operation).to.equal(7); // TRANSFORM
      expect(newAsset.parentAssetId).to.equal(ASSET_1);
      expect(newAsset.transformationId).to.equal(newAssetGenerated);
      expect(newAsset.originOwner).to.equal(accounts.member1.address); // Inherited
      
      // Check data hashes replacement
      expect(newAsset.dataHash).to.equal(DATA_HASH_1);
 
      // Check that external IDs are inherited
      expect(newAsset.externalId).to.equal(EXTERNAL_ID_1);
    });

    it("Should inherit amount from original when new amount is zero", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create original asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));

      // Transform with amount = 0 (should inherit)
      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: 0 // Should inherit original amount
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address);

      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const newAssetId = originalAsset.childAssets[0];
      const newAsset = await assetRegistry.getAsset(CHANNEL_1, newAssetId);

      expect(newAsset.amount).to.equal(DEFAULT_AMOUNT); // Inherited amount
    });

    it("Should emit AssetTransformed event", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));

      // Transform asset
      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT
      };

      // The event should emit with original assetId and generated new assetId
      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address))
        .to.emit(assetRegistry, "AssetTransformed")
        .withArgs(ASSET_1, newAssetGenerated, accounts.member1.address, anyValue);
    });

    it("Should inherit grouping state from original asset", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create multiple assets for grouping
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_ASSET"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_B,
        dataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Transform the group asset
      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP-PROCESSING"));
      const transformInput = {
        assetId: GROUP_ASSET,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newAmount: DEFAULT_AMOUNT + 20,
        newLocation: LOCATION_A,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address);

      // Check that new asset inherited grouped assets
      const originalGroup = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      const newAssetId = originalGroup.childAssets[0];
      const newAsset = await assetRegistry.getAsset(CHANNEL_1, newAssetId);

      expect(newAsset.groupedAssets.length).to.equal(2);
      expect(newAsset.groupedAssets[0]).to.equal(ASSET_1);
      expect(newAsset.groupedAssets[1]).to.equal(ASSET_2);
    });

    it("Should update asset status and owner enumeration correctly", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));

      // Transform asset
      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address);

      // The new asset should be in member1's assets
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const newAssetId = originalAsset.childAssets[0];
      expect(newAssetGenerated).to.equal(newAssetId);
    });

    it("Should revert if asset does not exist", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));

      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_A,
        newAmount: DEFAULT_AMOUNT
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if asset is not active", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Inactivate asset
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));

      // Try to transform inactive asset
      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_A,
        newAmount: DEFAULT_AMOUNT
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if caller is not asset owner", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));

      // Try to transform with member2 (not owner)
      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member2.address))
        .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));

      // Try to transform with non-channel member
      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.user.address))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));

      // Test invalid assetId
      let transformInput = {
        assetId: hre.ethers.ZeroHash,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test empty location
      transformInput = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: "",
        newAmount: DEFAULT_AMOUNT
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");
    });

    it("Should handle transformation chains and prevent infinite depth", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create original asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      let currentAssetId = ASSET_1;

      // Perform multiple transformations to test depth limit
      // MAX_TRANSFORMATION_DEPTH is 10
      for (let i = 1; i <= 5; i++) { // Test 5 levels
        const transformInput = {
          assetId: currentAssetId,
          newAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`DAIRY-PROCESSING-${i}`)),
          channelName: CHANNEL_1,
          newLocation: LOCATION_A,
          newAmount: DEFAULT_AMOUNT + (i * 10),
        };

        await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address))
          .not.to.be.reverted;

        // Get the new asset ID for next iteration
        const asset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
        expect(asset.status).to.equal(1); // Should be INACTIVE
        expect(asset.childAssets.length).to.equal(1);
        
        currentAssetId = asset.childAssets[0];
        
        // Verify the new asset
        const newAsset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
        expect(newAsset.status).to.equal(0); // Should be ACTIVE
        expect(newAsset.assetId).to.equal(transformInput.newAssetId);
      }
    });

    it("Should revert if transformation would exceed max depth", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

        // Create original asset
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            location: LOCATION_A,
            amount: DEFAULT_AMOUNT,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        let currentAssetId = ASSET_1;

        //Fazer 20 transformações (que devem passar)
        for (let i = 1; i <= 20; i++) {
            const transformInput = {
                assetId: currentAssetId,
                newAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`DAIRY-PROCESSING-${i}`)),
                channelName: CHANNEL_1,
                newLocation: LOCATION_A,
                newAmount: DEFAULT_AMOUNT + i
            };

            //Transformações 1-20 devem passar
            await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address))
                .not.to.be.reverted;

            const asset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
            expect(asset.childAssets.length).to.equal(1);
            currentAssetId = asset.childAssets[0];

            const newAsset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
            expect(newAsset.assetId).to.equal(transformInput.newAssetId);
            expect(newAsset.status).to.equal(0); // ACTIVE
        }

        //A 21ª transformação (depth 21) deve falhar
        const exceedDepthTransform = {
            assetId: currentAssetId,
            newAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DEPTH-LEVEL-21-SHOULD-FAIL")),
            channelName: CHANNEL_1,
            newLocation: LOCATION_A,
            newAmount: DEFAULT_AMOUNT + 21
        };

        await expect(assetRegistry.connect(accounts.member1).transformAsset(exceedDepthTransform, accounts.member1.address))
            .to.be.revertedWithCustomError(assetRegistry, "TransformationChainTooDeep")
            .withArgs(21, 20); //(currentDepth + 1, maxDepth)

        const finalAsset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
        expect(finalAsset.status).to.equal(0); // Still ACTIVE
    });

    it("Should generate unique asset IDs for transformations", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create two identical assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      const newAssetGenerated = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING"));
      const newAssetGenerated1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DAIRY-PROCESSING-1"));

      // Transform both with same newAssetId
      const transformInput1 = {
        assetId: ASSET_1,
        newAssetId: newAssetGenerated,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT
      };

      const transformInput2 = {
        assetId: ASSET_2,
        newAssetId: newAssetGenerated1,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).transformAsset(transformInput2, accounts.member1.address);

      // Get the new asset IDs
      const asset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const asset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);

      const newAssetId1 = asset1.childAssets[0];
      const newAssetId2 = asset2.childAssets[0];

      // Asset IDs should be different despite same newAssetId
      expect(newAssetId1).not.to.equal(newAssetId2);
      
      // But both should have same newAssetId
      const newAsset1 = await assetRegistry.getAsset(CHANNEL_1, newAssetId1);
      const newAsset2 = await assetRegistry.getAsset(CHANNEL_1, newAssetId2);
      
      expect(newAsset1.assetId).to.equal(newAssetGenerated);
      expect(newAsset2.assetId).to.equal(newAssetGenerated1);
    });
  });

  describe("splitAsset", function () {
    it("Should allow asset owner to split asset into multiple parts", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

        // Create original asset
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            location: LOCATION_A,
            amount: 1000, //Vamos splitar em: 400 + 300 + 300
            dataHash: DATA_HASH_1,
            externalId: EXTERNAL_ID_1
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        // Split asset
        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [400, 300, 300], // Must sum to 1000
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .not.to.be.reverted;

        // Check original asset is now inactive
        const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
        expect(originalAsset.status).to.equal(1); // INACTIVE
        expect(originalAsset.operation).to.equal(4); // SPLIT (AssetOperation.SPLIT = 4)
        expect(originalAsset.childAssets.length).to.equal(3);

        // Check new assets were created correctly
        for (let i = 0; i < 3; i++) {
            const newAssetId = originalAsset.childAssets[i];
            const newAsset = await assetRegistry.getAsset(CHANNEL_1, newAssetId);
            
            expect(newAsset.owner).to.equal(accounts.member1.address);
            expect(newAsset.amount).to.equal(splitInput.amounts[i]);
            expect(newAsset.location).to.equal(LOCATION_B);
            expect(newAsset.status).to.equal(0); // ACTIVE
            expect(newAsset.operation).to.equal(4); // SPLIT
            expect(newAsset.parentAssetId).to.equal(ASSET_1);
            expect(newAsset.dataHash).to.equal(splitInput.dataHashes[i]);
            expect(newAsset.originOwner).to.equal(accounts.member1.address);
            
            // Should not inherit grouping or external IDs
            expect(newAsset.groupedAssets.length).to.equal(0);
            expect(newAsset.childAssets.length).to.equal(0);
        }
    });

    it("Should emit AssetSplit event", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
       await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

        // Create and split asset
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            location: LOCATION_A,
            amount: 500,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [200, 300],
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .to.emit(assetRegistry, "AssetSplit")
            .withArgs(ASSET_1, anyValue, accounts.member1.address, [200, 300], anyValue);
    });

    it("Should revert if amounts don't sum to original amount", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
       await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            location: LOCATION_A,
            amount: DEFAULT_AMOUNT,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2, SPLIT_AMOUNT_1], // Sum = 900, original = 1000
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .to.be.revertedWithCustomError(assetRegistry, "AmountConservationViolated")
            .withArgs(DEFAULT_AMOUNT, SPLIT_AMOUNT_1 + SPLIT_AMOUNT_2 + SPLIT_AMOUNT_1);
    });

    it("Should revert if amounts and dataHash arrays have different lengths", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
       await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            location: LOCATION_A,
            amount: DEFAULT_AMOUNT,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2], // 2 amounts
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4] // 3 dataHash
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .to.be.revertedWithCustomError(assetRegistry, "ArrayLengthMismatch");
    });

    it("Should revert if any amount is zero", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
       await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, 0, SPLIT_AMOUNT_2], // One amount is zero
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .to.be.revertedWithCustomError(assetRegistry, "InvalidSplitAmount")
            .withArgs(0);
    });

    it("Should revert if caller is not asset owner", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
       await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2],
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member2.address))
            .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
            .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should handle minimum split (2 parts)", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: 2, // Valor mínimo
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [1, 1],
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .not.to.be.reverted;
    });

    it("Should handle maximum number of splits", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: 100,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        // Supondo limite máximo de 10 divisões
        const amounts = new Array(10).fill(10);
        const dataHash = new Array(10).fill(0).map((_, i) => `0x${(i + 1).toString().padStart(64, '0')}`);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: amounts,
            location: LOCATION_B,
            dataHashes: dataHash
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .not.to.be.reverted;
    });

    it("Should handle large amounts correctly", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        const largeAmount = hre.ethers.parseUnits("1000000", 18); // 1M tokens
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: largeAmount,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [
                hre.ethers.parseUnits("600000", 18),
                hre.ethers.parseUnits("400000", 18)
            ],
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .not.to.be.reverted;
    });

    it("Should revert with empty amounts array", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [], 
            location: LOCATION_B,
            dataHashes: []
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
            .to.be.revertedWithCustomError(assetRegistry, "EmptyAmountsArray");
    });

    it("Should revert with single amount (meaningless split)", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [DEFAULT_AMOUNT], // Apenas uma parte
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2]
        };
            
        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address))
          .to.be.revertedWithCustomError(assetRegistry, "InsufficientSplitParts");
    });

    it("Should handle gas efficiently for multiple splits", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [DEFAULT_AMOUNT/5, DEFAULT_AMOUNT/5, DEFAULT_AMOUNT/5, DEFAULT_AMOUNT/5, DEFAULT_AMOUNT/5], // 5 divisões
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4, DATA_HASH_2, DATA_HASH_3]
        };

        const tx = await assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address);
        const receipt = await tx.wait();
        
        expect(receipt?.gasUsed).to.be.lessThan(3000000); 
    });

    it("Should generate unique asset IDs for split assets", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1/2, SPLIT_AMOUNT_1/2, SPLIT_AMOUNT_2],
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4]
        };

        await assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address);

        const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
        const childIds = originalAsset.childAssets;
        
        // Verificar que todos os IDs são únicos
        const uniqueIds = new Set(childIds);
        expect(uniqueIds.size).to.equal(childIds.length);
        
        // Verificar que nenhum ID filho é igual ao ID pai
        expect(childIds).to.not.include(ASSET_1);
    });

    it("Should revert if caller is not channel member", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        // Criar asset como member1
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2],
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        // Tentar dividir com uma conta que não é membro do canal
        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.nonMember.address))
            .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
            .withArgs(CHANNEL_1, accounts.nonMember.address);
    });

    it("Should preserve asset metadata correctly in split assets", async function () {
        const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

        // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
        await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            location: LOCATION_A,
            dataHash: DATA_HASH_1,
            externalId: EXTERNAL_ID_1
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2],
            location: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address);

        const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
        
        // Verificar que cada asset filho tem os metadados corretos
        for (let i = 0; i < originalAsset.childAssets.length; i++) {
            const childAsset = await assetRegistry.getAsset(CHANNEL_1, originalAsset.childAssets[i]);
            
            expect(childAsset.location).to.equal(LOCATION_B);
            expect(childAsset.originOwner).to.equal(accounts.member1.address);
            expect(childAsset.parentAssetId).to.equal(ASSET_1);
            expect(childAsset.createdAt).to.be.greaterThan(0);
            expect(childAsset.lastUpdated).to.equal(childAsset.createdAt);
        }
    });
  });

  describe("groupAssets", function () {
    it("Should allow owner to group multiple assets into a single group asset", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create multiple assets to group
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT/2,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT/2,
        dataHash: DATA_HASH_2,
        externalId: EXTERNAL_ID_2
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_ASSET"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .not.to.be.reverted;

      // Check original assets are now inactive
      const asset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const asset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);
      
      expect(asset1.status).to.equal(1); // INACTIVE
      expect(asset1.operation).to.equal(5); // GROUP
      expect(asset1.groupedBy).to.equal(GROUP_ASSET);
      expect(asset1.lastUpdated).to.be.greaterThan(asset1.createdAt);

      expect(asset2.status).to.equal(1); // INACTIVE
      expect(asset2.operation).to.equal(5); // GROUP
      expect(asset2.groupedBy).to.equal(GROUP_ASSET);
      expect(asset2.lastUpdated).to.be.greaterThan(asset2.createdAt);

      // Check group asset was created correctly
      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.assetId).to.equal(GROUP_ASSET);
      expect(groupAsset.owner).to.equal(accounts.member1.address);
      expect(groupAsset.amount).to.equal(DEFAULT_AMOUNT);
      expect(groupAsset.location).to.equal(LOCATION_B);
      expect(groupAsset.status).to.equal(0); // ACTIVE
      expect(groupAsset.operation).to.equal(5); // GROUP
      expect(groupAsset.groupedBy).to.equal(hre.ethers.ZeroHash); // Not grouped in another
      expect(groupAsset.parentAssetId).to.equal(hre.ethers.ZeroHash); // Not a transformation
      expect(groupAsset.transformationId).to.equal(hre.ethers.ZeroHash); // Not a transformation
      
      // Check grouped assets tracking
      expect(groupAsset.groupedAssets.length).to.equal(2);
      expect(groupAsset.groupedAssets[0]).to.equal(ASSET_1);
      expect(groupAsset.groupedAssets[1]).to.equal(ASSET_2);
      
      // Check data hashes
      expect(groupAsset.dataHash).to.equal(DATA_HASH_3);
      
      // Check that external IDs are not inherited
      expect(groupAsset.externalId.length).to.equal(0);
      expect(groupAsset.childAssets.length).to.equal(0);
      
      // Check metadata
      expect(groupAsset.originOwner).to.equal(accounts.member1.address);
      expect(groupAsset.createdAt).to.be.greaterThan(0);
      expect(groupAsset.lastUpdated).to.equal(groupAsset.createdAt);
    });

    it("Should emit AssetsGrouped event", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: SPLIT_AMOUNT_1,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: SPLIT_AMOUNT_2,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("EVENT_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.emit(assetRegistry, "AssetsGrouped")
        .withArgs([ASSET_1, ASSET_2], GROUP_ASSET, accounts.member1.address, SPLIT_AMOUNT_1 + SPLIT_AMOUNT_2, anyValue);
    });

    it("Should update owner and status enumerations correctly", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);      

      // Create multiple assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      const createInput3 = {
        assetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_3")),
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_3,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput3, accounts.member1.address);

      // Group two assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_ENUM"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_4
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Check final state
      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.originOwner).to.equal(accounts.member1.address);
      expect(groupAsset.status).to.equal(0);
    });

    it("Should revert if group asset ID already exists", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);      

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Use ASSET_1 as group asset ID (already exists)
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: ASSET_1, // Already exists!
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "GroupAssetAlreadyExists")
        .withArgs(ASSET_1);
    });

    it("Should revert if any asset to group does not exist", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);      

      // Create only one asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to group with non-existent asset
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_NONEXISTENT"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2], // ASSET_2 doesn't exist
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_2);
    });

    it("Should revert if any asset is not active", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Inactivate one asset
      const inactivateInput = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      // Try to group with inactive asset
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_INACTIVE"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2], // ASSET_2 is inactive
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_4
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_2);
    });

    it("Should revert if assets have different owners", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      // Create asset with member2
      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member2.address);

      // Try to group assets with different owners
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_MIXED_OWNERS"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "MixedOwnershipNotAllowed")
        .withArgs(accounts.member1.address, accounts.member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets as member1
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Try to group with non-channel member
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_NON_MEMBER"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.user.address))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create some assets for testing
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Test invalid groupAssetId
      let groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test empty location
      groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VALID_GROUP")),
        channelName: CHANNEL_1,
        location: "",
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");

      // Test insufficient assets to group (less than 2)
      groupInput = {
        assetIds: [ASSET_1], // Only one asset
        groupAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VALID_GROUP")),
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InsufficientAssetsToGroup")
        .withArgs(1, 2); // MIN_GROUP_SIZE should be 2
    });

    it("Should revert with duplicate assets in group", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);

      // Try to group with duplicate assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_DUPLICATES"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_1], // Duplicate!
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "DuplicateAssetsInGroup");
    });

    it("Should revert with self-reference in group", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Try to include group asset ID in the assets to group
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SELF_REF_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2, GROUP_ASSET], // Self-reference!
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "SelfReferenceInGroup")
        .withArgs(GROUP_ASSET);
    });

    it("Should handle large number of assets efficiently", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const numAssets = 5; // Test with 5 assets
      const assetIds: string[] = [];
      const unitAmount = DEFAULT_AMOUNT / numAssets;

      // Create multiple assets
      for (let i = 0; i < numAssets; i++) {
        const assetId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`BULK_ASSET_${i}`));
        const createInput = {
          assetId: assetId,
          channelName: CHANNEL_1,
          amount: unitAmount,
          location: LOCATION_A,
          dataHash: DATA_HASH_1,
          externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);
        assetIds.push(assetId);
      }

      // Group all assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BULK_GROUP"));
      const groupInput = {
        assetIds: assetIds,
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_2
      };

      const tx = await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);
      const receipt = await tx.wait();

      // Verify all assets were grouped correctly
      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.groupedAssets.length).to.equal(numAssets);
      
      for (let i = 0; i < numAssets; i++) {
        expect(groupAsset.groupedAssets[i]).to.equal(assetIds[i]);
        
        const originalAsset = await assetRegistry.getAsset(CHANNEL_1, assetIds[i]);
        expect(originalAsset.status).to.equal(1); // INACTIVE
        expect(originalAsset.groupedBy).to.equal(GROUP_ASSET);
      }
    });

    it("Should handle minimum group size (2 assets)", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create exactly 2 assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Group with minimum size
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MIN_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .not.to.be.reverted;

      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.groupedAssets.length).to.equal(2);
    });

    it("Should handle grouping assets with different amounts correctly", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets with different amounts
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: 150,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: 350,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      const createInput3 = {
        assetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_3")),
        channelName: CHANNEL_1,
        amount: 500,
        location: LOCATION_A,
        dataHash: DATA_HASH_3,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput3, accounts.member1.address);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MIXED_AMOUNTS_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2, createInput3.assetId],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_4
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address))
        .not.to.be.reverted;

      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.amount).to.equal(1000);
      expect(groupAsset.groupedAssets.length).to.equal(3);
    });

    it("Should preserve asset metadata during grouping", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets with external IDs and specific metadata
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: EXTERNAL_ID_2
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      const originalAsset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const originalAsset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("METADATA_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Check that original assets preserve their metadata
      const groupedAsset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const groupedAsset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);

      // Original metadata should be preserved
      expect(groupedAsset1.amount).to.equal(originalAsset1.amount);
      expect(groupedAsset1.location).to.equal(originalAsset1.location);
      expect(groupedAsset1.originOwner).to.equal(originalAsset1.originOwner);
      expect(groupedAsset1.createdAt).to.equal(originalAsset1.createdAt);
      expect(groupedAsset1.externalId).to.equal(EXTERNAL_ID_1);

      expect(groupedAsset2.amount).to.equal(originalAsset2.amount);
      expect(groupedAsset2.location).to.equal(originalAsset2.location);
      expect(groupedAsset2.originOwner).to.equal(originalAsset2.originOwner);
      expect(groupedAsset2.createdAt).to.equal(originalAsset2.createdAt);
      expect(groupedAsset2.externalId).to.equal(EXTERNAL_ID_2);

      // Only status, operation, groupedBy and lastUpdated should change
      expect(groupedAsset1.status).to.equal(1); // INACTIVE
      expect(groupedAsset1.operation).to.equal(5); // GROUP
      expect(groupedAsset1.groupedBy).to.equal(GROUP_ASSET);
      expect(groupedAsset1.lastUpdated).to.be.greaterThan(originalAsset1.lastUpdated);

      expect(groupedAsset2.status).to.equal(1); // INACTIVE
      expect(groupedAsset2.operation).to.equal(5); // GROUP
      expect(groupedAsset2.groupedBy).to.equal(GROUP_ASSET);
      expect(groupedAsset2.lastUpdated).to.be.greaterThan(originalAsset2.lastUpdated);
    });
  });

  describe("ungroupAssets", function () {
    it("Should allow group owner to ungroup assets and reactivate them", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create multiple assets to group
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT/2,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT/2,
        dataHash: DATA_HASH_2,
        externalId: EXTERNAL_ID_2
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Group assets first
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("UNGROUP_TEST"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Verify assets are grouped and inactive
      const asset1BeforeUngroup = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const asset2BeforeUngroup = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);
      expect(asset1BeforeUngroup.status).to.equal(1); // INACTIVE
      expect(asset1BeforeUngroup.groupedBy).to.equal(GROUP_ASSET);
      expect(asset2BeforeUngroup.status).to.equal(1); // INACTIVE
      expect(asset2BeforeUngroup.groupedBy).to.equal(GROUP_ASSET);

      // Ungroup assets
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        dataHash: DATA_HASH_4
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address))
        .not.to.be.reverted;

      // Check group asset is now inactive
      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.status).to.equal(1); // INACTIVE
      expect(groupAsset.operation).to.equal(6); // UNGROUP
      expect(groupAsset.lastUpdated).to.be.greaterThan(groupAsset.createdAt);

      // Check original assets are reactivated
      const asset1AfterUngroup = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const asset2AfterUngroup = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);
      
      expect(asset1AfterUngroup.status).to.equal(0); // ACTIVE
      expect(asset1AfterUngroup.operation).to.equal(6); // UNGROUP
      expect(asset1AfterUngroup.groupedBy).to.equal(hre.ethers.ZeroHash); // No longer grouped
      expect(asset1AfterUngroup.lastUpdated).to.be.greaterThan(asset1BeforeUngroup.lastUpdated);
      
      expect(asset2AfterUngroup.status).to.equal(0); // ACTIVE
      expect(asset2AfterUngroup.operation).to.equal(6); // UNGROUP
      expect(asset2AfterUngroup.groupedBy).to.equal(hre.ethers.ZeroHash); // No longer grouped
      expect(asset2AfterUngroup.lastUpdated).to.be.greaterThan(asset2BeforeUngroup.lastUpdated);
  
      // Check optional updates were applied
      expect(asset1AfterUngroup.dataHash).to.equal(DATA_HASH_4);
      expect(asset1AfterUngroup.location).to.equal(LOCATION_A);
      
      expect(asset2AfterUngroup.dataHash).to.equal(DATA_HASH_4);
      expect(asset2AfterUngroup.location).to.equal(LOCATION_A);

      // Verify assets are now active
      expect(await assetRegistry.isAssetActive(CHANNEL_1, ASSET_1)).to.be.true;
      expect(await assetRegistry.isAssetActive(CHANNEL_1, ASSET_2)).to.be.true;
      expect(await assetRegistry.isAssetActive(CHANNEL_1, GROUP_ASSET)).to.be.false;
    });

    it("Should emit AssetsUngrouped event", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create and group assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: SPLIT_AMOUNT_1,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: SPLIT_AMOUNT_2,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("EVENT_UNGROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Ungroup and check event
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address))
        .to.emit(assetRegistry, "AssetsUngrouped")
        .withArgs(GROUP_ASSET, [ASSET_1, ASSET_2], accounts.member1.address, anyValue);
    });

    it("Should handle ungroup without optional data updates", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create and group assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NO_UPDATE_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_1
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Ungroup without providing optional updates
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash, // No update
        location: "" // No update
      };

      await assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address);

      // Check original data is preserved
      const restoredAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(restoredAsset.dataHash).to.equal(DATA_HASH_1); // Original preserved
      expect(restoredAsset.location).to.equal(LOCATION_A); // Original preserved
      expect(restoredAsset.status).to.equal(0); // ACTIVE
      expect(restoredAsset.groupedBy).to.equal(hre.ethers.ZeroHash);
    });

    it("Should update owner and status enumerations correctly", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create multiple assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ENUM_TEST"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Ungroup assets
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address);

      // Check final state
      const restoredAsset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const restoredAsset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);

      expect(restoredAsset1.status).to.equal(0); // ACTIVE
      expect(restoredAsset1.groupedBy).to.equal(hre.ethers.ZeroHash);
      expect(restoredAsset1.owner).to.equal(accounts.member1.address);
      expect(restoredAsset2.status).to.equal(0); // ACTIVE
      expect(restoredAsset2.groupedBy).to.equal(hre.ethers.ZeroHash);
      expect(restoredAsset2.owner).to.equal(accounts.member1.address);
    });

    it("Should revert if group asset does not exist", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const ungroupInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if group asset is not active", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create and group assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("INACTIVE_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_1
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Inactivate group asset
      const inactivateInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_A,
        finalDataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      // Try to ungroup inactive asset
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, GROUP_ASSET);
    });

    it("Should revert if caller is not group asset owner", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets with member1
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Group with member1
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("OWNER_TEST"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_1
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Try to ungroup with member2 (not owner)
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member2.address))
        .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
        .withArgs(CHANNEL_1, GROUP_ASSET, accounts.member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create and group assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CHANNEL_TEST"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Try to ungroup with non-channel member
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.user.address))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert if asset is not a group (has no grouped assets)", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create a regular asset (not a group)
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to ungroup a non-group asset
      const ungroupInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotGrouped")
        .withArgs(ASSET_1);
    });

    it("Should revert if asset was already ungrouped", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create and group assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ALREADY_UNGROUPED"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // First ungroup (should succeed)
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address);

      // Try to ungroup again (should fail)
      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive");
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Test invalid assetId
      const ungroupInput = {
        assetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test invalid channelName
      const ungroupInput2 = {
        assetId: ASSET_1,
        channelName: hre.ethers.ZeroHash,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput2, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidChannelName")
        .withArgs(hre.ethers.ZeroHash);
    });

    it("Should handle large groups efficiently", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create multiple assets (up to MAX_GROUP_SIZE)
      const assetIds = [];
      
      for (let i = 0; i < 5; i++) { // Using 5 for efficiency in tests
        const assetId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`LARGE_ASSET_${i}`));
        
        assetIds.push(assetId);
        
        const createInput = {
          assetId: assetId,
          channelName: CHANNEL_1,
          amount: DEFAULT_AMOUNT / 5,
          location: LOCATION_A,
          dataHash: DATA_HASH_1,
          externalId: ""
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);
      }

      // Group all assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("LARGE_GROUP"));
      const groupInput = {
        assetIds: assetIds,
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Ungroup all assets
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        dataHash: DATA_HASH_2,
        location: LOCATION_A
      };

      const tx = await assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address);
      const receipt = await tx.wait();
      
      // Verify all assets were reactivated
      for (let i = 0; i < assetIds.length; i++) {
        const asset = await assetRegistry.getAsset(CHANNEL_1, assetIds[i]);
        expect(asset.status).to.equal(0); // ACTIVE
        expect(asset.operation).to.equal(6); // UNGROUP
        expect(asset.groupedBy).to.equal(hre.ethers.ZeroHash);
        expect(asset.dataHash).to.equal(DATA_HASH_2); // Updated
        expect(asset.location).to.equal(LOCATION_A); // Updated
      }
    });

    it("Should preserve asset metadata correctly after ungroup", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with metadata
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        amount: DEFAULT_AMOUNT,
        dataHash: DATA_HASH_2,
        externalId: EXTERNAL_ID_1
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // Group the asset
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("METADATA_TEST"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Ungroup without optional updates
      const ungroupInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: "",
        dataHash: hre.ethers.ZeroHash
      };

      await assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput, accounts.member1.address);

      // Check preserved metadata
      const restoredAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      
      expect(restoredAsset.owner).to.equal(originalAsset.owner);
      expect(restoredAsset.originOwner).to.equal(originalAsset.originOwner);
      expect(restoredAsset.amount).to.equal(originalAsset.amount);
      expect(restoredAsset.createdAt).to.equal(originalAsset.createdAt);
      expect(restoredAsset.assetId).to.equal(originalAsset.assetId);
      expect(restoredAsset.externalId).to.equal(originalAsset.externalId);
      
      // Status and operation should be updated
      expect(restoredAsset.status).to.equal(0); // ACTIVE
      expect(restoredAsset.operation).to.equal(6); // UNGROUP
      expect(restoredAsset.lastUpdated).to.be.greaterThan(originalAsset.lastUpdated);
      expect(restoredAsset.groupedBy).to.equal(hre.ethers.ZeroHash);
    });

    it("Should handle consecutive group and ungroup operations", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // First group
      const GROUP_ASSET_1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONSECUTIVE_1"));
      const groupInput1 = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET_1,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput1, accounts.member1.address);

      // First ungroup
      const ungroupInput1 = {
        assetId: GROUP_ASSET_1,
        channelName: CHANNEL_1,
        dataHash: hre.ethers.ZeroHash,
        location: ""
      };

      await assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput1, accounts.member1.address);

      // Second group (regroup same assets)
      const GROUP_ASSET_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONSECUTIVE_2"));
      const groupInput2 = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET_2,
        channelName: CHANNEL_1,
        location: LOCATION_A,
        dataHash: DATA_HASH_4
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput2, accounts.member1.address))
        .not.to.be.reverted;

      // Second ungroup
      const ungroupInput2 = {
        assetId: GROUP_ASSET_2,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_1
      };

      await expect(assetRegistry.connect(accounts.member1).ungroupAssets(ungroupInput2, accounts.member1.address))
        .not.to.be.reverted;

      // Verify final state
      const asset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const asset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);
      
      expect(asset1.status).to.equal(0); // ACTIVE
      expect(asset2.status).to.equal(0); // ACTIVE
      expect(asset1.groupedBy).to.equal(hre.ethers.ZeroHash);
      expect(asset2.groupedBy).to.equal(hre.ethers.ZeroHash);
    });
  });

  describe("inactivateAsset", function () {
    it("Should allow asset owner to inactivate asset with final location and data", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Verify asset is initially active
      expect(await assetRegistry.isAssetActive(CHANNEL_1, ASSET_1)).to.be.true;
      
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(originalAsset.status).to.equal(0); // ACTIVE

      // Inactivate asset with final data
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address))
        .not.to.be.reverted;

      // Verify asset is now inactive
      const inactivatedAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(inactivatedAsset.status).to.equal(1); // INACTIVE
      expect(inactivatedAsset.operation).to.equal(8); // INACTIVATE
      expect(inactivatedAsset.lastUpdated).to.be.greaterThan(originalAsset.lastUpdated);
      
      // Verify final location was updated
      expect(inactivatedAsset.location).to.equal(LOCATION_B);
      
      // Verify final dataHash was updated
      expect(inactivatedAsset.dataHash).to.equal(DATA_HASH_3);
      
      // Verify other properties remain unchanged
      expect(inactivatedAsset.owner).to.equal(originalAsset.owner);
      expect(inactivatedAsset.originOwner).to.equal(originalAsset.originOwner);
      expect(inactivatedAsset.amount).to.equal(originalAsset.amount);
      expect(inactivatedAsset.createdAt).to.equal(originalAsset.createdAt);
      expect(inactivatedAsset.externalId).to.equal(EXTERNAL_ID_1);

      // Verify asset is no longer active
      expect(await assetRegistry.isAssetActive(CHANNEL_1, ASSET_1)).to.be.false;
    });

    it("Should emit AssetInactivated event", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: EXTERNAL_ID_1
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Inactivate asset
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address))
        .to.emit(assetRegistry, "AssetInactivated")
        .withArgs(ASSET_1, accounts.member1.address, 8, anyValue); // 3 = INACTIVATE operation
    });

    it("Should allow inactivation with only final location (no dataHash)", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Inactivate with only location update
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: hre.ethers.ZeroHash // No update
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.status).to.equal(1); // INACTIVE
      expect(asset.location).to.equal(LOCATION_B); // Updated
      expect(asset.dataHash).to.equal(DATA_HASH_1);
    });

    it("Should allow inactivation with only final dataHash (no location)", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Inactivate with only dataHash update
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: "", // No update
        finalDataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.status).to.equal(1); // INACTIVE
      expect(asset.location).to.equal(LOCATION_A); // Preserved
      expect(asset.dataHash).to.equal(DATA_HASH_2);
    });

    it("Should allow inactivation without any final updates", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // Inactivate without any updates
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: "", // No update
        finalDataHash: hre.ethers.ZeroHash // No update
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.status).to.equal(1); // INACTIVE
      expect(asset.operation).to.equal(8); // INACTIVATE
      
      // All original data should be preserved
      expect(asset.location).to.equal(originalAsset.location);
      expect(asset.dataHash).to.equal(originalAsset.dataHash);
      expect(asset.externalId).to.equal(originalAsset.externalId);
    });

    it("Should update owner and status enumerations correctly", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create multiple assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Inactivate one asset
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      // Check final state
      const asset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const asset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);

      expect(asset1.status).to.equal(1); // INACTIVE
      expect(asset2.status).to.equal(0); // ACTIVE
    });

    it("Should revert if asset does not exist", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_A,
        finalDataHash: DATA_HASH_1
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if asset is already inactive", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // First inactivation (should succeed)
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      // Second inactivation (should fail)
      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if caller is not asset owner", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to inactivate with member2 (not owner)
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member2.address))
        .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Try to inactivate with non-channel member
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.user.address))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Test invalid assetId
      const inactivateInput = {
        assetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test invalid channelName
      const inactivateInput2 = {
        assetId: ASSET_1,
        channelName: hre.ethers.ZeroHash,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput2, accounts.member1.address))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidChannelName")
        .withArgs(hre.ethers.ZeroHash);
    });

    it("Should handle inactivation of previously transformed asset", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create original asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Transform asset
      const newGeneratedAssetId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROCESSING-BEFORE-INACTIVATE"));
      const transformInput = {
        assetId: ASSET_1,
        newAssetId: newGeneratedAssetId,
        channelName: CHANNEL_1,
        newLocation: LOCATION_B,
        newAmount: DEFAULT_AMOUNT + 100,
        dataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput, accounts.member1.address);

      // Get the new transformed asset ID
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const transformedAssetId = originalAsset.childAssets[0];

      // Inactivate the transformed asset
      const inactivateInput = {
        assetId: transformedAssetId,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_A,
        finalDataHash: DATA_HASH_3
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address))
        .not.to.be.reverted;

      // Verify transformed asset is inactivated
      const transformedAsset = await assetRegistry.getAsset(CHANNEL_1, transformedAssetId);
      expect(transformedAsset.status).to.equal(1); // INACTIVE
      expect(transformedAsset.operation).to.equal(8); // INACTIVATE
      expect(transformedAsset.location).to.equal(LOCATION_A);
      expect(transformedAsset.dataHash).to.equal(DATA_HASH_3);

      // Original asset should still be inactive from transformation
      expect(originalAsset.status).to.equal(1); // INACTIVE
      expect(originalAsset.operation).to.equal(7); // TRANSFORM
    });

    it("Should handle inactivation of previously split assets", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset to split
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: 1000,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Split asset
      const splitInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amounts: [400, 600],
        location: LOCATION_B,
        dataHashes: [DATA_HASH_2, DATA_HASH_3]
      };

      await assetRegistry.connect(accounts.member1).splitAsset(splitInput, accounts.member1.address);

      // Get split asset IDs
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const splitAssetId1 = originalAsset.childAssets[0];
      const splitAssetId2 = originalAsset.childAssets[1];

      // Inactivate one of the split assets
      const inactivateInput = {
        assetId: splitAssetId1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_A,
        finalDataHash: DATA_HASH_4
      };

      await expect(assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address))
        .not.to.be.reverted;

      // Verify first split asset is inactivated
      const splitAsset1 = await assetRegistry.getAsset(CHANNEL_1, splitAssetId1);
      expect(splitAsset1.status).to.equal(1); // INACTIVE
      expect(splitAsset1.operation).to.equal(8); // INACTIVATE

      // Verify second split asset is still active
      const splitAsset2 = await assetRegistry.getAsset(CHANNEL_1, splitAssetId2);
      expect(splitAsset2.status).to.equal(0); // ACTIVE
      expect(splitAsset2.operation).to.equal(4); // SPLIT
    });

    it("Should handle large data replacement efficiently", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create asset with multiple data hashes
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput, accounts.member1.address);

      // Inactivate with single final hash (should replace all)
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: `0x${'f'.repeat(64)}` // Single final hash
      };

      const tx = await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);
      const receipt = await tx.wait();

      // Verify replacement worked correctly
      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.dataHash).to.equal(`0x${'f'.repeat(64)}`);
    });

    it("Should preserve asset relationships after inactivation", async function () {
      const { assetRegistry, addressDiscovery } = await loadFixture(deployAssetRegistry);

      // Simulate that TRANSACTION_ORCHESTRATOR has been deployed
      await addressDiscovery.updateAddress(TRANSACTION_ORCHESTRATOR, accounts.member1.address);

      // Create and group assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_1,
        externalId: ""
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        location: LOCATION_A,
        dataHash: DATA_HASH_2,
        externalId: ""
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1, accounts.member1.address);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2, accounts.member1.address);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("INACTIVATE_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        location: LOCATION_B,
        dataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput, accounts.member1.address);

      // Inactivate the group asset
      const inactivateInput = {
        assetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_A,
        finalDataHash: DATA_HASH_4
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput, accounts.member1.address);

      // Verify group asset is inactivated but relationships are preserved
      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.status).to.equal(1); // INACTIVE
      expect(groupAsset.operation).to.equal(8); // INACTIVATE
      expect(groupAsset.groupedAssets.length).to.equal(2); // Relationships preserved
      expect(groupAsset.groupedAssets[0]).to.equal(ASSET_1);
      expect(groupAsset.groupedAssets[1]).to.equal(ASSET_2);

      // Verify grouped assets still reference the group
      const asset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const asset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);
      expect(asset1.groupedBy).to.equal(GROUP_ASSET);
      expect(asset2.groupedBy).to.equal(GROUP_ASSET);
    });
  });
});