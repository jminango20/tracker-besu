// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Utils library
 */
library Utils {

    function timestamp() internal view returns (uint256) {
        return block.timestamp;
    }
}