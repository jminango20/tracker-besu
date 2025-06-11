// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

    
// =============================================================
//                        ACCESS ROLES
// =============================================================
    
/// @dev Default admin role (OpenZeppelin standard)
bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;
    
/// @dev Role for channel authority operations (create, activate, deactivate)
bytes32 constant CHANNEL_AUTHORITY_ROLE = keccak256("CHANNEL_AUTHORITY_ROLE");
    
/// @dev Role for channel admin operations (add/remove members)
bytes32 constant CHANNEL_ADMIN_ROLE = keccak256("CHANNEL_ADMIN_ROLE");

/// @dev Role for address discovery admin operations
bytes32 constant ADDRESS_DISCOVERY_ADMIN_ROLE = keccak256("ADDRESS_DISCOVERY_ADMIN_ROLE");

/// @dev Role for schema admin operations 
bytes32 constant SCHEMA_ADMIN_ROLE = keccak256("SCHEMA_ADMIN_ROLE");
   
// =============================================================
//                        SYSTEM LIMITS
// ============================================================= 
    
/// @dev Maximum batch size for adding members in one transaction
uint256 constant MAX_BATCH_SIZE = 100;
    
/// @dev Default page size for pagination
uint256 constant DEFAULT_PAGE_SIZE = 50;
    
/// @dev Maximum page size for pagination
uint256 constant MAX_PAGE_SIZE = 200;
        
/// @dev Starting page number for pagination (1-indexed)
uint256 constant FIRST_PAGE = 1;
    
/// @dev Zero page indicator (invalid)
uint256 constant INVALID_PAGE = 0;

/// @dev Maximum string length
uint256 constant MAX_STRING_LENGTH = 255;
    
// =============================================================
//                        VERSION & METADATA
// =============================================================
   
/// @dev Contract version
string constant VERSION = "1.0.0";
    
/// @dev Contract name for events and metadata
string constant CONTRACT_NAME = "AccessChannelManager";

/// @dev Contract name of AccessChannelManager
bytes32 constant ACCESS_CHANNEL_MANAGER = keccak256("ACCESS_CHANNEL_MANAGER");
    
// =============================================================
//                        STATUS FLAGS
// =============================================================
    
/// @dev Channel active status
bool constant ACTIVE = true;
    
/// @dev Channel inactive status
bool constant INACTIVE = false;
    
/// @dev Channel exists status
bool constant EXISTS = true;
    
/// @dev Channel doesn't exist status
bool constant NOT_EXISTS = false;
