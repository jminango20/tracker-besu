import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployAccessChannelManager } from "./fixture/deployAccessChannelManager";
import { 
  DEFAULT_ADMIN_ROLE, 
  CHANNEL_AUTHORITY_ROLE, 
  CHANNEL_ADMIN_ROLE,
  CHANNEL_1,
  CHANNEL_2 
} from "./utils/index";
import { getTestAccounts } from "./utils/index";

describe("AccessChannelManager test", function () {

  let accounts: any;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let member1: HardhatEthersSigner;
  let member2: HardhatEthersSigner;
  let member3: HardhatEthersSigner;
  
  beforeEach(async function () {
    accounts = await loadFixture(getTestAccounts);
    deployer = accounts.deployer;
    user = accounts.user;
    member1 = accounts.member1;
    member2 = accounts.member2;
    member3 = accounts.member3;
  });

  describe("Deployment", function () {
    it("Should set the correct roles for deployer", async function () {
      const accessChannelManager = await loadFixture(deployAccessChannelManager);

      expect(await accessChannelManager.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await accessChannelManager.hasRole(CHANNEL_AUTHORITY_ROLE, deployer.address)).to.be.true;
      expect(await accessChannelManager.hasRole(CHANNEL_ADMIN_ROLE, deployer.address)).to.be.true;
    });

    it("Should initialize with zero channels", async function () {
      const accessChannelManager = await loadFixture(deployAccessChannelManager);

      expect(await accessChannelManager.getChannelCount()).to.equal(0);
    });
  });

  describe("Channel Management", function () {
    describe("createChannel", function () {
      it("Should allow channel authority to create channel", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await expect(accessChannelManager.connect(deployer).createChannel(CHANNEL_1))
          .not.to.be.reverted;

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        expect(channelInfo.exists).to.be.true;
        expect(channelInfo.isActive).to.be.true;
        expect(channelInfo.creator).to.equal(deployer.address);
        expect(channelInfo.memberCount).to.equal(0);
      });

      it("Should emit ChannelCreated event", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await expect(accessChannelManager.connect(deployer).createChannel(CHANNEL_1))
          .to.emit(accessChannelManager, "ChannelCreated")
          .withArgs(CHANNEL_1, deployer.address, anyValue);
      });

      it("Should revert if channel already exists", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).createChannel(CHANNEL_1))
          .to.be.revertedWithCustomError(accessChannelManager, "ChannelAlreadyExists")
          .withArgs(CHANNEL_1);
      });

      it("Should revert if caller doesn't have authority role", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await expect(accessChannelManager.connect(user).createChannel(CHANNEL_1))
          .to.be.revertedWithCustomError(accessChannelManager, "AccessControlUnauthorizedAccount")
          .withArgs(user.address, CHANNEL_AUTHORITY_ROLE);
      });

      it("Should increment channel count", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        expect(await accessChannelManager.getChannelCount()).to.equal(0);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        expect(await accessChannelManager.getChannelCount()).to.equal(1);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_2);
        expect(await accessChannelManager.getChannelCount()).to.equal(2);
      });
    });

    describe("activateChannel", function () {
      it("Should allow channel authority to activate deactivated channel", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        // Create and deactivate channel
        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).desactivateChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).activateChannel(CHANNEL_1))
          .not.to.be.reverted;

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        expect(channelInfo.isActive).to.be.true;
      });

      it("Should emit ChannelActivated event", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).desactivateChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).activateChannel(CHANNEL_1))
          .to.emit(accessChannelManager, "ChannelActivated")
          .withArgs(CHANNEL_1, anyValue);
      });

      it("Should revert if channel is already active", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).activateChannel(CHANNEL_1))
          .to.be.revertedWithCustomError(accessChannelManager, "ChannelAlreadyActive")
          .withArgs(CHANNEL_1);
      });
    });

    describe("desactivateChannel", function () {
      it("Should allow channel authority to deactivate channel", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).desactivateChannel(CHANNEL_1))
          .not.to.be.reverted;

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        expect(channelInfo.isActive).to.be.false;
      });

      it("Should emit ChannelDeactivated event", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).desactivateChannel(CHANNEL_1))
          .to.emit(accessChannelManager, "ChannelDeactivated")
          .withArgs(CHANNEL_1, anyValue);
      });
    });
  });

  describe("Member Management", function () {
    describe("addChannelMember", function () {
      it("Should allow channel admin to add member", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address))
          .not.to.be.reverted;

        expect(await accessChannelManager.isChannelMember(CHANNEL_1, member1.address)).to.be.true;

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        expect(channelInfo.memberCount).to.equal(1);
      });

      it("Should emit ChannelMemberAdded event", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address))
          .to.emit(accessChannelManager, "ChannelMemberAdded")
          .withArgs(CHANNEL_1, member1.address, 1);
      });

      it("Should revert if member is zero address", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, ZeroAddress))
          .to.be.revertedWithCustomError(accessChannelManager, "InvalidMemberAddress")
          .withArgs(ZeroAddress);
      });

      it("Should not revert if member is channel creator", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, deployer.address))
          .not.to.be.reverted;

        expect(await accessChannelManager.isChannelMember(CHANNEL_1, deployer.address)).to.be.true;

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        expect(channelInfo.memberCount).to.equal(1);  
      });

      it("Should revert if member already in channel", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

        await expect(accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address))
          .to.be.revertedWithCustomError(accessChannelManager, "MemberAlreadyInChannel")
          .withArgs(CHANNEL_1, member1.address);
      });

      it("Should revert if caller doesn't have admin role", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(user).addChannelMember(CHANNEL_1, member1.address))
          .to.be.revertedWithCustomError(accessChannelManager, "AccessControlUnauthorizedAccount")
          .withArgs(user.address, CHANNEL_ADMIN_ROLE);
      });
    });

    describe("removeChannelMember", function () {
      it("Should allow channel admin to remove member", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

        await expect(accessChannelManager.connect(deployer).removeChannelMember(CHANNEL_1, member1.address))
          .not.to.be.reverted;

        expect(await accessChannelManager.isChannelMember(CHANNEL_1, member1.address)).to.be.false;

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        expect(channelInfo.memberCount).to.equal(0);
      });

      it("Should emit ChannelMemberRemoved event", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

        await expect(accessChannelManager.connect(deployer).removeChannelMember(CHANNEL_1, member1.address))
          .to.emit(accessChannelManager, "ChannelMemberRemoved")
          .withArgs(CHANNEL_1, member1.address, 0);
      });

      it("Should revert if member not in channel", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).removeChannelMember(CHANNEL_1, member1.address))
          .to.be.revertedWithCustomError(accessChannelManager, "MemberNotInChannel")
          .withArgs(CHANNEL_1, member1.address);
      });
    });

    describe("addChannelMembers - batch", function () {
      it("Should allow adding multiple members", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).addChannelMembers(CHANNEL_1, [member1.address, member2.address]))
          .not.to.be.reverted;

        expect(await accessChannelManager.isChannelMember(CHANNEL_1, member1.address)).to.be.true;
        expect(await accessChannelManager.isChannelMember(CHANNEL_1, member2.address)).to.be.true;

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        expect(channelInfo.memberCount).to.equal(2);
      });

      it("Should emit ChannelMembersAdded event", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        await expect(accessChannelManager.connect(deployer).addChannelMembers(CHANNEL_1, [member1.address, member2.address]))
          .to.emit(accessChannelManager, "ChannelMembersAdded")
          .withArgs(CHANNEL_1, [member1.address, member2.address], 2);
      });

      it("Should skip invalid addresses in batch", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        // Include zero address and creator address - should be skipped
        await expect(accessChannelManager.connect(deployer).addChannelMembers(CHANNEL_1, [member1.address, ZeroAddress, deployer.address]))
          .not.to.be.reverted;

        expect(await accessChannelManager.isChannelMember(CHANNEL_1, member1.address)).to.be.true;

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        expect(channelInfo.memberCount).to.equal(1); // Only member1 should be added
      });
    });
  });

  describe("View Functions", function () {
    describe("isChannelMember", function () {
      it("Should return true for channel member", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

        expect(await accessChannelManager.isChannelMember(CHANNEL_1, member1.address)).to.be.true;
      });

      it("Should return false for non-member", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

        expect(await accessChannelManager.isChannelMember(CHANNEL_1, member1.address)).to.be.false;
      });

      it("Should revert for inactive channel", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).desactivateChannel(CHANNEL_1);

        await expect(accessChannelManager.isChannelMember(CHANNEL_1, member1.address))
          .to.be.revertedWithCustomError(accessChannelManager, "ChannelNotActive")
          .withArgs(CHANNEL_1);
      });
    });

    describe("getChannelInfo", function () {
      it("Should return correct channel information", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        
        expect(channelInfo.exists).to.be.true;
        expect(channelInfo.isActive).to.be.true;
        expect(channelInfo.creator).to.equal(deployer.address);
        expect(channelInfo.memberCount).to.equal(1);
        expect(channelInfo.createdAt).to.be.greaterThan(0);
      });

      it("Should return false for non-existent channel", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        const channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
        
        expect(channelInfo.exists).to.be.false;
        expect(channelInfo.isActive).to.be.false;
        expect(channelInfo.creator).to.equal(ZeroAddress);
        expect(channelInfo.memberCount).to.equal(0);
        expect(channelInfo.createdAt).to.equal(0);
      });
    });

    describe("areChannelMembers", function () {
      it("Should return correct membership status for multiple addresses", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

        const results = await accessChannelManager.areChannelMembers(CHANNEL_1, [member1.address, member2.address, user.address]);
        
        expect(results[0]).to.be.true;  // member1 is a member
        expect(results[1]).to.be.false; // member2 is not a member
        expect(results[2]).to.be.false; // user is not a member
      });
    });
  });

  describe("Edge Cases", function () {
    it("Should handle channel deactivation and member operations", async function () {
      const accessChannelManager = await loadFixture(deployAccessChannelManager);

      await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
      await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

      // Deactivate channel
      await accessChannelManager.connect(deployer).desactivateChannel(CHANNEL_1);

      // Should not be able to add members to inactive channel
      await expect(accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address))
        .to.be.revertedWithCustomError(accessChannelManager, "ChannelNotActive");

      // Should not be able to check membership on inactive channel
      await expect(accessChannelManager.isChannelMember(CHANNEL_1, member1.address))
        .to.be.revertedWithCustomError(accessChannelManager, "ChannelNotActive");
    });

    it("Should maintain member count consistency", async function () {
      const accessChannelManager = await loadFixture(deployAccessChannelManager);

      await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

      // Add members
      await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);
      await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member2.address);

      let channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
      expect(channelInfo.memberCount).to.equal(2);

      // Remove one member
      await accessChannelManager.connect(deployer).removeChannelMember(CHANNEL_1, member1.address);

      channelInfo = await accessChannelManager.getChannelInfo(CHANNEL_1);
      expect(channelInfo.memberCount).to.equal(1);
      expect(await accessChannelManager.isChannelMember(CHANNEL_1, member2.address)).to.be.true;
    });
  });

  describe("Pagination Functions", function () {
    describe("getChannelMembersPaginated", function () {
        it("Should return paginated members correctly", async function () {
            const accessChannelManager = await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
            await accessChannelManager.connect(deployer).addChannelMembers(CHANNEL_1, [member1.address, member2.address, member3.address]);

            const result = await accessChannelManager.getChannelMembersPaginated(CHANNEL_1, 1, 2);
            
            expect(result.members.length).to.equal(2);
            expect(result.totalMembers).to.equal(3);
            expect(result.totalPages).to.equal(2);
            expect(result.hasNextPage).to.be.true;
        });

        it("Should return empty array for channel with no members", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

            const result = await accessChannelManager.getChannelMembersPaginated(CHANNEL_1, 1, 10);
            
            expect(result.members.length).to.equal(0);
            expect(result.totalMembers).to.equal(0);
            expect(result.totalPages).to.equal(0);
            expect(result.hasNextPage).to.be.false;
        });

        it("Should handle last page correctly", async function () {
            const accessChannelManager = await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
            await accessChannelManager.connect(deployer).addChannelMembers(CHANNEL_1, [member1.address, member2.address, member3.address]);

            const result = await accessChannelManager.getChannelMembersPaginated(CHANNEL_1, 2, 2);
            
            expect(result.members.length).to.equal(1); // Only one member on last page
            expect(result.totalMembers).to.equal(3);
            expect(result.totalPages).to.equal(2);
            expect(result.hasNextPage).to.be.false;
        });

        it("Should revert for invalid page number", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

            await expect(accessChannelManager.getChannelMembersPaginated(CHANNEL_1, 0, 10))
                .to.be.revertedWithCustomError(accessChannelManager, "InvalidPageNumber")
                .withArgs(0);
        });

        it("Should revert for invalid page size", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

            await expect(accessChannelManager.getChannelMembersPaginated(CHANNEL_1, 1, 201)) // MAX_PAGE_SIZE is 200
                .to.be.revertedWithCustomError(accessChannelManager, "InvalidPageSize")
                .withArgs(201);
        });

        it("Should return empty for page beyond total pages", async function () {
            const accessChannelManager =       await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
            await accessChannelManager.connect(deployer).addChannelMember(CHANNEL_1, member1.address);

            const result = await accessChannelManager.getChannelMembersPaginated(CHANNEL_1, 5, 10);
            
            expect(result.members.length).to.equal(0);
            expect(result.totalMembers).to.equal(1);
            expect(result.totalPages).to.equal(1);
            expect(result.hasNextPage).to.be.false;
        });
    });

    describe("getAllChannelsPaginated", function () {
        it("Should return paginated channels correctly", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
            await accessChannelManager.connect(deployer).createChannel(CHANNEL_2);

            const result = await accessChannelManager.getAllChannelsPaginated(1, 1);
            
            expect(result.channels.length).to.equal(1);
            expect(result.totalChannels).to.equal(2);
            expect(result.totalPages).to.equal(2);
            expect(result.hasNextPage).to.be.true;
        });

        it("Should return empty array when no channels exist", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            const result = await accessChannelManager.getAllChannelsPaginated(1, 10);
            
            expect(result.channels.length).to.equal(0);
            expect(result.totalChannels).to.equal(0);
            expect(result.totalPages).to.equal(0);
            expect(result.hasNextPage).to.be.false;
        });

        it("Should handle single page with all channels", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
            await accessChannelManager.connect(deployer).createChannel(CHANNEL_2);

            const result = await accessChannelManager.getAllChannelsPaginated(1, 10);
            
            expect(result.channels.length).to.equal(2);
            expect(result.totalChannels).to.equal(2);
            expect(result.totalPages).to.equal(1);
            expect(result.hasNextPage).to.be.false;
            expect(result.channels).to.include(CHANNEL_1);
            expect(result.channels).to.include(CHANNEL_2);
        });

        it("Should revert for invalid page number", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            await expect(accessChannelManager.getAllChannelsPaginated(0, 10))
                .to.be.revertedWithCustomError(accessChannelManager, "InvalidPageNumber")
                .withArgs(0);
        });

        it("Should revert for invalid page size", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            await expect(accessChannelManager.getAllChannelsPaginated(1, 201)) // MAX_PAGE_SIZE is 200
                .to.be.revertedWithCustomError(accessChannelManager, "InvalidPageSize")
                .withArgs(201);
        });

        it("Should return empty for page beyond total pages", async function () {
            const accessChannelManager =         await loadFixture(deployAccessChannelManager);

            await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);

            const result = await accessChannelManager.getAllChannelsPaginated(3, 10);
            
            expect(result.channels.length).to.equal(0);
            expect(result.totalChannels).to.equal(1);
            expect(result.totalPages).to.equal(1);
            expect(result.hasNextPage).to.be.false;
        });
    });
  });

  describe("Access Control Helpers", function () {
    describe("addChannelAdmin", function () {
        it("Should allow default admin to add new channel admin", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).addChannelAdmin(user.address);

        expect(await accessChannelManager.hasRole(CHANNEL_ADMIN_ROLE, user.address)).to.be.true;
        });

        it("Should revert if admin address is zero", async function () {
        const accessChannelManager =     await loadFixture(deployAccessChannelManager);

        await expect(accessChannelManager.connect(deployer).addChannelAdmin(ZeroAddress))
            .to.be.revertedWithCustomError(accessChannelManager, "InvalidAddress")
            .withArgs(ZeroAddress);
        });

        it("Should revert if caller is not default admin", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await expect(accessChannelManager.connect(user).addChannelAdmin(member1.address))
            .to.be.revertedWithCustomError(accessChannelManager, "AccessControlUnauthorizedAccount")
            .withArgs(user.address, DEFAULT_ADMIN_ROLE);
        });
    });

    describe("removeChannelAdmin", function () {
        it("Should allow default admin to remove channel admin", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).addChannelAdmin(user.address);
        expect(await accessChannelManager.hasRole(CHANNEL_ADMIN_ROLE, user.address)).to.be.true;

        await accessChannelManager.connect(deployer).removeChannelAdmin(user.address);
        expect(await accessChannelManager.hasRole(CHANNEL_ADMIN_ROLE, user.address)).to.be.false;
        });

        it("Should revert if admin address is zero", async function () {
        const accessChannelManager =     await loadFixture(deployAccessChannelManager);

        await expect(accessChannelManager.connect(deployer).removeChannelAdmin(ZeroAddress))
            .to.be.revertedWithCustomError(accessChannelManager, "InvalidAddress")
            .withArgs(ZeroAddress);
        });
    });

    describe("addChannelAuthority", function () {
        it("Should allow default admin to add new channel authority", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).addChannelAuthority(user.address);

        expect(await accessChannelManager.hasRole(CHANNEL_AUTHORITY_ROLE, user.address)).to.be.true;
        });

        it("Should revert if authority address is zero", async function () {
        const accessChannelManager =     await loadFixture(deployAccessChannelManager);

        await expect(accessChannelManager.connect(deployer).addChannelAuthority(ZeroAddress))
            .to.be.revertedWithCustomError(accessChannelManager, "InvalidAddress")
            .withArgs(ZeroAddress);
        });
    });

    describe("removeChannelAuthority", function () {
        it("Should allow default admin to remove channel authority", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).addChannelAuthority(user.address);
        expect(await accessChannelManager.hasRole(CHANNEL_AUTHORITY_ROLE, user.address)).to.be.true;

        await accessChannelManager.connect(deployer).removeChannelAuthority(user.address);
        expect(await accessChannelManager.hasRole(CHANNEL_AUTHORITY_ROLE, user.address)).to.be.false;
        });

        it("Should revert if authority address is zero", async function () {
        const accessChannelManager =     await loadFixture(deployAccessChannelManager);

        await expect(accessChannelManager.connect(deployer).removeChannelAuthority(ZeroAddress))
            .to.be.revertedWithCustomError(accessChannelManager, "InvalidAddress")
            .withArgs(ZeroAddress);
        });
    });

    describe("Role Integration", function () {
        it("Should allow newly added admin to manage members", async function () {
        const accessChannelManager =   await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).createChannel(CHANNEL_1);
        await accessChannelManager.connect(deployer).addChannelAdmin(user.address);

        await expect(accessChannelManager.connect(user).addChannelMember(CHANNEL_1, member1.address))
            .not.to.be.reverted;
        });

        it("Should allow newly added authority to create channels", async function () {
        const accessChannelManager = await loadFixture(deployAccessChannelManager);

        await accessChannelManager.connect(deployer).addChannelAuthority(user.address);

        await expect(accessChannelManager.connect(user).createChannel(CHANNEL_1))
            .not.to.be.reverted;
        });
    });
  });
});