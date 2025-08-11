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


});