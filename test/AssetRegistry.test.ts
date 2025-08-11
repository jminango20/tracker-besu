import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { deployAssetRegistry } from "./fixture/deployAssetRegistry";
import { getTestAccounts, LOCATION_B } from "./utils/index";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ASSET_ADMIN_ROLE,
  CHANNEL_1,
  ASSET_1,
  DATA_HASH_1,
  DATA_HASH_2,
  DATA_HASH_3,
  DATA_HASH_4,
  DEFAULT_AMOUNT,
  LOCATION_A,
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
});