// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AccessChannelValidations
 * @dev Centralized validation library for channel operations
 */
library AccessChannelValidations {
    
    // =============================================================
    //                        CUSTOM ERRORS
    // =============================================================
    
    error ChannelAlreadyExists(bytes32 channelName);
    error ChannelDoesNotExist(bytes32 channelName);
    error ChannelAlreadyActive(bytes32 channelName);
    error ChannelAlreadyDeactivated(bytes32 channelName);
    error ChannelNotActive(bytes32 channelName);
    error CreatorCannotBeMember(bytes32 channelName, address member);
    error MemberAlreadyInChannel(bytes32 channelName, address member);
    error InvalidMemberAddress(address member);
    error MemberNotInChannel(bytes32 channelName, address member);
    error ChannelMemberLimitExceeded(bytes32 channelName, uint256 limit);
    error EmptyMemberArray();
    error BatchSizeExceeded(uint256 provided, uint256 maximum);
    error InvalidPageNumber(uint256 page);
    error InvalidPageSize(uint256 pageSize);
    error InvalidAddress(address addr);
    
    
    // =============================================================
    //                     VALIDATION FUNCTIONS
    // =============================================================
    
    /**
     * @dev Validates that an address is not zero
     * @param addr Address to validate
     */
    function validateAddress(address addr) internal pure {
        if (addr == address(0)) {
            revert InvalidMemberAddress(addr);
        }
    }
    
    /**
     * @dev Validates that a channel exists
     * @param exists Channel existence flag
     * @param channelName Channel name for error reporting
     */
    function requireChannelExists(bool exists, bytes32 channelName) internal pure {
        if (!exists) {
            revert ChannelDoesNotExist(channelName);
        }
    }
    
    /**
     * @dev Validates that a channel is active
     * @param isActive Channel active flag
     * @param channelName Channel name for error reporting
     */
    function requireChannelActive(bool isActive, bytes32 channelName) internal pure {
        if (!isActive) {
            revert ChannelNotActive(channelName);
        }
    }
    
    /**
     * @dev Validates channel doesn't already exist
     * @param exists Channel existence flag
     * @param channelName Channel name for error reporting
     */
    function requireChannelNotExists(bool exists, bytes32 channelName) internal pure {
        if (exists) {
            revert ChannelAlreadyExists(channelName);
        }
    }
    
    /**
     * @dev Validates channel is already active
     * @param isActive Channel active flag
     * @param channelName Channel name for error reporting
     */
    function requireChannelNotActive(bool isActive, bytes32 channelName) internal pure {
        if (isActive) {
            revert ChannelAlreadyActive(channelName);
        }
    }
    
    /**
     * @dev Validates channel is already deactivated
     * @param isActive Channel active flag
     * @param channelName Channel name for error reporting
     */
    function requireChannelNotDeactivated(bool isActive, bytes32 channelName) internal pure {
        if (!isActive) {
            revert ChannelAlreadyDeactivated(channelName);
        }
    }
    
    /**
     * @dev Validates member is not already in channel
     * @param isMember Member status flag
     * @param channelName Channel name for error reporting
     * @param member Member address for error reporting
     */
    function requireMemberNotInChannel(bool isMember, bytes32 channelName, address member) internal pure {
        if (isMember) {
            revert MemberAlreadyInChannel(channelName, member);
        }
    }
    
    /**
     * @dev Validates member is in channel
     * @param isMember Member status flag
     * @param channelName Channel name for error reporting
     * @param member Member address for error reporting
     */
    function requireMemberInChannel(bool isMember, bytes32 channelName, address member) internal pure {
        if (!isMember) {
            revert MemberNotInChannel(channelName, member);
        }
    }
    
    /**
     * @dev Validates creator cannot be added as member
     * @param creator Channel creator address
     * @param member Member address to check
     * @param channelName Channel name for error reporting
     */
    function requireCreatorNotMember(address creator, address member, bytes32 channelName) internal pure {
        if (creator == member) {
            revert CreatorCannotBeMember(channelName, member);
        }
    }
    
    /**
     * @dev Validates member limit not exceeded
     * @param currentCount Current member count
     * @param limit Maximum allowed members
     * @param channelName Channel name for error reporting
     */
    function requireMemberLimitNotExceeded(uint256 currentCount, uint256 limit, bytes32 channelName) internal pure {
        if (currentCount >= limit) {
            revert ChannelMemberLimitExceeded(channelName, limit);
        }
    }
    
    /**
     * @dev Validates array is not empty
     * @param arrayLength Length of array to check
     */
    function requireNonEmptyArray(uint256 arrayLength) internal pure {
        if (arrayLength == 0) {
            revert EmptyMemberArray();
        }
    }
    
    /**
     * @dev Validates batch size doesn't exceed maximum
     * @param batchSize Size of batch operation
     * @param maxBatchSize Maximum allowed batch size
     */
    function requireBatchSizeValid(uint256 batchSize, uint256 maxBatchSize) internal pure {
        if (batchSize > maxBatchSize) {
            revert BatchSizeExceeded(batchSize, maxBatchSize);
        }
    }
}