import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { deployAddressDiscovery } from "./fixture/deployAddressDiscovery";
import hre from "hardhat";

describe("AddressDiscovery test", function () {

  describe("Deployment", function () {
    it("Should set the correct roles for deployer", async function () {
      const { addressDiscovery, deployer, DEFAULT_ADMIN_ROLE, ADDRESS_DISCOVERY_ADMIN_ROLE } = 
        await loadFixture(deployAddressDiscovery);

      expect(await addressDiscovery.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, deployer.address)).to.be.true;
    });

    it("Should set the correct roles for provided admin", async function () {
      const { addressDiscovery, admin, ADDRESS_DISCOVERY_ADMIN_ROLE } = 
        await loadFixture(deployAddressDiscovery);

      expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should revert if admin address is zero", async function () {
      const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
      
      await expect(AddressDiscovery.deploy(ZeroAddress))
        .to.be.revertedWithCustomError(AddressDiscovery, "InvalidAddress")
        .withArgs(ZeroAddress);
    });

    it("Should not grant admin role to other accounts", async function () {
      const { addressDiscovery, user, ADDRESS_DISCOVERY_ADMIN_ROLE } = 
        await loadFixture(deployAddressDiscovery);

      expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, user.address)).to.be.false;
    });

    it("Should initialize with empty registry", async function () {
      const { addressDiscovery, CONTRACT_1 } = 
        await loadFixture(deployAddressDiscovery);

      expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.false;
      
      await expect(addressDiscovery.getContractAddress(CONTRACT_1))
        .to.be.revertedWithCustomError(addressDiscovery, "ContractNotRegistered")
        .withArgs(CONTRACT_1);
    });
  });
  
  describe("Address Management", function () {
    describe("updateAddress", function () {
      it("Should allow admin to update address", async function () {
        const { addressDiscovery, admin, CONTRACT_1, contractAddress1 } =
          await loadFixture(deployAddressDiscovery);

        await expect(
          addressDiscovery
            .connect(admin)
            .updateAddress(CONTRACT_1, contractAddress1.address)
        ).not.to.be.reverted;

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(
          contractAddress1.address
        );
      });

      it("Should emit AddressUpdated event on successful update", async function () {
        const { addressDiscovery, admin, CONTRACT_1, contractAddress1 } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address))
          .to.emit(addressDiscovery, "AddressUpdated")
          .withArgs(CONTRACT_1, ZeroAddress, contractAddress1.address, admin.address);
      });
     
      it("Should emit AddressUpdated event when updating existing address", async function () {
        const { addressDiscovery, admin, CONTRACT_1, contractAddress1, contractAddress2 } = 
          await loadFixture(deployAddressDiscovery);

        // First update
        await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);

        // Second update should emit event with old address
        await expect(addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress2.address))
          .to.emit(addressDiscovery, "AddressUpdated")
          .withArgs(CONTRACT_1, contractAddress1.address, contractAddress2.address, admin.address);
      });

      it("Should revert if new address is zero", async function () {
        const { addressDiscovery, admin, CONTRACT_1 } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(admin).updateAddress(CONTRACT_1, ZeroAddress))
          .to.be.revertedWithCustomError(addressDiscovery, "InvalidAddress")
          .withArgs(ZeroAddress);
      });

      it("Should revert if caller doesn't have admin role", async function () {
        const { addressDiscovery, user, CONTRACT_1, contractAddress1, ADDRESS_DISCOVERY_ADMIN_ROLE } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(user).updateAddress(CONTRACT_1, contractAddress1.address))
          .to.be.revertedWithCustomError(addressDiscovery, "AccessControlUnauthorizedAccount")
          .withArgs(user.address, ADDRESS_DISCOVERY_ADMIN_ROLE);
      });

      it("Should allow deployer to update address", async function () {
        const { addressDiscovery, deployer, CONTRACT_1, contractAddress1 } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(deployer).updateAddress(CONTRACT_1, contractAddress1.address))
          .not.to.be.reverted;

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1.address);
      });

      it("Should allow multiple address updates for different contracts", async function () {
        const { addressDiscovery, admin, CONTRACT_1, CONTRACT_2, contractAddress1, contractAddress2 } = 
          await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);
        await addressDiscovery.connect(admin).updateAddress(CONTRACT_2, contractAddress2.address);

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1.address);
        expect(await addressDiscovery.getContractAddress(CONTRACT_2)).to.equal(contractAddress2.address);
      });
    });

    describe("getContractAddress", function () {
      it("Should return correct address for registered contract", async function () {
        const { addressDiscovery, admin, CONTRACT_1, contractAddress1 } = 
          await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1.address);
      });

      it("Should revert for non-registered contract", async function () {
        const { addressDiscovery, NON_EXISTENT_CONTRACT } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.getContractAddress(NON_EXISTENT_CONTRACT))
          .to.be.revertedWithCustomError(addressDiscovery, "ContractNotRegistered")
          .withArgs(NON_EXISTENT_CONTRACT);
      });

      it("Should return updated address after modification", async function () {
        const { addressDiscovery, admin, CONTRACT_1, contractAddress1, contractAddress2 } = 
          await loadFixture(deployAddressDiscovery);

        // Initial registration
        await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);
        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1.address);

        // Update address
        await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress2.address);
        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress2.address);
      });
    });

    describe("isRegistered", function () {
      it("Should return true for registered contract", async function () {
        const { addressDiscovery, admin, CONTRACT_1, contractAddress1 } = 
          await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);

        expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;
      });

      it("Should return false for non-registered contract", async function () {
        const { addressDiscovery, NON_EXISTENT_CONTRACT } = 
          await loadFixture(deployAddressDiscovery);

        expect(await addressDiscovery.isRegistered(NON_EXISTENT_CONTRACT)).to.be.false;
      });

      it("Should return true after address update", async function () {
        const { addressDiscovery, admin, CONTRACT_1, contractAddress1, contractAddress2 } = 
          await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);
        await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress2.address);

        expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;
      });
    });
  });

  describe("Admin Management", function () {
    describe("addAdmin", function () {
      it("Should allow default admin to add new admin", async function () {
        const { addressDiscovery, deployer, otherAdmin, ADDRESS_DISCOVERY_ADMIN_ROLE } = 
          await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(deployer).addAdmin(otherAdmin.address);

        expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, otherAdmin.address)).to.be.true;
      });

      it("Should revert if admin address is zero", async function () {
        const { addressDiscovery, deployer } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(deployer).addAdmin(ZeroAddress))
          .to.be.revertedWithCustomError(addressDiscovery, "InvalidAddress")
          .withArgs(ZeroAddress);
      });

      it("Should revert if caller is not default admin", async function () {
        const { addressDiscovery, admin, otherAdmin, DEFAULT_ADMIN_ROLE } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(admin).addAdmin(otherAdmin.address))
          .to.be.revertedWithCustomError(addressDiscovery, "AccessControlUnauthorizedAccount")
          .withArgs(admin.address, DEFAULT_ADMIN_ROLE);
      });

      it("Should allow newly added admin to update addresses", async function () {
        const { addressDiscovery, deployer, otherAdmin, CONTRACT_1, contractAddress1 } = 
          await loadFixture(deployAddressDiscovery);

        // Add new admin
        await addressDiscovery.connect(deployer).addAdmin(otherAdmin.address);

        // New admin should be able to update addresses
        await expect(addressDiscovery.connect(otherAdmin).updateAddress(CONTRACT_1, contractAddress1.address))
          .not.to.be.reverted;

        expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1.address);
      });
    });

    describe("removeAdmin", function () {
      it("Should allow default admin to remove admin", async function () {
        const { addressDiscovery, deployer, admin, ADDRESS_DISCOVERY_ADMIN_ROLE } = 
          await loadFixture(deployAddressDiscovery);

        expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, admin.address)).to.be.true;

        // Remove admin
        await addressDiscovery.connect(deployer).removeAdmin(admin.address);

        expect(await addressDiscovery.hasRole(ADDRESS_DISCOVERY_ADMIN_ROLE, admin.address)).to.be.false;
      });

      it("Should revert if admin address is zero", async function () {
        const { addressDiscovery, deployer } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(deployer).removeAdmin(ZeroAddress))
          .to.be.revertedWithCustomError(addressDiscovery, "InvalidAddress")
          .withArgs(ZeroAddress);
      });

      it("Should revert if caller is not default admin", async function () {
        const { addressDiscovery, admin, otherAdmin, DEFAULT_ADMIN_ROLE } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(admin).removeAdmin(otherAdmin.address))
          .to.be.revertedWithCustomError(addressDiscovery, "AccessControlUnauthorizedAccount")
          .withArgs(admin.address, DEFAULT_ADMIN_ROLE);
      });

      it("Should prevent removed admin from updating addresses", async function () {
        const { addressDiscovery, deployer, admin, CONTRACT_1, contractAddress1, ADDRESS_DISCOVERY_ADMIN_ROLE } = 
          await loadFixture(deployAddressDiscovery);

        await addressDiscovery.connect(deployer).removeAdmin(admin.address);

        // Removed admin should not be able to update addresses
        await expect(addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address))
          .to.be.revertedWithCustomError(addressDiscovery, "AccessControlUnauthorizedAccount")
          .withArgs(admin.address, ADDRESS_DISCOVERY_ADMIN_ROLE);
      });

      it("Should allow removing non-existent admin without error", async function () {
        const { addressDiscovery, deployer, user } = 
          await loadFixture(deployAddressDiscovery);

        await expect(addressDiscovery.connect(deployer).removeAdmin(user.address))
          .not.to.be.reverted;
      });
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple admins managing different contracts", async function () {
      const { addressDiscovery, deployer, admin, otherAdmin, CONTRACT_1, CONTRACT_2, contractAddress1, contractAddress2 } = 
        await loadFixture(deployAddressDiscovery);

      await addressDiscovery.connect(deployer).addAdmin(otherAdmin.address);

      // Both admins update different contracts
      await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);
      await addressDiscovery.connect(otherAdmin).updateAddress(CONTRACT_2, contractAddress2.address);

      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1.address);
      expect(await addressDiscovery.getContractAddress(CONTRACT_2)).to.equal(contractAddress2.address);
      expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;
      expect(await addressDiscovery.isRegistered(CONTRACT_2)).to.be.true;
    });

    it("Should maintain state consistency after admin role changes", async function () {
      const { addressDiscovery, deployer, admin, CONTRACT_1, contractAddress1, contractAddress2 } = 
        await loadFixture(deployAddressDiscovery);

      await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);
      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1.address);

      // Remove admin
      await addressDiscovery.connect(deployer).removeAdmin(admin.address);

      // Contract should still be registered and accessible
      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress1.address);
      expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;

      // Deployer (still has admin role) can still update
      await addressDiscovery.connect(deployer).updateAddress(CONTRACT_1, contractAddress2.address);
      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(contractAddress2.address);
    });

    it("Should handle multiple updates correctly", async function () {
      const { addressDiscovery, admin, CONTRACT_1, contractAddress1, contractAddress2, user } = 
        await loadFixture(deployAddressDiscovery);

      // Multiple rapid updates
      await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);
      await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress2.address);
      await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, user.address);

      expect(await addressDiscovery.getContractAddress(CONTRACT_1)).to.equal(user.address);
      expect(await addressDiscovery.isRegistered(CONTRACT_1)).to.be.true;
    });
  });

  describe("Events", function () {
    it("Should emit correct events for first-time registration", async function () {
      const { addressDiscovery, admin, CONTRACT_1, contractAddress1 } = 
        await loadFixture(deployAddressDiscovery);

      await expect(addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address))
        .to.emit(addressDiscovery, "AddressUpdated")
        .withArgs(CONTRACT_1, ZeroAddress, contractAddress1.address, admin.address);
    });

    it("Should emit correct events for address updates", async function () {
      const { addressDiscovery, admin, CONTRACT_1, contractAddress1, contractAddress2 } = 
        await loadFixture(deployAddressDiscovery);

      await addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress1.address);

      // Update should emit event with old address
      await expect(addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress2.address))
        .to.emit(addressDiscovery, "AddressUpdated")
        .withArgs(CONTRACT_1, contractAddress1.address, contractAddress2.address, admin.address);
    });

    it("Should emit events with correct caller address", async function () {
      const { addressDiscovery, deployer, admin, CONTRACT_1, contractAddress1, contractAddress2 } = 
        await loadFixture(deployAddressDiscovery);

      // Deployer updates
      await expect(addressDiscovery.connect(deployer).updateAddress(CONTRACT_1, contractAddress1.address))
        .to.emit(addressDiscovery, "AddressUpdated")
        .withArgs(CONTRACT_1, anyValue, contractAddress1.address, deployer.address);

      // Admin updates
      await expect(addressDiscovery.connect(admin).updateAddress(CONTRACT_1, contractAddress2.address))
        .to.emit(addressDiscovery, "AddressUpdated")
        .withArgs(CONTRACT_1, anyValue, contractAddress2.address, admin.address);
    });
  });
});
