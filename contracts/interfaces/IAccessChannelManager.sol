// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
interface IAccessChannelManager is IERC165 {

    /**
     * Function to create a new channel.
     * @param channelName - The name of the channel to create
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
     * Function to check if a member is a part of a channel.
     * @param channelName The name of the channel
     * @param member The address of the member to check
     */
    function isChannelMember(bytes32 channelName, address member) external view returns (bool);

    /**
     * Function to get all members of a channel.
     * @param channelName The name of the channel
     */
    function getChannelMembers(bytes32 channelName) external view returns (address[] memory);

    /**
     * Event emitted when a channel is created.
     * @param channelName The name of the channel
     * @param creator Address of the creator of the channel
     */
    event ChannelCreated(bytes32 indexed channelName, address creator);

    /**
     * Event emitted when a channel is activated.
     * @param channelName The name of the channel
     */
    event ChannelActivated(bytes32 indexed channelName);

    /**
     * Event emitted when a channel is desactivated.
     * @param channelName The name of the channel
     */
    event ChannelDesactivated(bytes32 indexed channelName);

    /**
     * Event emitted when a member is added to a channel.
     * @param channelName The name of the channel
     * @param member Address of the member added
     */
    event ChannelMemberAdded(bytes32 indexed channelName, address member);

    /**
     * Event emitted when a member is removed from a channel.
     * @param channelName The name of the channel
     * @param member Address of the member removed
     */
    event ChannelMemberRemoved(bytes32 indexed channelName, address member);
}