import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
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
  EXTERNAL_ID_3
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
      const { assetRegistry } = await loadFixture(deployAssetRegistry);
      
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
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1, DATA_HASH_2],
        externalIds: [EXTERNAL_ID_1, EXTERNAL_ID_2]
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.assetId).to.equal(ASSET_1);
      expect(asset.owner).to.equal(accounts.member1.address);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT);
      expect(asset.idLocal).to.equal(LOCATION_A);
      expect(asset.status).to.equal(0); // ACTIVE
      expect(asset.operation).to.equal(0); // CREATE
      expect(asset.dataHashes.length).to.equal(2);
      expect(asset.dataHashes[0]).to.equal(DATA_HASH_1);
      expect(asset.dataHashes[1]).to.equal(DATA_HASH_2);
      expect(asset.externalIds.length).to.equal(2);
      expect(asset.externalIds[0]).to.equal(EXTERNAL_ID_1);
      expect(asset.externalIds[1]).to.equal(EXTERNAL_ID_2);
      expect(asset.originOwner).to.equal(accounts.member1.address);
      expect(asset.createdAt).to.be.greaterThan(0);
      expect(asset.lastUpdated).to.be.greaterThan(0);
    });

    it("Should emit AssetCreated event", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput))
        .to.emit(assetRegistry, "AssetCreated")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member1.address, DEFAULT_AMOUNT, LOCATION_A, anyValue);
    });

    it("Should revert if asset already exists", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetAlreadyExists")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if assetId is zero", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);
    });

    it("Should revert if channelName is zero", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: hre.ethers.ZeroHash,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidChannelName")
        .withArgs(hre.ethers.ZeroHash);
    });

    it("Should revert if location is empty", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: "",
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");
    });

    it("Should revert if dataHashes array is empty", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyDataHashes");
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.user).createAsset(createInput))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should create asset with zero external IDs", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member2).createAsset(createInput))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.assetId).to.equal(ASSET_1);
      expect(asset.owner).to.equal(accounts.member2.address);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT);
      expect(asset.idLocal).to.equal(LOCATION_B);
      expect(asset.externalIds.length).to.equal(0);
    });

    it("Should create asset with single data hash", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: [EXTERNAL_ID_1]
      };

      await expect(assetRegistry.connect(accounts.member1).createAsset(createInput))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.dataHashes.length).to.equal(1);
      expect(asset.dataHashes[0]).to.equal(DATA_HASH_2);
      expect(asset.externalIds.length).to.equal(1);
      expect(asset.externalIds[0]).to.equal(EXTERNAL_ID_1);
    });

    it("Should set correct initial asset state", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      
      // Check initial grouping state
      expect(asset.groupedAssets.length).to.equal(0);
      expect(asset.groupedBy).to.equal(hre.ethers.ZeroHash);
      
      // Check initial transformation state
      expect(asset.parentAssetId).to.equal(hre.ethers.ZeroHash);
      expect(asset.transformationId).to.equal("");
      expect(asset.childAssets.length).to.equal(0);

      // Check active status
      expect(await assetRegistry.isAssetActive(CHANNEL_1, ASSET_1)).to.be.true;
    });
  });

  describe("updateAsset", function () {
    it("Should allow asset owner to update all fields", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // First create an asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: [EXTERNAL_ID_1]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Then update it
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2, DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT + 100);
      expect(asset.idLocal).to.equal(LOCATION_B);
      expect(asset.dataHashes.length).to.equal(2);
      expect(asset.dataHashes[0]).to.equal(DATA_HASH_2);
      expect(asset.dataHashes[1]).to.equal(DATA_HASH_3);
      expect(asset.operation).to.equal(1); // UPDATE
      expect(asset.lastUpdated).to.be.greaterThan(asset.createdAt);
    });

    it("Should emit AssetUpdated event", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Update asset
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput))
        .to.emit(assetRegistry, "AssetUpdated")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member1.address, DEFAULT_AMOUNT + 100, LOCATION_B, anyValue);
    });

    it("Should update only location when amount is zero", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Update with amount = 0 (should not change amount)
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: 0,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await assetRegistry.connect(accounts.member1).updateAsset(updateInput);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT); // Should remain unchanged
      expect(asset.idLocal).to.equal(LOCATION_B);
      expect(asset.dataHashes[0]).to.equal(DATA_HASH_2);
    });

    it("Should preserve asset ownership and creation details", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: [EXTERNAL_ID_1]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // Update asset
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await assetRegistry.connect(accounts.member1).updateAsset(updateInput);
      const updatedAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // These should remain unchanged
      expect(updatedAsset.owner).to.equal(originalAsset.owner);
      expect(updatedAsset.originOwner).to.equal(originalAsset.originOwner);
      expect(updatedAsset.createdAt).to.equal(originalAsset.createdAt);
      expect(updatedAsset.status).to.equal(0); // Still ACTIVE
      expect(updatedAsset.assetId).to.equal(originalAsset.assetId);
      
      // External IDs should remain unchanged (not part of update)
      expect(updatedAsset.externalIds.length).to.equal(1);
      expect(updatedAsset.externalIds[0]).to.equal(EXTERNAL_ID_1);
    });

    it("Should completely replace dataHashes array", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with multiple dataHashes
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1, DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Update with single dataHash
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_3]
      };

      await assetRegistry.connect(accounts.member1).updateAsset(updateInput);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.dataHashes.length).to.equal(1);
      expect(asset.dataHashes[0]).to.equal(DATA_HASH_3);
    });

    it("Should revert if asset does not exist", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1]
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if asset is not active", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Inactivate asset
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput);

      // Try to update inactive asset
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1]
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if caller is not asset owner", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to update with member2 (not owner)
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member2).updateAsset(updateInput))
        .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to update with non-channel member
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.user).updateAsset(updateInput))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Test invalid assetId
      let updateInput = {
        assetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test empty location
      updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: "",
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");

      // Test empty dataHashes
      updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: []
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyDataHashes");
    });

    it("Should add update operation to asset history", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Update asset
      const updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await assetRegistry.connect(accounts.member1).updateAsset(updateInput);

      const [operations, timestamps] = await assetRegistry.getAssetHistory(CHANNEL_1, ASSET_1);
      
      expect(operations.length).to.equal(2);
      expect(operations[0]).to.equal(0); // CREATE
      expect(operations[1]).to.equal(1); // UPDATE
      expect(timestamps.length).to.equal(2);
      expect(timestamps[1]).to.be.greaterThan(timestamps[0]);
    });

    it("Should handle multiple consecutive updates", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // First update
      let updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 100,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await assetRegistry.connect(accounts.member1).updateAsset(updateInput);

      // Second update
      updateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 200,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1, DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member1).updateAsset(updateInput))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.amount).to.equal(DEFAULT_AMOUNT + 200);
      expect(asset.idLocal).to.equal(LOCATION_A);
      expect(asset.dataHashes.length).to.equal(2);

      // Check history has 3 operations (CREATE + 2 UPDATEs)
      const [operations] = await assetRegistry.getAssetHistory(CHANNEL_1, ASSET_1);
      expect(operations.length).to.equal(3);
      expect(operations[0]).to.equal(0); // CREATE
      expect(operations[1]).to.equal(1); // UPDATE
      expect(operations[2]).to.equal(1); // UPDATE
    });
  });

  describe("transferAsset", function () {
    it("Should allow asset owner to transfer to another channel member", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: [EXTERNAL_ID_1]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transfer to member2
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: [EXTERNAL_ID_2, EXTERNAL_ID_3]
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .not.to.be.reverted;

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      
      // Check ownership transfer
      expect(asset.owner).to.equal(accounts.member2.address);
      expect(asset.originOwner).to.equal(accounts.member1.address); // Original owner preserved
      
      // Check location and data updates
      expect(asset.idLocal).to.equal(LOCATION_B);
      expect(asset.dataHashes.length).to.equal(1); // dataHashes NOT updated in transfer
      expect(asset.dataHashes[0]).to.equal(DATA_HASH_1); // Original dataHashes preserved
      
      // Check external IDs replacement
      expect(asset.externalIds.length).to.equal(2);
      expect(asset.externalIds[0]).to.equal(EXTERNAL_ID_2);
      expect(asset.externalIds[1]).to.equal(EXTERNAL_ID_3);
      
      // Check operation and timestamps
      expect(asset.operation).to.equal(2); // TRANSFER
      expect(asset.lastUpdated).to.be.greaterThan(asset.createdAt);
      expect(asset.status).to.equal(0); // Still ACTIVE
    });

    it("Should emit AssetTransferred event", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transfer asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.emit(assetRegistry, "AssetTransferred")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member1.address, accounts.member2.address, LOCATION_B, anyValue);
    });

    it("Should update owner enumeration mappings correctly", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Verify member1 owns the asset
      let [member1Assets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member1.address, 1, 10);
      expect(member1Assets.length).to.equal(1);
      expect(member1Assets[0]).to.equal(ASSET_1);

      // Verify member2 has no assets
      let [member2Assets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member2.address, 1, 10);
      expect(member2Assets.length).to.equal(0);

      // Transfer asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput);

      // Verify ownership changed in enumeration
      [member1Assets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member1.address, 1, 10);
      expect(member1Assets.length).to.equal(0);

      [member2Assets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member2.address, 1, 10);
      expect(member2Assets.length).to.equal(1);
      expect(member2Assets[0]).to.equal(ASSET_1);
    });

    it("Should preserve asset metadata and not modify amounts", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1, DATA_HASH_2],
        externalIds: [EXTERNAL_ID_1]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // Transfer asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3], // This should NOT change dataHashes
        externalIds: [EXTERNAL_ID_2]
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput);
      const transferredAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);

      // These should remain unchanged
      expect(transferredAsset.amount).to.equal(originalAsset.amount);
      expect(transferredAsset.assetId).to.equal(originalAsset.assetId);
      expect(transferredAsset.createdAt).to.equal(originalAsset.createdAt);
      expect(transferredAsset.status).to.equal(originalAsset.status);
      
      // DataHashes should NOT be changed in transfer (only externalIds are replaced)
      expect(transferredAsset.dataHashes.length).to.equal(2);
      expect(transferredAsset.dataHashes[0]).to.equal(DATA_HASH_1);
      expect(transferredAsset.dataHashes[1]).to.equal(DATA_HASH_2);
      
      // External IDs should be replaced
      expect(transferredAsset.externalIds.length).to.equal(1);
      expect(transferredAsset.externalIds[0]).to.equal(EXTERNAL_ID_2);
    });

    it("Should handle transfer with empty external IDs", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with external IDs
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: [EXTERNAL_ID_1, EXTERNAL_ID_2]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transfer with empty external IDs
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: [] // Empty array should clear external IDs
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.externalIds.length).to.equal(0);
    });

    it("Should handle optional location update", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transfer with new location
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B, // New location provided
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput);

      const asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.idLocal).to.equal(LOCATION_B);
    });

    it("Should revert if asset does not exist", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if asset is not active", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Inactivate asset
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput);

      // Try to transfer inactive asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if caller is not asset owner", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to transfer with member2 (not owner)
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member2).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should revert if transferring to same owner", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to transfer to same owner
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member1.address, // Same as current owner
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "TransferToSameOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member1.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to transfer with non-channel member
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.user).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Test invalid assetId
      let transferInput = {
        assetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test invalid newOwner (zero address)
      transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: ZeroAddress,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAddress")
        .withArgs(ZeroAddress);

      // Test empty location
      transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: "",
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");

      // Test empty dataHashes
      transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyDataHashes");
    });

    it("Should revert if newOwner is not a channel member", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to transfer to user (not a channel member)
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.user.address, // NOT a channel member!
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should add transfer operation to asset history", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transfer asset
      const transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).transferAsset(transferInput);

      const [operations, timestamps] = await assetRegistry.getAssetHistory(CHANNEL_1, ASSET_1);
      
      expect(operations.length).to.equal(2);
      expect(operations[0]).to.equal(0); // CREATE
      expect(operations[1]).to.equal(2); // TRANSFER
      expect(timestamps.length).to.equal(2);
      expect(timestamps[1]).to.be.greaterThan(timestamps[0]);
    });

    it("Should handle multiple consecutive transfers", async function () {
      const { assetRegistry, accessChannelManager } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: [EXTERNAL_ID_1]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // First transfer: member1 -> member2
      let transferInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        newOwner: accounts.member2.address,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2],
        externalIds: [EXTERNAL_ID_2]
      };

      //CAPTURE FIRST TRANSFER EVENT
      await expect(assetRegistry.connect(accounts.member1).transferAsset(transferInput))
        .to.emit(assetRegistry, "AssetTransferred")
        .withArgs(
          CHANNEL_1, 
          ASSET_1, 
          accounts.member1.address,  // fromOwner (current owner)
          accounts.member2.address,  // toOwner (new owner)
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
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_3],
        externalIds: [EXTERNAL_ID_3]
      };

      //CAPTURE SECOND TRANSFER EVENT
      await expect(assetRegistry.connect(accounts.member2).transferAsset(transferInput))
        .to.emit(assetRegistry, "AssetTransferred")
        .withArgs(
          CHANNEL_1, 
          ASSET_1, 
          accounts.member2.address,  // fromOwner (current owner)
          accounts.deployer.address, // toOwner (new owner)
          LOCATION_A, 
          anyValue
        );

      // Verify final transfer state
      asset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      expect(asset.owner).to.equal(accounts.deployer.address);
      expect(asset.originOwner).to.equal(accounts.member1.address); // Still original owner
      expect(asset.idLocal).to.equal(LOCATION_A);
      expect(asset.externalIds[0]).to.equal(EXTERNAL_ID_3);      

      // Check history has 3 operations (CREATE + 2 TRANSFERs)
      const [operations] = await assetRegistry.getAssetHistory(CHANNEL_1, ASSET_1);
      expect(operations.length).to.equal(3);
      expect(operations[0]).to.equal(0); // CREATE
      expect(operations[1]).to.equal(2); // TRANSFER
      expect(operations[2]).to.equal(2); // TRANSFER

      // Check owner enumeration
      let [member1Assets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member1.address, 1, 10);
      expect(member1Assets.length).to.equal(0);

      let [member2Assets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member2.address, 1, 10);
      expect(member2Assets.length).to.equal(0);

      let [deployerAssets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.deployer.address, 1, 10);
      expect(deployerAssets.length).to.equal(1);
      expect(deployerAssets[0]).to.equal(ASSET_1);
    });
  });

  describe("transformAsset", function () {
    it("Should allow asset owner to transform asset with new amount", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create original asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: [EXTERNAL_ID_1]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transform asset
      const transformInput = {
        assetId: ASSET_1,
        transformationId: "BEEF-PROCESSING",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 50, // New amount
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2, DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
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
      expect(newAsset.idLocal).to.equal(LOCATION_B);
      expect(newAsset.status).to.equal(0); // ACTIVE
      expect(newAsset.operation).to.equal(7); // TRANSFORM
      expect(newAsset.parentAssetId).to.equal(ASSET_1);
      expect(newAsset.transformationId).to.equal("BEEF-PROCESSING");
      expect(newAsset.originOwner).to.equal(accounts.member1.address); // Inherited
      
      // Check data hashes replacement
      expect(newAsset.dataHashes.length).to.equal(2);
      expect(newAsset.dataHashes[0]).to.equal(DATA_HASH_2);
      expect(newAsset.dataHashes[1]).to.equal(DATA_HASH_3);

      // Check that external IDs are inherited
      expect(newAsset.externalIds.length).to.equal(1);
      expect(newAsset.externalIds[0]).to.equal(EXTERNAL_ID_1);
    });

    it("Should inherit amount from original when new amount is zero", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create original asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transform with amount = 0 (should inherit)
      const transformInput = {
        assetId: ASSET_1,
        transformationId: "DAIRY-PROCESSING",
        channelName: CHANNEL_1,
        amount: 0, // Should inherit original amount
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput);

      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const newAssetId = originalAsset.childAssets[0];
      const newAsset = await assetRegistry.getAsset(CHANNEL_1, newAssetId);

      expect(newAsset.amount).to.equal(DEFAULT_AMOUNT); // Inherited amount
    });

    it("Should emit AssetTransformed event", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transform asset
      const transformInput = {
        assetId: ASSET_1,
        transformationId: "PROCESSING-001",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      // The event should emit with original assetId and generated new assetId
      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
        .to.emit(assetRegistry, "AssetTransformed")
        .withArgs(ASSET_1, anyValue, accounts.member1.address, "PROCESSING-001", anyValue);
    });

    it("Should inherit grouping state from original asset", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create multiple assets for grouping
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_ASSET"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput);

      // Transform the group asset
      const transformInput = {
        assetId: GROUP_ASSET,
        transformationId: "GROUP-PROCESSING",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT + 20,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_3]
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput);

      // Check that new asset inherited grouped assets
      const originalGroup = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      const newAssetId = originalGroup.childAssets[0];
      const newAsset = await assetRegistry.getAsset(CHANNEL_1, newAssetId);

      expect(newAsset.groupedAssets.length).to.equal(2);
      expect(newAsset.groupedAssets[0]).to.equal(ASSET_1);
      expect(newAsset.groupedAssets[1]).to.equal(ASSET_2);
    });

    it("Should update asset status and owner enumeration correctly", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Check initial status enumeration
      let [activeAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 0, 1, 10); // ACTIVE
      expect(activeAssets.length).to.equal(1);
      expect(activeAssets[0]).to.equal(ASSET_1);

      let [inactiveAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 1, 1, 10); // INACTIVE
      expect(inactiveAssets.length).to.equal(0);

      // Transform asset
      const transformInput = {
        assetId: ASSET_1,
        transformationId: "STATUS-TEST",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput);

      // Check status enumeration after transform
      [activeAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 0, 1, 10); // ACTIVE
      expect(activeAssets.length).to.equal(1); // Only new asset is active

      [inactiveAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 1, 1, 10); // INACTIVE
      expect(inactiveAssets.length).to.equal(1); // Original asset is now inactive
      expect(inactiveAssets[0]).to.equal(ASSET_1);

      // Check owner enumeration (member1 should still have 1 asset - the new one)
      const [ownerAssets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member1.address, 1, 10);
      expect(ownerAssets.length).to.equal(1);

      // The new asset should be in member1's assets
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const newAssetId = originalAsset.childAssets[0];
      expect(ownerAssets[0]).to.equal(newAssetId);
    });

    it("Should add transform operations to both assets history", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Transform asset
      const transformInput = {
        assetId: ASSET_1,
        transformationId: "HISTORY-TEST",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput);

      // Check original asset history
      let [operations, timestamps] = await assetRegistry.getAssetHistory(CHANNEL_1, ASSET_1);
      expect(operations.length).to.equal(2);
      expect(operations[0]).to.equal(0); // CREATE
      expect(operations[1]).to.equal(7); // TRANSFORM

      // Check new asset history
      const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const newAssetId = originalAsset.childAssets[0];
      [operations, timestamps] = await assetRegistry.getAssetHistory(CHANNEL_1, newAssetId);
      expect(operations.length).to.equal(1);
      expect(operations[0]).to.equal(7); // TRANSFORM
    });

    it("Should revert if asset does not exist", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const transformInput = {
        assetId: ASSET_1,
        transformationId: "NON-EXISTENT-TEST",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1]
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if asset is not active", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Inactivate asset
      const inactivateInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_2
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput);

      // Try to transform inactive asset
      const transformInput = {
        assetId: ASSET_1,
        transformationId: "INACTIVE-TEST",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1]
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_1);
    });

    it("Should revert if caller is not asset owner", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to transform with member2 (not owner)
      const transformInput = {
        assetId: ASSET_1,
        transformationId: "OWNERSHIP-TEST",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member2).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
        .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to transform with non-channel member
      const transformInput = {
        assetId: ASSET_1,
        transformationId: "CHANNEL-TEST",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.user).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset first
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Test invalid assetId
      let transformInput = {
        assetId: hre.ethers.ZeroHash,
        transformationId: "VALID-ID",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test empty transformationId
      transformInput = {
        assetId: ASSET_1,
        transformationId: "",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidTransformationId");

      // Test very long transformationId (>64 chars)
      transformInput = {
        assetId: ASSET_1,
        transformationId: "A".repeat(65), // 65 characters
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidTransformationId");

      // Test empty location
      transformInput = {
        assetId: ASSET_1,
        transformationId: "VALID-ID",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: "",
        dataHashes: [DATA_HASH_2]
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");

      // Test empty dataHashes
      transformInput = {
        assetId: ASSET_1,
        transformationId: "VALID-ID",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: []
      };

      await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyDataHashes");
    });

    it("Should handle transformation chains and prevent infinite depth", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create original asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      let currentAssetId = ASSET_1;

      // Perform multiple transformations to test depth limit
      // MAX_TRANSFORMATION_DEPTH is 10
      for (let i = 1; i <= 5; i++) { // Test 5 levels
        const transformInput = {
          assetId: currentAssetId,
          transformationId: `LEVEL-${i}`,
          channelName: CHANNEL_1,
          amount: DEFAULT_AMOUNT + (i * 10),
          idLocal: LOCATION_A,
          dataHashes: [DATA_HASH_1]
        };

        await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
          .not.to.be.reverted;

        // Get the new asset ID for next iteration
        const asset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
        expect(asset.status).to.equal(1); // Should be INACTIVE
        expect(asset.childAssets.length).to.equal(1);
        
        currentAssetId = asset.childAssets[0];
        
        // Verify the new asset
        const newAsset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
        expect(newAsset.status).to.equal(0); // Should be ACTIVE
        expect(newAsset.transformationId).to.equal(`LEVEL-${i}`);
      }

      // Verify transformation chain using getTransformationHistory
      const transformationChain = await assetRegistry.getTransformationHistory(CHANNEL_1, currentAssetId);
      expect(transformationChain.length).to.be.greaterThan(1);
      expect(transformationChain[0]).to.equal(ASSET_1);
    });

    it("Should revert if transformation would exceed max depth", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        // Create original asset
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        let currentAssetId = ASSET_1;

        //Fazer 20 transformações (que devem passar)
        for (let i = 1; i <= 20; i++) {
            const transformInput = {
                assetId: currentAssetId,
                transformationId: `DEPTH-LEVEL-${i}`,
                channelName: CHANNEL_1,
                amount: DEFAULT_AMOUNT + i,
                idLocal: LOCATION_A,
                dataHashes: [DATA_HASH_1]
            };

            //Transformações 1-20 devem passar
            await expect(assetRegistry.connect(accounts.member1).transformAsset(transformInput))
                .not.to.be.reverted;

            const asset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
            expect(asset.childAssets.length).to.equal(1);
            currentAssetId = asset.childAssets[0];

            const newAsset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
            expect(newAsset.transformationId).to.equal(`DEPTH-LEVEL-${i}`);
            expect(newAsset.status).to.equal(0); // ACTIVE
        }

        //A 21ª transformação (depth 21) deve falhar
        const exceedDepthTransform = {
            assetId: currentAssetId,
            transformationId: "DEPTH-LEVEL-21-SHOULD-FAIL",
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT + 21,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1]
        };

        await expect(assetRegistry.connect(accounts.member1).transformAsset(exceedDepthTransform))
            .to.be.revertedWithCustomError(assetRegistry, "TransformationChainTooDeep")
            .withArgs(21, 20); //(currentDepth + 1, maxDepth)

        //Verificar chain tem 21 assets (original + 20 transformações)
        const transformationChain = await assetRegistry.getTransformationHistory(CHANNEL_1, currentAssetId);
        expect(transformationChain.length).to.equal(21);
        
        expect(transformationChain[0]).to.equal(ASSET_1); // Original primeiro
        expect(transformationChain[20]).to.equal(currentAssetId); // 20ª transformação por último

        const finalAsset = await assetRegistry.getAsset(CHANNEL_1, currentAssetId);
        expect(finalAsset.status).to.equal(0); // Still ACTIVE
        expect(finalAsset.transformationId).to.equal("DEPTH-LEVEL-20"); //Última válida
    });

    it("Should generate unique asset IDs for transformations", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create two identical assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Transform both with same transformationId
      const transformInput1 = {
        assetId: ASSET_1,
        transformationId: "IDENTICAL-PROCESSING",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      const transformInput2 = {
        assetId: ASSET_2,
        transformationId: "IDENTICAL-PROCESSING",
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2]
      };

      await assetRegistry.connect(accounts.member1).transformAsset(transformInput1);
      await assetRegistry.connect(accounts.member1).transformAsset(transformInput2);

      // Get the new asset IDs
      const asset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const asset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);

      const newAssetId1 = asset1.childAssets[0];
      const newAssetId2 = asset2.childAssets[0];

      // Asset IDs should be different despite same transformationId
      expect(newAssetId1).not.to.equal(newAssetId2);
      
      // But both should have same transformationId
      const newAsset1 = await assetRegistry.getAsset(CHANNEL_1, newAssetId1);
      const newAsset2 = await assetRegistry.getAsset(CHANNEL_1, newAssetId2);
      
      expect(newAsset1.transformationId).to.equal("IDENTICAL-PROCESSING");
      expect(newAsset2.transformationId).to.equal("IDENTICAL-PROCESSING");
    });
  });

  describe("splitAsset", function () {
    it("Should allow asset owner to split asset into multiple parts", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        // Create original asset
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: 1000, //Vamos splitar em: 400 + 300 + 300
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: [EXTERNAL_ID_1]
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        // Split asset
        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [400, 300, 300], // Must sum to 1000
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
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
            expect(newAsset.idLocal).to.equal(LOCATION_B);
            expect(newAsset.status).to.equal(0); // ACTIVE
            expect(newAsset.operation).to.equal(4); // SPLIT
            expect(newAsset.parentAssetId).to.equal(ASSET_1);
            expect(newAsset.transformationId).to.equal(`SPLIT_${i + 1}`);
            expect(newAsset.dataHashes.length).to.equal(1);
            expect(newAsset.dataHashes[0]).to.equal(splitInput.dataHashes[i]);
            expect(newAsset.originOwner).to.equal(accounts.member1.address);
            
            // Should not inherit grouping or external IDs
            expect(newAsset.groupedAssets.length).to.equal(0);
            expect(newAsset.externalIds.length).to.equal(0);
            expect(newAsset.childAssets.length).to.equal(0);
        }
    });

    it("Should emit AssetSplit event", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        // Create and split asset
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: 500,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [200, 300],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
            .to.emit(assetRegistry, "AssetSplit")
            .withArgs(ASSET_1, anyValue, accounts.member1.address, [200, 300], anyValue);
    });

    it("Should revert if amounts don't sum to original amount", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2, SPLIT_AMOUNT_1], // Sum = 900, original = 1000
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
            .to.be.revertedWithCustomError(assetRegistry, "AmountConservationViolated")
            .withArgs(DEFAULT_AMOUNT, SPLIT_AMOUNT_1 + SPLIT_AMOUNT_2 + SPLIT_AMOUNT_1);
    });

    it("Should revert if amounts and dataHashes arrays have different lengths", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2], // 2 amounts
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4] // 3 dataHashes
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
            .to.be.revertedWithCustomError(assetRegistry, "ArrayLengthMismatch");
    });

    it("Should revert if any amount is zero", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, 0, SPLIT_AMOUNT_2], // One amount is zero
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
            .to.be.revertedWithCustomError(assetRegistry, "InvalidSplitAmount")
            .withArgs(0);
    });

    it("Should update owner and status enumerations correctly", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        // Check initial state
        let [activeAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 0, 1, 10);
        expect(activeAssets.length).to.equal(1);

        let [ownerAssets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member1.address, 1, 10);
        expect(ownerAssets.length).to.equal(1);

        // Split asset
        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await assetRegistry.connect(accounts.member1).splitAsset(splitInput);

        // Check final state
        [activeAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 0, 1, 10);
        expect(activeAssets.length).to.equal(2); // 2 new active assets

        let [inactiveAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 1, 1, 10);
        expect(inactiveAssets.length).to.equal(1); // 1 inactive (original)

        [ownerAssets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member1.address, 1, 10);
        expect(ownerAssets.length).to.equal(2); // Owner now has 2 assets (new splits)
    });

    it("Should revert if caller is not asset owner", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await expect(assetRegistry.connect(accounts.member2).splitAsset(splitInput))
            .to.be.revertedWithCustomError(assetRegistry, "NotAssetOwner")
            .withArgs(CHANNEL_1, ASSET_1, accounts.member2.address);
    });

    it("Should add split operations to asset history", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);

        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await assetRegistry.connect(accounts.member1).splitAsset(splitInput);

        // Check original asset history
        let [operations] = await assetRegistry.getAssetHistory(CHANNEL_1, ASSET_1);
        expect(operations.length).to.equal(2);
        expect(operations[0]).to.equal(0); // CREATE
        expect(operations[1]).to.equal(4); // SPLIT

        // Check new assets history
        const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
        for (let i = 0; i < 2; i++) {
            const newAssetId = originalAsset.childAssets[i];
            [operations] = await assetRegistry.getAssetHistory(CHANNEL_1, newAssetId);
            expect(operations.length).to.equal(1);
            expect(operations[0]).to.equal(4); // SPLIT
        }
    });

    it("Should handle minimum split (2 parts)", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: 2, // Valor mínimo
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [1, 1],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
            .not.to.be.reverted;
    });

    it("Should handle maximum number of splits", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: 100,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        // Supondo limite máximo de 10 divisões
        const amounts = new Array(10).fill(10);
        const dataHashes = new Array(10).fill(0).map((_, i) => `0x${(i + 1).toString().padStart(64, '0')}`);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: amounts,
            idLocal: LOCATION_B,
            dataHashes: dataHashes
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
            .not.to.be.reverted;
    });

    it("Should handle large amounts correctly", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        const largeAmount = hre.ethers.parseUnits("1000000", 18); // 1M tokens
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: largeAmount,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [
                hre.ethers.parseUnits("600000", 18),
                hre.ethers.parseUnits("400000", 18)
            ],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
            .not.to.be.reverted;
    });

    it("Should revert with empty amounts array", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [], 
            idLocal: LOCATION_B,
            dataHashes: []
        };

        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
            .to.be.revertedWithCustomError(assetRegistry, "EmptyAmountsArray");
    });

    it("Should revert with single amount (meaningless split)", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [DEFAULT_AMOUNT], // Apenas uma parte
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2]
        };
            
        await expect(assetRegistry.connect(accounts.member1).splitAsset(splitInput))
          .to.be.revertedWithCustomError(assetRegistry, "InsufficientSplitParts");
    });

    it("Should handle gas efficiently for multiple splits", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [DEFAULT_AMOUNT/5, DEFAULT_AMOUNT/5, DEFAULT_AMOUNT/5, DEFAULT_AMOUNT/5, DEFAULT_AMOUNT/5], // 5 divisões
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4, DATA_HASH_2, DATA_HASH_3]
        };

        const tx = await assetRegistry.connect(accounts.member1).splitAsset(splitInput);
        const receipt = await tx.wait();
        
        expect(receipt?.gasUsed).to.be.lessThan(3000000); 
    });

    it("Should generate unique asset IDs for split assets", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1/2, SPLIT_AMOUNT_1/2, SPLIT_AMOUNT_2],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3, DATA_HASH_4]
        };

        await assetRegistry.connect(accounts.member1).splitAsset(splitInput);

        const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
        const childIds = originalAsset.childAssets;
        
        // Verificar que todos os IDs são únicos
        const uniqueIds = new Set(childIds);
        expect(uniqueIds.size).to.equal(childIds.length);
        
        // Verificar que nenhum ID filho é igual ao ID pai
        expect(childIds).to.not.include(ASSET_1);
    });

    it("Should revert if caller is not channel member", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        // Criar asset como member1
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        // Tentar dividir com uma conta que não é membro do canal
        await expect(assetRegistry.connect(accounts.nonMember).splitAsset(splitInput))
            .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
            .withArgs(CHANNEL_1, accounts.nonMember.address);
    });

    it("Should preserve asset metadata correctly in split assets", async function () {
        const { assetRegistry } = await loadFixture(deployAssetRegistry);
        
        const createInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amount: DEFAULT_AMOUNT,
            idLocal: LOCATION_A,
            dataHashes: [DATA_HASH_1],
            externalIds: [EXTERNAL_ID_1]
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);

        const splitInput = {
            assetId: ASSET_1,
            channelName: CHANNEL_1,
            amounts: [SPLIT_AMOUNT_1, SPLIT_AMOUNT_2],
            idLocal: LOCATION_B,
            dataHashes: [DATA_HASH_2, DATA_HASH_3]
        };

        await assetRegistry.connect(accounts.member1).splitAsset(splitInput);

        const originalAsset = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
        
        // Verificar que cada asset filho tem os metadados corretos
        for (let i = 0; i < originalAsset.childAssets.length; i++) {
            const childAsset = await assetRegistry.getAsset(CHANNEL_1, originalAsset.childAssets[i]);
            
            expect(childAsset.idLocal).to.equal(LOCATION_B);
            expect(childAsset.originOwner).to.equal(accounts.member1.address);
            expect(childAsset.parentAssetId).to.equal(ASSET_1);
            expect(childAsset.createdAt).to.be.greaterThan(0);
            expect(childAsset.lastUpdated).to.equal(childAsset.createdAt);
        }
    });
  });

  describe("groupAssets", function () {
    it("Should allow owner to group multiple assets into a single group asset", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create multiple assets to group
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: [EXTERNAL_ID_1]
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: [EXTERNAL_ID_2]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_ASSET"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: createInput1.amount + createInput2.amount,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3, DATA_HASH_4]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
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
      expect(groupAsset.idLocal).to.equal(LOCATION_B);
      expect(groupAsset.status).to.equal(0); // ACTIVE
      expect(groupAsset.operation).to.equal(5); // GROUP
      expect(groupAsset.groupedBy).to.equal(hre.ethers.ZeroHash); // Not grouped in another
      expect(groupAsset.parentAssetId).to.equal(hre.ethers.ZeroHash); // Not a transformation
      expect(groupAsset.transformationId).to.equal(""); // Not a transformation
      
      // Check grouped assets tracking
      expect(groupAsset.groupedAssets.length).to.equal(2);
      expect(groupAsset.groupedAssets[0]).to.equal(ASSET_1);
      expect(groupAsset.groupedAssets[1]).to.equal(ASSET_2);
      
      // Check data hashes
      expect(groupAsset.dataHashes.length).to.equal(2);
      expect(groupAsset.dataHashes[0]).to.equal(DATA_HASH_3);
      expect(groupAsset.dataHashes[1]).to.equal(DATA_HASH_4);
      
      // Check that external IDs are not inherited
      expect(groupAsset.externalIds.length).to.equal(0);
      expect(groupAsset.childAssets.length).to.equal(0);
      
      // Check metadata
      expect(groupAsset.originOwner).to.equal(accounts.member1.address);
      expect(groupAsset.createdAt).to.be.greaterThan(0);
      expect(groupAsset.lastUpdated).to.equal(groupAsset.createdAt);
    });

    it("Should emit AssetsGrouped event", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: SPLIT_AMOUNT_1,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: SPLIT_AMOUNT_2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("EVENT_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: SPLIT_AMOUNT_1 + SPLIT_AMOUNT_2,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.emit(assetRegistry, "AssetsGrouped")
        .withArgs([ASSET_1, ASSET_2], GROUP_ASSET, accounts.member1.address, SPLIT_AMOUNT_1 + SPLIT_AMOUNT_2, anyValue);
    });

    it("Should update owner and status enumerations correctly", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create multiple assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      const createInput3 = {
        assetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_3")),
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_3],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);
      await assetRegistry.connect(accounts.member1).createAsset(createInput3);

      // Check initial state
      let [activeAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 0, 1, 10);
      expect(activeAssets.length).to.equal(3);

      let [ownerAssets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member1.address, 1, 10);
      expect(ownerAssets.length).to.equal(3);

      // Group two assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_ENUM"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: createInput1.amount + createInput2.amount,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_4]
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput);

      // Check final state
      [activeAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 0, 1, 10);
      expect(activeAssets.length).to.equal(2); // 1 original + 1 group

      let [inactiveAssets] = await assetRegistry.getAssetsByStatus(CHANNEL_1, 1, 1, 10);
      expect(inactiveAssets.length).to.equal(2); // 2 grouped assets

      [ownerAssets] = await assetRegistry.getAssetsByOwner(CHANNEL_1, accounts.member1.address, 1, 10);
      expect(ownerAssets.length).to.equal(2); // 1 original + 1 group (grouped assets removed from owner enumeration)
    });

    it("Should add group operations to asset history", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("HISTORY_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput);

      // Check original assets history
      let [operations1, timestamps1] = await assetRegistry.getAssetHistory(CHANNEL_1, ASSET_1);
      expect(operations1.length).to.equal(2);
      expect(operations1[0]).to.equal(0); // CREATE
      expect(operations1[1]).to.equal(5); // GROUP

      let [operations2, timestamps2] = await assetRegistry.getAssetHistory(CHANNEL_1, ASSET_2);
      expect(operations2.length).to.equal(2);
      expect(operations2[0]).to.equal(0); // CREATE
      expect(operations2[1]).to.equal(5); // GROUP

      // Check group asset history
      let [groupOperations, groupTimestamps] = await assetRegistry.getAssetHistory(CHANNEL_1, GROUP_ASSET);
      expect(groupOperations.length).to.equal(1);
      expect(groupOperations[0]).to.equal(5); // GROUP
    });

    it("Should validate amount conservation correctly", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets with different amounts
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: 300,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: 700,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Test with correct amount conservation
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CONSERVATION_GROUP"));
      const correctGroupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: 1000, // 300 + 700
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(correctGroupInput))
        .not.to.be.reverted;

      // Create more assets for incorrect conservation test
      const createInput3 = {
        assetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_3")),
        channelName: CHANNEL_1,
        amount: 400,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput4 = {
        assetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_4")),
        channelName: CHANNEL_1,
        amount: 600,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput3);
      await assetRegistry.connect(accounts.member1).createAsset(createInput4);

      // Test with incorrect amount conservation
      const GROUP_ASSET_2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("INCORRECT_GROUP"));
      const incorrectGroupInput = {
        assetIds: [createInput3.assetId, createInput4.assetId],
        groupAssetId: GROUP_ASSET_2,
        channelName: CHANNEL_1,
        amount: 500, // Should be 1000 (400 + 600)
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_4]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(incorrectGroupInput))
        .to.be.revertedWithCustomError(assetRegistry, "AmountConservationViolated")
        .withArgs(1000, 500);
    });

    it("Should revert if group asset ID already exists", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Use ASSET_1 as group asset ID (already exists)
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: ASSET_1, // Already exists!
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "GroupAssetAlreadyExists")
        .withArgs(ASSET_1);
    });

    it("Should revert if any asset to group does not exist", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create only one asset
      const createInput = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput);

      // Try to group with non-existent asset
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_NONEXISTENT"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2], // ASSET_2 doesn't exist
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotFound")
        .withArgs(CHANNEL_1, ASSET_2);
    });

    it("Should revert if any asset is not active", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Inactivate one asset
      const inactivateInput = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        finalLocation: LOCATION_B,
        finalDataHash: DATA_HASH_3
      };

      await assetRegistry.connect(accounts.member1).inactivateAsset(inactivateInput);

      // Try to group with inactive asset
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_INACTIVE"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2], // ASSET_2 is inactive
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_4]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "AssetNotActive")
        .withArgs(CHANNEL_1, ASSET_2);
    });

    it("Should revert if assets have different owners", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create asset with member1
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      // Create asset with member2
      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member2).createAsset(createInput2);

      // Try to group assets with different owners
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_MIXED_OWNERS"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "MixedOwnershipNotAllowed")
        .withArgs(accounts.member1.address, accounts.member2.address);
    });

    it("Should revert if caller is not channel member", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets as member1
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Try to group with non-channel member
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_NON_MEMBER"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.user).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "UnauthorizedChannelAccess")
        .withArgs(CHANNEL_1, accounts.user.address);
    });

    it("Should revert with invalid input validations", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create some assets for testing
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Test invalid groupAssetId
      let groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: hre.ethers.ZeroHash,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAssetId")
        .withArgs(CHANNEL_1, hre.ethers.ZeroHash);

      // Test empty location
      groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VALID_GROUP")),
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: "",
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyLocation");

      // Test zero amount
      groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VALID_GROUP")),
        channelName: CHANNEL_1,
        amount: 0,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "InvalidAmount")
        .withArgs(0);

      // Test empty dataHashes
      groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VALID_GROUP")),
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: []
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "EmptyDataHashes");

      // Test insufficient assets to group (less than 2)
      groupInput = {
        assetIds: [ASSET_1], // Only one asset
        groupAssetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VALID_GROUP")),
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "InsufficientAssetsToGroup")
        .withArgs(1, 2); // MIN_GROUP_SIZE should be 2
    });

    it("Should revert with duplicate assets in group", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);

      // Try to group with duplicate assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GROUP_DUPLICATES"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_1], // Duplicate!
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "DuplicateAssetsInGroup");
    });

    it("Should revert with self-reference in group", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Try to include group asset ID in the assets to group
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SELF_REF_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2, GROUP_ASSET], // Self-reference!
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .to.be.revertedWithCustomError(assetRegistry, "SelfReferenceInGroup")
        .withArgs(GROUP_ASSET);
    });

    it("Should handle large number of assets efficiently", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

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
          idLocal: LOCATION_A,
          dataHashes: [DATA_HASH_1],
          externalIds: []
        };

        await assetRegistry.connect(accounts.member1).createAsset(createInput);
        assetIds.push(assetId);
      }

      // Group all assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BULK_GROUP"));
      const groupInput = {
        assetIds: assetIds,
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_2, DATA_HASH_3]
      };

      const tx = await assetRegistry.connect(accounts.member1).groupAssets(groupInput);
      const receipt = await tx.wait();

      expect(receipt?.gasUsed).to.be.lessThan(3000000);

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
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create exactly 2 assets
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      // Group with minimum size
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MIN_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .not.to.be.reverted;

      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.groupedAssets.length).to.equal(2);
    });

    it("Should handle grouping assets with different amounts correctly", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets with different amounts
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: 150,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: []
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: 350,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: []
      };

      const createInput3 = {
        assetId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ASSET_3")),
        channelName: CHANNEL_1,
        amount: 500,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_3],
        externalIds: []
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);
      await assetRegistry.connect(accounts.member1).createAsset(createInput3);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MIXED_AMOUNTS_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2, createInput3.assetId],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: 1000, // 150 + 350 + 500
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_4]
      };

      await expect(assetRegistry.connect(accounts.member1).groupAssets(groupInput))
        .not.to.be.reverted;

      const groupAsset = await assetRegistry.getAsset(CHANNEL_1, GROUP_ASSET);
      expect(groupAsset.amount).to.equal(1000);
      expect(groupAsset.groupedAssets.length).to.equal(3);
    });

    it("Should preserve asset metadata during grouping", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      // Create assets with external IDs and specific metadata
      const createInput1 = {
        assetId: ASSET_1,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_1],
        externalIds: [EXTERNAL_ID_1]
      };

      const createInput2 = {
        assetId: ASSET_2,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT/2,
        idLocal: LOCATION_A,
        dataHashes: [DATA_HASH_2],
        externalIds: [EXTERNAL_ID_2]
      };

      await assetRegistry.connect(accounts.member1).createAsset(createInput1);
      await assetRegistry.connect(accounts.member1).createAsset(createInput2);

      const originalAsset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const originalAsset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);

      // Group assets
      const GROUP_ASSET = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("METADATA_GROUP"));
      const groupInput = {
        assetIds: [ASSET_1, ASSET_2],
        groupAssetId: GROUP_ASSET,
        channelName: CHANNEL_1,
        amount: DEFAULT_AMOUNT,
        idLocal: LOCATION_B,
        dataHashes: [DATA_HASH_3]
      };

      await assetRegistry.connect(accounts.member1).groupAssets(groupInput);

      // Check that original assets preserve their metadata
      const groupedAsset1 = await assetRegistry.getAsset(CHANNEL_1, ASSET_1);
      const groupedAsset2 = await assetRegistry.getAsset(CHANNEL_1, ASSET_2);

      // Original metadata should be preserved
      expect(groupedAsset1.amount).to.equal(originalAsset1.amount);
      expect(groupedAsset1.idLocal).to.equal(originalAsset1.idLocal);
      expect(groupedAsset1.originOwner).to.equal(originalAsset1.originOwner);
      expect(groupedAsset1.createdAt).to.equal(originalAsset1.createdAt);
      expect(groupedAsset1.externalIds[0]).to.equal(EXTERNAL_ID_1);

      expect(groupedAsset2.amount).to.equal(originalAsset2.amount);
      expect(groupedAsset2.idLocal).to.equal(originalAsset2.idLocal);
      expect(groupedAsset2.originOwner).to.equal(originalAsset2.originOwner);
      expect(groupedAsset2.createdAt).to.equal(originalAsset2.createdAt);
      expect(groupedAsset2.externalIds[0]).to.equal(EXTERNAL_ID_2);

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
});