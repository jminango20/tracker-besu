// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {
    INVALID_PAGE,
    FIRST_PAGE,
    MAX_PAGE_SIZE
} from "./Constants.sol";

/**
 * @title Pagination
 * @notice Library for pagination calculations
 * @dev Provides isolated logic for pagination bounds
 */
library Pagination {
    error InvalidPageNumber(uint256 page);
    error InvalidPageSize(uint256 pageSize);

    /**
     * @dev Validates pagination parameters
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     */
    function validate(uint256 page, uint256 pageSize) internal pure {
        if (page == INVALID_PAGE) revert InvalidPageNumber(page);
        if (pageSize == INVALID_PAGE || pageSize > MAX_PAGE_SIZE) revert InvalidPageSize(pageSize);
    }

    /**
     * @dev Calculates pagination bounds
     * @param totalItems Total number of items
     * @param page Page number (1-indexed)
     * @param pageSize Items per page
     * @return startIndex Starting index for the page
     * @return endIndex Ending index for the page
     * @return totalPages Total number of pages
     * @return hasNextPage Whether there's a next page
     */
    function calculate(
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
}