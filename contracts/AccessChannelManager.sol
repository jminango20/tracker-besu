// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAccessChannelManager} from "./interfaces/IAccessChannelManager.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {AccessChannelValidations} from "./lib/AccessChannelValidations.sol";
import {Utils} from "./lib/Utils.sol";
import {
    DEFAULT_ADMIN_ROLE, 
    CHANNEL_AUTHORITY_ROLE, 
    CHANNEL_ADMIN_ROLE,
    MAX_BATCH_SIZE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    INVALID_PAGE,
    FIRST_PAGE
    } from "./lib/Constants.sol";


/**
 * @title AccessChannelManager
 * @notice Contract for managing scalable access channels
 */
contract AccessChannelManager is Context, IAccessChannelManager, AccessControl {

    using AccessChannelValidations for *;

    // =============================================================
    //                        STORAGE
    // =============================================================

    struct Channel {
        bool exists;
        bool isActive;
        address creator;
        uint256 memberCount;
        uint256 createdAt;
    }

    /**
     * Mapping to store channel information.
     * @dev channelName => Channel
     */
    mapping (bytes32 => Channel) private _channels;

    /**
     * Mapping to store channel members.
     * @dev channelName => memberAddress => bool
     */
    mapping(bytes32 => mapping(address => bool)) private _channelMembers;

    /**
     * Mapping to store channel members by index.
     * @dev channelName => index => memberAddress
     */
    mapping(bytes32 => mapping(uint256 => address)) private _channelMembersByIndex;

    /**
     * Mapping to store member index in the channel.
     * @dev channelName => memberAddress => index
     */
    mapping(bytes32 => mapping(address => uint256)) private _memberIndex;

    /**
     * Mapping to store channel index.
     * @dev index => channelName
     */
    mapping(uint256 => bytes32) private _channelsByIndex;

    /**
     * Total number of channels.
     */
    uint256 private _channelCount;

    // =============================================================
    //                        MODIFIERS
    // =============================================================

    /**
     * Validates that the channel exists and is active.
     */
    modifier validChannelAndActive(bytes32 channelName) {
        Channel storage channel = _channels[channelName];
        AccessChannelValidations.requireChannelExists(channel.exists, channelName);
        AccessChannelValidations.requireChannelActive(channel.isActive, channelName);
        _;
    }

    /**
     * Validates that the channel exists.
     */
    modifier validChannel(bytes32 channelName) {
        AccessChannelValidations.requireChannelExists(_channels[channelName].exists, channelName);
        _;
    }

    /**
     * Validates that the address is not zero.
     */
    modifier validAddress(address addr) {
        AccessChannelValidations.validateAddress(addr);
        _;
    }

    /**
     * Validates that the batch size is valid.
     */
    modifier validBatchSize(uint256 batchSize) {
        AccessChannelValidations.requireBatchSizeValid(batchSize, MAX_BATCH_SIZE);
        _;
    }

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(CHANNEL_AUTHORITY_ROLE, _msgSender());
        _grantRole(CHANNEL_ADMIN_ROLE, _msgSender());
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function createChannel(bytes32 channelName) external onlyRole(CHANNEL_AUTHORITY_ROLE) {

        AccessChannelValidations.requireChannelNotExists(_channels[channelName].exists, channelName);

        _channels[channelName] = Channel({
            exists: true,
            isActive: true,
            creator: _msgSender(),
            memberCount: 0,
            createdAt: Utils.timestamp()
        });

        _channelsByIndex[_channelCount] = channelName;
        _channelCount++;

        emit ChannelCreated(channelName, _msgSender(), Utils.timestamp());
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function activateChannel(bytes32 channelName) external onlyRole(CHANNEL_AUTHORITY_ROLE) validChannel(channelName) {

        if (!_channels[channelName].exists) {
            revert AccessChannelValidations.ChannelDoesNotExist(channelName);
        } 

        if (_channels[channelName].isActive) {
            revert AccessChannelValidations.ChannelAlreadyActive(channelName);
        }

        Channel storage channel = _channels[channelName];
        AccessChannelValidations.requireChannelNotActive(channel.isActive, channelName);

        channel.isActive = true;
        emit ChannelActivated(channelName, Utils.timestamp());
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function desactivateChannel(bytes32 channelName) external onlyRole(CHANNEL_AUTHORITY_ROLE) validChannel(channelName) {
        
        Channel storage channel = _channels[channelName];
        AccessChannelValidations.requireChannelNotDeactivated(channel.isActive, channelName);

        channel.isActive = false;
        emit ChannelDeactivated(channelName, Utils.timestamp());
    }

    // =============================================================
    //                    MEMBER MANAGEMENT
    // =============================================================
    
    /**
     * @inheritdoc IAccessChannelManager
     */
    function addChannelMember(bytes32 channelName, address member) 
        external 
        onlyRole(CHANNEL_ADMIN_ROLE)
        validAddress(member) 
        validChannelAndActive(channelName)        
    {
        _addMember(channelName, member);
    }


    /**
     * @inheritdoc IAccessChannelManager
     */
    function addChannelMembers(bytes32 channelName, address[] calldata members) 
        external 
        onlyRole(CHANNEL_ADMIN_ROLE)
        validChannelAndActive(channelName)
        validBatchSize(members.length)
    {
        AccessChannelValidations.requireNonEmptyArray(members.length);

        Channel storage channel = _channels[channelName];
        address creator = channel.creator;
        
        uint256 addedCount = 0;
        uint256 length = members.length;
        
        for (uint256 i; i < length;) {
            address member = members[i];
            
            // Skip invalid addresses
            if (member != address(0) && 
                member != creator && 
                !_channelMembers[channelName][member]) {
                
                _addMemberUnchecked(channelName, member);
                addedCount++;
            }
            
            unchecked { ++i; }
        }
        
        emit ChannelMembersAdded(channelName, members, channel.memberCount);
    }
    
    /**
     * @inheritdoc IAccessChannelManager
     */
    function removeChannelMember(bytes32 channelName, address member) 
        external 
        onlyRole(CHANNEL_ADMIN_ROLE)
        validAddress(member)
        validChannelAndActive(channelName)
    {
        AccessChannelValidations.requireMemberInChannel(
            _channelMembers[channelName][member], 
            channelName, 
            member
        );

        _removeMember(channelName, member);
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function removeChannelMembers(bytes32 channelName, address[] calldata members) 
        external 
        onlyRole(CHANNEL_ADMIN_ROLE)
        validChannelAndActive(channelName)
        validBatchSize(members.length)
    {
        AccessChannelValidations.requireNonEmptyArray(members.length);

        Channel storage channel = _channels[channelName];
        uint256 length = members.length;
        
        for (uint256 i; i < length;) {
            address member = members[i];
            
            if (member != address(0) && _channelMembers[channelName][member]) {
                _removeMemberUnchecked(channelName, member);
            }
            
            unchecked { ++i; }
        }
        
        emit ChannelMembersRemoved(channelName, members, channel.memberCount);
    }

    // =============================================================
    //                       VIEW FUNCTIONS
    // =============================================================
    
    /**
     * @inheritdoc IAccessChannelManager
     */
    function isChannelMember(bytes32 channelName, address member) 
        external 
        view
        validChannelAndActive(channelName)
        validAddress(member)
        returns (bool)     
    {
        return _channelMembers[channelName][member];
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function getChannelMembersPaginated(bytes32 channelName, uint256 page, uint256 pageSize) 
        external 
        view 
        validChannelAndActive(channelName)
        returns (
            address[] memory members,
            uint256 totalMembers,
            uint256 totalPages,
            bool hasNextPage
        ) 
    {
        if (page == INVALID_PAGE) revert AccessChannelValidations.InvalidPageNumber(page);
        if (pageSize == INVALID_PAGE || pageSize > MAX_PAGE_SIZE) revert AccessChannelValidations.InvalidPageSize(pageSize);
        
        Channel storage channel = _channels[channelName];
        totalMembers = channel.memberCount;
        
        if (totalMembers == 0) {
            return (new address[](0), 0, 0, false);
        }
        
        totalPages = (totalMembers + pageSize - FIRST_PAGE) / pageSize; // Ceiling division
        
        if (page > totalPages) {
            return (new address[](0), totalMembers, totalPages, false);
        }
        
        uint256 startIndex = (page - FIRST_PAGE) * pageSize;
        uint256 endIndex = startIndex + pageSize;
        if (endIndex > totalMembers) {
            endIndex = totalMembers;
        }
        
        uint256 resultLength = endIndex - startIndex;
        members = new address[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            members[i] = _channelMembersByIndex[channelName][startIndex + i];
        }
        
        hasNextPage = page < totalPages;
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function getChannelInfo(bytes32 channelName) 
        external 
        view 
        returns (bool exists, bool isActive, address creator, uint256 memberCount, uint256 createdAt) 
    {
        Channel storage channel = _channels[channelName];
        return (
            channel.exists,
            channel.isActive,
            channel.creator,
            channel.memberCount,
            channel.createdAt
        );
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function getChannelCount() external view returns (uint256) {
        return _channelCount;
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function getAllChannelsPaginated(
        uint256 page,
        uint256 pageSize
    ) 
        external 
        view 
        returns (
            bytes32[] memory channels,
            uint256 totalChannels,
            uint256 totalPages,
            bool hasNextPage
        ) 
    {
        if (page == INVALID_PAGE) revert AccessChannelValidations.InvalidPageNumber(page);
        if (pageSize == INVALID_PAGE || pageSize > MAX_PAGE_SIZE) revert AccessChannelValidations.InvalidPageSize(pageSize);
        
        totalChannels = _channelCount;
        
        if (totalChannels == 0) {
            return (new bytes32[](0), 0, 0, false);
        }
        
        totalPages = (totalChannels + pageSize - FIRST_PAGE) / pageSize;
        
        if (page > totalPages) {
            return (new bytes32[](0), totalChannels, totalPages, false);
        }
        
        uint256 startIndex = (page - FIRST_PAGE) * pageSize;
        uint256 endIndex = startIndex + pageSize;
        if (endIndex > totalChannels) {
            endIndex = totalChannels;
        }
        
        uint256 resultLength = endIndex - startIndex;
        channels = new bytes32[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            channels[i] = _channelsByIndex[startIndex + i];
        }
        
        hasNextPage = page < totalPages;
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function getChannelMemberCount(bytes32 channelName) 
        external 
        view 
        validChannel(channelName)
        returns (uint256) 
    {
        return _channels[channelName].memberCount;
    }

    /**
     * @inheritdoc IAccessChannelManager
     */
    function areChannelMembers(
        bytes32 channelName, 
        address[] calldata members
    ) 
        external 
        view 
        validChannelAndActive(channelName)
        returns (bool[] memory results) 
    {
        results = new bool[](members.length);
        
        for (uint256 i = 0; i < members.length; i++) {
            results[i] = _channelMembers[channelName][members[i]];
        }
    }

    // =============================================================
    //                    ACCESS CONTROL HELPERS
    // =============================================================

    /**
     * Function to add a new channel admin.
     * @param newChannelAdmin Address of the new channel admin
     */
    function addChannelAdmin(address newChannelAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newChannelAdmin == address(0)) revert AccessChannelValidations.InvalidAddress(newChannelAdmin);
        _grantRole(CHANNEL_ADMIN_ROLE, newChannelAdmin);
    }

    /**
     * Function to remove a channel admin.
     * @param addressChannelAdmin Address of channel admin to remove
     */
    function removeChannelAdmin(address addressChannelAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (addressChannelAdmin == address(0)) revert AccessChannelValidations.InvalidAddress(addressChannelAdmin);
        _revokeRole(CHANNEL_ADMIN_ROLE, addressChannelAdmin);
    }

    /**
     * Function to add a new channel authority.
     * @param newChannelAuthority Address of the new channel authority
     */
    function addChannelAuthority(address newChannelAuthority) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newChannelAuthority == address(0)) revert AccessChannelValidations.InvalidAddress(newChannelAuthority);
        _grantRole(CHANNEL_AUTHORITY_ROLE, newChannelAuthority);
    }

    /**
     * Function to remove a channel authority.
     * @param addressChannelAuthority Address of channel authority to remove
     */
    function removeChannelAuthority(address addressChannelAuthority) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (addressChannelAuthority == address(0)) revert AccessChannelValidations.InvalidAddress(addressChannelAuthority);
        _revokeRole(CHANNEL_AUTHORITY_ROLE, addressChannelAuthority);
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    /**
     * Internal function to add a member to a channel with all validations.
     * @param channelName The name of the channel
     * @param member Address of the member to add
     */
     function _addMember(bytes32 channelName, address member) private {
        Channel storage channel = _channels[channelName];
    
        AccessChannelValidations.requireMemberNotInChannel(
            _channelMembers[channelName][member], 
            channelName, 
            member
        );

        _addMemberUnchecked(channelName, member);
        emit ChannelMemberAdded(channelName, member, channel.memberCount);
    }

    /**
     * Internal function to add a member to a channel without any validations (for batch operations).
     * @param channelName The name of the channel
     * @param member Address of the member to add
     */
    function _addMemberUnchecked(bytes32 channelName, address member) private {
        Channel storage channel = _channels[channelName];
        
        // Add to member mapping
        _channelMembers[channelName][member] = true;
        
        // Add to enumeration
        uint256 newIndex = channel.memberCount;
        _channelMembersByIndex[channelName][newIndex] = member;
        _memberIndex[channelName][member] = newIndex;
        
        channel.memberCount++;
    }

    /**
     * Internal function to remove a member from a channel.
     * @param channelName The name of the channel
     * @param member Address of the member to remove
     */
    function _removeMember(bytes32 channelName, address member) private {
        _removeMemberUnchecked(channelName, member);
        emit ChannelMemberRemoved(channelName, member, _channels[channelName].memberCount);
    }

    /**
     * Function to remove a member from a channel without any validations (for batch operations).
     * @param channelName The name of the channel
     * @param member Address of the member to remove
     */
    function _removeMemberUnchecked(bytes32 channelName, address member) private {
        Channel storage channel = _channels[channelName];
        
        uint256 memberIdx = _memberIndex[channelName][member];
        uint256 lastIdx = channel.memberCount - 1;
        
        if (memberIdx != lastIdx) {
            address lastMember = _channelMembersByIndex[channelName][lastIdx];
            _channelMembersByIndex[channelName][memberIdx] = lastMember;
            _memberIndex[channelName][lastMember] = memberIdx;
        }
        
        delete _channelMembers[channelName][member];
        delete _channelMembersByIndex[channelName][lastIdx];
        delete _memberIndex[channelName][member];
        
        channel.memberCount--;
    }   
}