// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAddressDiscovery} from "../interfaces/IAddressDiscovery.sol";
import {IAccessChannelManager} from "../interfaces/IAccessChannelManager.sol";
import {
    ACCESS_CHANNEL_MANAGER
} from "./Constants.sol";

/**
 * @title ChannelAccess
 * @notice Library for channel membership validation
 * @dev Provides isolated logic for channel access control
 */
library ChannelAccess {
    error InvalidChannelName(bytes32 channelName);
    error UnauthorizedChannelAccess(bytes32 channelName, address caller);

    /**
     * @dev Validates that an account is a member of a channel
     * @param discovery Address discovery contract
     * @param channelName Channel to check
     * @param member Account to verify
     */
    function requireMember(
        IAddressDiscovery discovery,
        bytes32 channelName,
        address member
    ) internal view {
        if (channelName == bytes32(0)) revert InvalidChannelName(channelName);

        address managerAddr = discovery.getContractAddress(ACCESS_CHANNEL_MANAGER);
        IAccessChannelManager manager = IAccessChannelManager(managerAddr);

        if (!manager.isChannelMember(channelName, member)) {
            revert UnauthorizedChannelAccess(channelName, member);
        }
    }

    /**
     * @dev Checks if an account is a member of a channel
     * @param discovery Address discovery contract
     * @param channelName Channel to check
     * @param member Account to verify
     * @return Whether the account is a member
     */
    function isMember(
        IAddressDiscovery discovery,
        bytes32 channelName,
        address member
    ) internal view returns (bool) {
        if (channelName == bytes32(0)) return false;

        address managerAddr = discovery.getContractAddress(ACCESS_CHANNEL_MANAGER);
        IAccessChannelManager manager = IAccessChannelManager(managerAddr);
        
        return manager.isChannelMember(channelName, member);
    }

    function getChannelInfo(IAddressDiscovery discovery, bytes32 channelName)
        internal view returns (bool exists, bool active, address owner, uint256 memberCount, uint256 createdAt)
    {
        address managerAddr = discovery.getContractAddress(ACCESS_CHANNEL_MANAGER);
        IAccessChannelManager manager = IAccessChannelManager(managerAddr);
        return manager.getChannelInfo(channelName);
    }
}