// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAddressDiscovery} from "../interfaces/IAddressDiscovery.sol";

/**
 * @title AddressDiscoveryHelper
 * @notice Library for address discovery operations
 * @dev Provides isolated logic for contract address resolution
 */
library AddressDiscoveryHelper {
    error InvalidAddress(address addr);

    /**
     * @dev Validates that an address is not zero
     * @param addr Address to validate
     */
    function validateAddress(address addr) internal pure {
        if (addr == address(0)) revert InvalidAddress(addr);
    }
}