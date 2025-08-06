// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAccessChannelManager} from "./interfaces/IAccessChannelManager.sol";
import {IAddressDiscovery} from "./interfaces/IAddressDiscovery.sol";
import {
    INVALID_PAGE,
    FIRST_PAGE,
    MAX_PAGE_SIZE,
    DEFAULT_ADMIN_ROLE,
    ACCESS_CHANNEL_MANAGER
} from "./lib/Constants.sol";

/**
 * @title BaseTraceContract
 * @notice Abstract contract providing common functionality for all trace contracts
 * @dev Base contract that all trace system contracts should inherit from
 */
abstract contract BaseTraceContract is Context, AccessControl, ReentrancyGuard {

    // =============================================================
    //                        INTERFACES
    // =============================================================

    /**
     * Address discovery contract for getting other contract addresses
     */
    IAddressDiscovery private _addressDiscovery;

    // =============================================================
    //                        ERRORS
    // =============================================================

    error InvalidAddress(address addr);
    error InvalidChannelName(bytes32 channelName);
    error UnauthorizedChannelAccess(bytes32 channelName, address caller);
    error InvalidPageNumber(uint256 page);
    error InvalidPageSize(uint256 pageSize);
   
    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /**
     * Constructor for BaseTraceContract
     * @param addressDiscovery Address of the AddressDiscovery contract
     */
    constructor(address addressDiscovery) {

        if (addressDiscovery == address(0)) revert InvalidAddress(addressDiscovery);
       
        _addressDiscovery = IAddressDiscovery(addressDiscovery);
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());        
    }

    // =============================================================
    //                        MODIFIERS
    // =============================================================

    /**
     * Ensures caller is a member of the specified channel
     * @param channelName The name of the channel to check membership for
     */
    modifier onlyChannelMember(bytes32 channelName) {
        _requireChannelMember(channelName, _msgSender());
        _;
    }

    /**
     * Validates that channel Name is not empty
     * @param channelName The channel Name to validate
     */
    modifier validChannelName(bytes32 channelName) {
        if (channelName == bytes32(0)) revert InvalidChannelName(channelName);
        _;
    }

    /**
     * Validates pagination parameters
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     */
    modifier validPagination(uint256 page, uint256 pageSize) {
        if (page == INVALID_PAGE) revert InvalidPageNumber(page);
        if (pageSize == INVALID_PAGE || pageSize > MAX_PAGE_SIZE) revert InvalidPageSize(pageSize);
        _;
    }

    /**
     * Validates that address is not zero
     * @param addr Address to validate
     */
    modifier validAddress(address addr) {
        if (addr == address(0)) revert InvalidAddress(addr);
        _;
    }

    // =============================================================
    //                    EXTERNAL FUNCTIONS
    // =============================================================

    /**
     * Checks if an account is a member of a channel
     * @param channelName Name of the channel to check
     * @param account Account to check
     * @return Whether the account is a member
     */
    function isChannelMember(bytes32 channelName, address account) 
        external 
        view 
        validChannelName(channelName)
        validAddress(account)
        returns (bool) 
    {
        return _getAccessChannelManager().isChannelMember(channelName, account);
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    /**
     * Sets the address discovery instance
     * @param addressDiscoveryAdd Address of the address discovery contract
     */
    function _setAddressDiscovery(address addressDiscoveryAdd) internal {
        _addressDiscovery = IAddressDiscovery(addressDiscoveryAdd);
    }

    /**
     * Gets the address discovery instance
     * @return The address discovery contract
     */
    function _getAddressDiscovery() internal view returns (IAddressDiscovery) {
        return _addressDiscovery;
    }

    /**
     * Gets the access channel manager instance
     * @return The access channel manager contract
     */
    function _getAccessChannelManager() internal view returns (IAccessChannelManager) {
        return IAccessChannelManager(_addressDiscovery.getContractAddress(ACCESS_CHANNEL_MANAGER));
    }

    /**
     * Requires that caller is a member of the specified channel
     * @param channelName The name of the channel to check membership for
     * @param member Account to check
     */
    function _requireChannelMember(bytes32 channelName, address member) internal view {
        if (channelName == bytes32(0)) revert InvalidChannelName(channelName);
        
        IAccessChannelManager accessChannelManager = _getAccessChannelManager();
        if (!accessChannelManager.isChannelMember(channelName, member)) {
            revert UnauthorizedChannelAccess(channelName, member);
        }
    }

    /**
     * Calculates pagination values
     * @param totalItems Total number of items
     * @param page Page number (1-indexed)
     * @param pageSize Items per page
     * @return startIndex Starting index for the page
     * @return endIndex Ending index for the page
     * @return totalPages Total number of pages
     * @return hasNextPage Whether there's a next page
     */
    function _calculatePagination(
        uint256 totalItems,
        uint256 page,
        uint256 pageSize
    )
        internal
        pure
        returns (
            uint256 startIndex,
            uint256 endIndex,
            uint256 totalPages,
            bool hasNextPage
        )
    {
        if (totalItems == 0) {
            return (0, 0, 0, false);
        }
        
        totalPages = (totalItems + pageSize - FIRST_PAGE) / pageSize; // Ceiling division
        
        if (page > totalPages) {
            return (0, 0, totalPages, false);
        }
        
        startIndex = (page - FIRST_PAGE) * pageSize;
        endIndex = startIndex + pageSize;
        if (endIndex > totalItems) {
            endIndex = totalItems;
        }
        
        hasNextPage = page < totalPages;
    }

    /**
     * Generates a unique ID based on multiple parameters
     * @param param1 First parameter
     * @param param2 Second parameter
     * @param param3 Third parameter
     * @return Unique bytes32 ID
     */
    function _generateId(
        bytes32 param1,
        bytes32 param2,
        bytes32 param3
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(param1, param2, param3));
    }

    // =============================================================
    //                    VIRTUAL FUNCTIONS
    // =============================================================

    /**
     * Get the version of the contract
     * @dev Should be implemented by inheriting contracts
     * @return Version string
     */
    function getVersion() external pure virtual returns (string memory);
}