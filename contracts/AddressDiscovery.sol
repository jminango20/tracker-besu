// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAddressDiscovery} from "./interfaces/IAddressDiscovery.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    ADDRESS_DISCOVERY_ADMIN_ROLE
    } from "./lib/Constants.sol";

/**
 * @title AddressDiscovery
 * @notice Contract for managing addresses of smart contracts and their updates
 * @dev Contract that facilitates the discovery of addresses of smart contracts to be used in other contracts.
 */
contract AddressDiscovery is Context, IAddressDiscovery, AccessControl {

    // =============================================================
    //                        STORAGE
    // =============================================================

    /**
     * Mapping to store addresses of smart contracts.
     * @dev smartContract => address
     */
    mapping(bytes32 => address) private _addressDiscovery;


    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /**
     * Function to initialize the contract.
     * @param _admin Address of the admin
     */
    constructor(address _admin) {
        if (_admin == address(0)) revert InvalidAddress(_admin);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(ADDRESS_DISCOVERY_ADMIN_ROLE, _msgSender());
        _grantRole(ADDRESS_DISCOVERY_ADMIN_ROLE, _admin);
    }

    // =============================================================
    //                    EXTERNAL FUNCTIONS
    // =============================================================

    /**
     * @inheritdoc IAddressDiscovery
     */
    function updateAddress(bytes32 smartContract, address newAddress) 
        external 
        onlyRole(ADDRESS_DISCOVERY_ADMIN_ROLE) 
    {
        if (newAddress == address(0)) revert InvalidAddress(newAddress);
        
        address oldAddress = _addressDiscovery[smartContract];
        
        _addressDiscovery[smartContract] = newAddress;
        
        emit AddressUpdated(smartContract, oldAddress, newAddress, msg.sender);
    }

    /**
     * @inheritdoc IAddressDiscovery
     */
    function getAddress(bytes32 smartContract) 
        external 
        view 
        returns (address) 
    {
        address contractAddress = _addressDiscovery[smartContract];
        
        if (contractAddress == address(0)) {
            revert ContractNotRegistered(smartContract);
        }
        
        return contractAddress;
    }


    /**
     * @inheritdoc IAddressDiscovery
     */
    function isRegistered(bytes32 smartContract) 
        external 
        view 
        returns (bool) 
    {
        return _addressDiscovery[smartContract] != address(0);
    }

    // =============================================================
    //                    ACCESS CONTROL HELPERS
    // =============================================================

    /**
     * Function to add a new address discovery admin.
     * @param newAddressDiscoveryAdmin Address of the new address discovery admin
     */
    function addAdmin(address newAddressDiscoveryAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newAddressDiscoveryAdmin == address(0)) revert InvalidAddress(newAddressDiscoveryAdmin);
        _grantRole(ADDRESS_DISCOVERY_ADMIN_ROLE, newAddressDiscoveryAdmin);
    }

    /**
     * Function to remove an address discovery admin.
     * @param addressDiscoveryAdmin Address of the address discovery admin to remove
     */
    function removeAdmin(address addressDiscoveryAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (addressDiscoveryAdmin == address(0)) revert InvalidAddress(addressDiscoveryAdmin);
        _revokeRole(ADDRESS_DISCOVERY_ADMIN_ROLE, addressDiscoveryAdmin);
    }
}