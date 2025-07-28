// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAddressDiscovery
 * @dev Interface to manage addresses of smart contracts and their updates 
 * @author Juan Minango
 */
interface IAddressDiscovery {

    // =============================================================
    //                        EVENTS
    // =============================================================
    
    /**
     * Event emitted when a smart contract address is registered or updated.
     * @param smartContract Name of the smart contract
     * @param oldAddress Old address of the smart contract
     * @param newAddress New address of the smart contract
     * @param updatedBy Address of the user who updated the smart contract address
     */
    event AddressUpdated(
        bytes32 indexed smartContract,
        address indexed oldAddress,
        address indexed newAddress,
        address updatedBy
    );
    
    // =============================================================
    //                        ERRORS
    // =============================================================
    
    /**
     * @dev Error when smart contract address is invalid
     */
    error InvalidAddress(address addr);
    
    /**
     * @dev Error when a smart contract is not registered
     */
    error ContractNotRegistered(bytes32 smartContract);
        
    // =============================================================
    //                        ADDRESS MANAGEMENT
    // =============================================================
    
    /**
     * Function to register/update a new smart contract address.
     * @param smartContract Name of the smart contract using keccak256
     * @param newAddress Address of the smart contract
     */
    function updateAddress(bytes32 smartContract, address newAddress) external;
    
    /**
     * Function to get the address of a smart contract.
     * @param smartContract Name of the smart contract using keccak256
     * @return Address of the smart contract
     */
    function getContractAddress(bytes32 smartContract) external view returns (address);
    
    /**
     * Function to check if a smart contract is registered.
     * @param smartContract Name of the smart contract using keccak256
     * @return True if the smart contract is registered, false otherwise
     */
    function isRegistered(bytes32 smartContract) external view returns (bool);
}
