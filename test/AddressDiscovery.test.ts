import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { deployAddressDiscovery } from "./fixture/deployAddressDiscovery";
import hre from "hardhat";
import { 
  DEFAULT_ADMIN_ROLE, 
  ADDRESS_DISCOVERY_ADMIN_ROLE, 
  CONTRACT_1, 
  contractAddress1,
  CONTRACT_2, 
  contractAddress2,
  NON_EXISTENT_CONTRACT 
} from "./utils/index";
import { getTestAccounts } from "./utils/index";

describe("AddressDiscovery test", function () {

  let accounts: any;

  beforeEach(async function () {
    accounts = await loadFixture(getTestAccounts);
  });

  describe("Deployment", function () {
    it("Should set the correct roles for deployer", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      expect(await addressDiscovery.hasRole(DEFAULT_ADMIN_ROLE, accounts.deployer.address)).to.be.true;
      expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, accounts.deployer.address)).to.be.true;
    });

    it("Should set the correct roles for provided admin", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, accounts.admin.address)).to.be.true;
    });

    it("Should revert if admin address is zero", async function () {
      const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
      
      await expect(AddressDiscovery.deploy(ZeroAddress))
        .to.be.revertedWithCustomError(AddressDiscovery, "InvalidAddress")
        .withArgs(ZeroAddress);
    });

    it("Should not grant admin role to other accounts", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, accounts.user.address)).to.be.false;
    });

    it("Should initialize with empty registry", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.false;
      
      await expect(addressDiscovery.getContractAddress(CONTRACT_1))
        .to.be.revertedWithCustomError(addressDiscovery, "ContractNotRegistered")
        .withArgs(CONTRACT_1);
    });
  });
  
  describe("Address Management", function () {
    describe("updateAddress", function () {
      it("Should allow admin to update address", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(
          addressDiscovery
            .connect(accounts.admin)
            .updateAddress(CONTRACT_1, contractAddress1)
        ).not.to.be.reverted;

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(
          contractAddress1
        );
      });

      it("Should emit AddressUpdated event on successful update", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1))
          .to.emit(addressDiscovery, "AddressUpdated")
          .withArgs(CONTRACT_1, ZeroAddress, contractAddress1, accounts.admin.address);
      });
     
      it("Should emit AddressUpdated event when updating existing address", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        // First update
        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);

        // Second update should emit event with old address
        await expect(addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress2))
          .to.emit(addressDiscovery, "AddressUpdated")
          .withArgs(CONTRACT_1, contractAddress1, contractAddress2, accounts.admin.address);
      });

      it("Should revert if new address is zero", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, ZeroAddress))
          .to.be.revertedWithCustomError(addressDiscovery, "InvalidAddress")
          .withArgs(ZeroAddress);
      });

      it("Should revert if caller doesn't have admin role", async function () {
        const addressDiscovery =  await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.user).updateAddress(CONTRACT_1, contractAddress1))
          .to.be.revertedWithCustomError(addressDiscovery, "AccessControlUnauthorizedAccount")
          .withArgs(accounts.user.address, ADDRESS_DISCOVERY_ADMIN_ROLE);
      });

      it("Should allow deployer to update address", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.deployer).updateAddress(CONTRACT_1, contractAddress1))
          .not.to.be.reverted;

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1);
      });

      it("Should allow multiple address updates for different contracts", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);
        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_2, contractAddress2);

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1);
        expect(await addressDiscovery.getContractAddress(CONTRACT_2)).to.equal(contractAddress2);
      });
    });

    describe("getContractAddress", function () {
      it("Should return correct address for registered contract", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1);
      });

      it("Should revert for non-registered contract", async function () {
        const addressDiscovery =   await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.getContractAddress(NON_EXISTENT_CONTRACT))
          .to.be.revertedWithCustomError(addressDiscovery, "ContractNotRegistered")
          .withArgs(NON_EXISTENT_CONTRACT);
      });

      it("Should return updated address after modification", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        // Initial registration
        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);
        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1);

        // Update address
        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress2);
        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress2);
      });
    });

    describe("isRegistered", function () {
      it("Should return true for registered contract", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);

        expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;
      });

      it("Should return false for non-registered contract", async function () {
        const addressDiscovery =   await loadFixture(deployAddressDiscovery);

        expect(await addressDiscovery.isRegistered(NON_EXISTENT_CONTRACT)).to.be.false;
      });

      it("Should return true after address update", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);
        await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress2);

        expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;
      });
    });
  });

  describe("Admin Management", function () {
    describe("addAdmin", function () {
      it("Should allow default admin to add new admin", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(accounts.deployer).addAdmin(accounts.otherAdmin.address);

        expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, accounts.otherAdmin.address)).to.be.true;
      });

      it("Should revert if admin address is zero", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.deployer).addAdmin(ZeroAddress))
          .to.be.revertedWithCustomError(addressDiscovery, "InvalidAddress")
          .withArgs(ZeroAddress);
      });

      it("Should revert if caller is not default admin", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.admin).addAdmin(accounts.otherAdmin.address))
          .to.be.revertedWithCustomError(addressDiscovery, "AccessControlUnauthorizedAccount")
          .withArgs(accounts.admin.address, DEFAULT_ADMIN_ROLE);
      });

      it("Should allow newly added admin to update addresses", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        // Add new admin
        await addressDiscovery.connect(accounts.deployer).addAdmin(accounts.otherAdmin.address);

        // New admin should be able to update addresses
        await expect(addressDiscovery.connect(accounts.otherAdmin).updateAddress(CONTRACT_1, contractAddress1))
          .not.to.be.reverted;

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1);
      });
    });

    describe("removeAdmin", function () {
      it("Should allow default admin to remove admin", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, accounts.admin.address)).to.be.true;

        // Remove admin
        await addressDiscovery.connect(accounts.deployer).removeAdmin(accounts.admin.address);

        expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, accounts.admin.address)).to.be.false;
      });

      it("Should revert if admin address is zero", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.deployer).removeAdmin(ZeroAddress))
          .to.be.revertedWithCustomError(addressDiscovery, "InvalidAddress")
          .withArgs(ZeroAddress);
      });

      it("Should revert if caller is not default admin", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.admin).removeAdmin(accounts.otherAdmin.address))
          .to.be.revertedWithCustomError(addressDiscovery, "AccessControlUnauthorizedAccount")
          .withArgs(accounts.admin.address, DEFAULT_ADMIN_ROLE);
      });

      it("Should prevent removed admin from updating addresses", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(accounts.deployer).removeAdmin(accounts.admin.address);

        // Removed admin should not be able to update addresses
        await expect(addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1))
          .to.be.revertedWithCustomError(addressDiscovery, "AccessControlUnauthorizedAccount")
          .withArgs(accounts.admin.address, ADDRESS_DISCOVERY_ADMIN_ROLE);
      });

      it("Should allow removing non-existent admin without error", async function () {
        const addressDiscovery = await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(accounts.deployer).removeAdmin(accounts.user.address))
          .not.to.be.reverted;
      });
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple admins managing different contracts", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      await addressDiscovery.connect(accounts.deployer).addAdmin(accounts.otherAdmin.address);

      // Both admins update different contracts
      await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);
      await addressDiscovery.connect(accounts.otherAdmin).updateAddress(CONTRACT_2, contractAddress2);

      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1);
      expect(await addressDiscovery.getContractAddress(CONTRACT_2)).to.equal(contractAddress2);
      expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;
      expect(await addressDiscovery.isRegistered(CONTRACT_2)).to.be.true;
    });

    it("Should maintain state consistency after admin role changes", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);
      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1);

      // Remove admin
      await addressDiscovery.connect(accounts.deployer).removeAdmin(accounts.admin.address);

      // Contract should still be registered and accessible
      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1);
      expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;

      // Deployer (still has admin role) can still update
      await addressDiscovery.connect(accounts.deployer).updateAddress(CONTRACT_1, contractAddress2);
      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress2);
    });

    it("Should handle multiple updates correctly", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      // Multiple rapid updates
      await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);
      await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress2);
      await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, accounts.user.address);

      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(accounts.user.address);
      expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;
    });
  });

  describe("Events", function () {
    it("Should emit correct events for first-time registration", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      await expect(addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1))
        .to.emit(addressDiscovery, "AddressUpdated")
        .withArgs(CONTRACT_1, ZeroAddress, contractAddress1, accounts.admin.address);
    });

    it("Should emit correct events for address updates", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      await addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress1);

      // Update should emit event with old address
      await expect(addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress2))
        .to.emit(addressDiscovery, "AddressUpdated")
        .withArgs(CONTRACT_1, contractAddress1, contractAddress2, accounts.admin.address);
    });

    it("Should emit events with correct caller address", async function () {
      const addressDiscovery = await loadFixture(deployAddressDiscovery);

      // Deployer updates
      await expect(addressDiscovery.connect(accounts.deployer).updateAddress(CONTRACT_1, contractAddress1))
        .to.emit(addressDiscovery, "AddressUpdated")
        .withArgs(CONTRACT_1, anyValue, contractAddress1, accounts.deployer.address);

      // Admin updates
      await expect(addressDiscovery.connect(accounts.admin).updateAddress(CONTRACT_1, contractAddress2))
        .to.emit(addressDiscovery, "AddressUpdated")
        .withArgs(CONTRACT_1, anyValue, contractAddress2, accounts.admin.address);
    });
  });
});
