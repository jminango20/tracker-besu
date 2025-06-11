// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISchemaRegistry
 * @dev Interface for managing data schemas in the trace system
 */
interface ISchemaRegistry {

    // =============================================================
    //                        ENUMS
    // =============================================================

    enum SchemaStatus { 
        ACTIVE,     // Schema is active and can be used
        DEPRECATED, // Schema is deprecated but still valid for existing data
        INACTIVE    // Schema is inactive and cannot be used
    }

    // =============================================================
    //                        STRUCTS
    // =============================================================

    // Input struct for creating schemas
    struct SchemaInput {
        bytes32 id;                    // Schema unique identifier
        string name;                   // Schema name
        bytes32 dataHash;              // Hash of the complete JSON schema (stored off-chain)
        bytes32 channelName;           // Virtual channel name
        string description;            // Schema description
    }


    // Schema struct
    struct Schema {
        bytes32 id;                    // Schema unique identifier
        string name;                   // Schema name
        uint256 version;               // Schema version
        bytes32 dataHash;              // Hash of the complete JSON schema (stored off-chain)
        address owner;                 // Schema owner 
        bytes32 channelName;           // Virtual channel name
        SchemaStatus status;           // Current schema status
        uint256 createdAt;             // Creation timestamp
        uint256 updatedAt;             // Last update timestamp
        string description;            // Schema description
    }

    // =============================================================
    //                        EVENTS
    // =============================================================

    event SchemaCreated(
        bytes32 indexed schemaId,
        string indexed name,
        uint256 indexed version,
        address owner,
        bytes32 channelName,
        uint256 timestamp
    );

    // =============================================================
    //                        CUSTOM ERRORS
    // =============================================================
    
    error SchemaAlreadyExistsInChannel(bytes32 channelName, bytes32 schemaId);
    error SchemaHasNoVersions(bytes32 schemaId, bytes32 channelName); 
    error InvalidSchemaId();
    error InvalidSchemaName();
    error InvalidDataHash();
    error DescriptionTooLong();
    error SchemaAlreadyExists(bytes32 schemaId);


    // =============================================================
    //                    SCHEMA MANAGEMENT
    // =============================================================

    /**
     * Creates a new schema
     * @param schema Schema data to create
     */
    function createSchema(SchemaInput calldata schema) external;

}