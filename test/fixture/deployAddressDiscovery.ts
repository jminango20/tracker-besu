import hre from "hardhat";
import { getTestAccounts } from "../utils/index"; 

export async function deployAddressDiscovery() {

    const accounts = await getTestAccounts();
    const AddressDiscovery = await hre.ethers.getContractFactory("AddressDiscovery");
    const addressDiscovery = await AddressDiscovery.deploy(accounts.admin.address);

    await addressDiscovery.waitForDeployment();

    return {
      addressDiscovery,
      accounts
    };
}