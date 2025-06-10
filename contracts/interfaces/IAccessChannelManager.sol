// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAccessChannelManager
 * @dev Interface for managing scalable access channels with unlimited members
 * @author Juan Minango
 */
interface IAccessChannelManager {

    // =============================================================
    //                        CHANNEL MANAGEMENT
    // =============================================================

    /**
     * Function to create a new channel.
     * @param channelName The name of the channel to create
     */
    function createChannel(bytes32 channelName) external;

    /**
     * Function to activate a channel.
     * @param channelName The name of the channel to activate
     */
    function activateChannel(bytes32 channelName) external;

    /**
     * Function to desactivate a channel.
     * @param channelName The name of the channel to desactivate
     */
    function desactivateChannel(bytes32 channelName) external;

    // =============================================================
    //                        MEMBER MANAGEMENT
    // =============================================================
    
    /**
     * Function to add a member to a channel.
     * @param channelName The name of the channel
     * @param member The address of the member to add
     */
    function addChannelMember(bytes32 channelName, address member) external;
    
    /**
     * Function to remove a member from a channel.
     * @param channelName The name of the channel
     * @param member The address of the member to remove
     */
    function removeChannelMember(bytes32 channelName, address member) external;

    /**
     * Function to add multiple members to a channel.
     * @param channelName The name of the channel
     * @param members Array of addresses of the members to add
     */
    function addChannelMembers(bytes32 channelName, address[] calldata members) external;

    /**
     * Function to remove multiple members from a channel.
     * @param channelName The name of the channel
     * @param members Array of addresses of the members to remove
     */
    function removeChannelMembers(bytes32 channelName, address[] calldata members) external;


    // =============================================================
    //                        VIEW FUNCTIONS
    // =============================================================
    
    /**
     * Function to check if a member is a part of a channel.
     * @param channelName The name of the channel
     * @param member The address of the member to check
     * @return True if the member is a part of the channel, false otherwise
     */
    function isChannelMember(bytes32 channelName, address member) external view returns (bool);

    /**
     * Function to get the members of a channel.
     * @param channelName The name of the channel
     * @param page Page number (1-indexed)
     * @param pageSize Number of members per page
     * @return members Array of addresses of the members in the channel
     * @return totalMembers Total number of members in the channel
     * @return totalPages Total number of pages
     * @return hasNextPage Whether there is a next page
     */
    function getChannelMembersPaginated(
        bytes32 channelName, 
        uint256 page, 
        uint256 pageSize
    ) external view returns (
        address[] memory members,
        uint256 totalMembers,
        uint256 totalPages,
        bool hasNextPage
    );

    /**
     * Function to get information about a channel.
     * @param channelName The name of the channel
     * @return exists Whether the channel exists
     * @return isActive Whether the channel is active
     * @return creator Address of the creator of the channel
     * @return memberCount Number of members in the channel
     * @return createdAt Block timestamp when the channel was created
     */
    function getChannelInfo(bytes32 channelName) external view returns (
        bool exists,
        bool isActive,
        address creator,
        uint256 memberCount,
        uint256 createdAt
    );

    /**
     * Function to get the total number of channels.
     * @return totalChannels Total number of channels
     */
    function getChannelCount() external view returns (uint256);

    /**
     * Function to get the total number of channels.
     * @param page Page number (1-indexed)
     * @param pageSize Number of channels per page
     * @return channels Array of names of the channels
     * @return totalChannels Total number of channels
     * @return totalPages Total number of pages
     * @return hasNextPage Whether there is a next page
     */
    function getAllChannelsPaginated(
        uint256 page,
        uint256 pageSize
    ) external view returns (
        bytes32[] memory channels,
        uint256 totalChannels,
        uint256 totalPages,
        bool hasNextPage
    );

    /**
     * Function to get the total number of members in a channel.
     * @param channelName The name of the channel
     * @return memberCount Number of members in the channel
     */
    function getChannelMemberCount(bytes32 channelName) external view returns (uint256);

    /**
     * Function to check if multiple members are part of a channel.
     * @param channelName The name of the channel
     * @param members Array of addresses of the members to check
     * @return results Array of booleans indicating if each member is a part of the channel
     */
    function areChannelMembers(
        bytes32 channelName, 
        address[] calldata members
    ) external view returns (bool[] memory results);


    // =============================================================
    //                           EVENTS
    // =============================================================
    event ChannelCreated(bytes32 indexed channelName, address indexed creator, uint256 timestamp);
    event ChannelActivated(bytes32 indexed channelName, uint256 timestamp);
    event ChannelDeactivated(bytes32 indexed channelName, uint256 timestamp);
    event ChannelMemberAdded(bytes32 indexed channelName, address indexed member, uint256 newMemberCount);
    event ChannelMemberRemoved(bytes32 indexed channelName, address indexed member, uint256 newMemberCount);
    event ChannelMembersAdded(bytes32 indexed channelName, address[] members, uint256 newMemberCount);
    event ChannelMembersRemoved(bytes32 indexed channelName, address[] members, uint256 newMemberCount);
}