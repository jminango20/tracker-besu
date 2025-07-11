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

    // Update struct for updating schemas
    struct SchemaUpdateInput {
        bytes32 id;                // Schema unique identifier to be updated
        bytes32 newDataHash;       // Updated hash of the complete JSON schema (stored off-chain)
        bytes32 channelName;       // Virtual channel name
        string description;        // Updated schema description
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

    event SchemaDeprecated(
        bytes32 indexed schemaId,
        uint256 version, 
        address indexed owner, 
        bytes32 indexed channelName, 
        uint256 timestamp,
        uint256 expirationTime   
    );

    event SchemaInactivated(
        bytes32 indexed schemaId,
        uint256 indexed version,
        SchemaStatus status,
        address indexed owner,
        bytes32 channelName,
        uint256 timestamp
    );

    event SchemaUpdated(
        bytes32 indexed schemaId,
        uint256 previousVersion,
        uint256 indexed newVersion,
        address indexed owner,
        bytes32 channelName,
        uint256 timestamp
    );

    // =============================================================
    //                        CUSTOM ERRORS
    // =============================================================
    
    error InvalidSchemaId();
    error InvalidDataHash();
    error InvalidSchemaName();
    error DescriptionTooLong();
    error InvalidVersion();
    error SchemaNotFoundInChannel(bytes32 channelName, bytes32 schemaId);
    error SchemaVersionNotFoundInChannel(bytes32 channelName, bytes32 schemaId, uint256 version);
    error NotSchemaOwner(bytes32 schemaId, address owner);
    error SchemaNotActive(bytes32 schemaId, SchemaStatus status);
    error SchemaAlreadyInactive(bytes32 schemaId, uint256 version);
    error SchemaHasNoActiveVersion(bytes32 schemaId);
    error CannotUpdateSchemaWithoutActiveVersion(bytes32 schemaId);
    error SchemaAlreadyExistsCannotRecreate(bytes32 schemaId);
    error SchemaNotDeprecated(bytes32 schemaId, uint256 version);

    // =============================================================
    //                    SCHEMA MANAGEMENT
    // =============================================================

    /**
     * Creates a new schema
     * @param schema Schema data to create
     */
    function createSchema(SchemaInput calldata schema) external;

    /**
     * Changes the status of a schema to deprecated
     * @param schemaId Schema identifier
     * @param channelName The name of the channel to which the schema belongs
     */
    function deprecateSchema(bytes32 schemaId, bytes32 channelName) external; 

    /**
     * Changes the status of a schema to inactive
     * @param schemaId Schema identifier
     * @param version Schema version
     * @param channelName The name of the channel to which the schema belongs
     */
    function inactivateSchema(bytes32 schemaId, uint256 version, bytes32 channelName) external;

    /**
     * Updates a schema 
     * @param schema Schema data to update
     */
    function updateSchema(SchemaUpdateInput calldata schema) external;

    /**
     * Get a specific schema by ID and version
     * @param channelName The channel name
     * @param schemaId The schema ID
     * @param version The schema version
     * @return schema The schema data
     */
    function getSchemaByVersion(bytes32 channelName, bytes32 schemaId, uint256 version) external view returns (Schema memory schema);

    /**
     * Get the active version of a schema
     * @param channelName The channel name
     * @param schemaId The schema ID
     * @return schema The active schema data
     */
    function getActiveSchema(bytes32 channelName, bytes32 schemaId) external view returns (Schema memory schema);

    /**
     * Get the latest version of a schema (may not be active)
     * @param channelName The channel name
     * @param schemaId The schema ID
     * @return schema The latest schema data
     */
    function getLatestSchema(bytes32 channelName, bytes32 schemaId) external view returns (Schema memory schema);

    /**
     * Get all versions of a specific schema
     * @param channelName The channel name
     * @param schemaId The schema ID
     * @return versions Array of version numbers
     * @return schemas Array of schema data
     */
    function getSchemaVersions(bytes32 channelName, bytes32 schemaId) external view returns (uint256[] memory versions, Schema[] memory schemas);

    /**
     * Get information about a schema
     * @param channelName The channel name
     * @param schemaId The schema ID
     * @return latestVersion The latest schema version
     * @return activeVersion The active schema version
     * @return hasActiveVersion True if the schema has an active version
     * @return owner The schema owner
     * @return totalVersions The total number of versions
     */
    function getSchemaInfo(
        bytes32 channelName, 
        bytes32 schemaId
    ) external view returns 
        (
            uint256 latestVersion, 
            uint256 activeVersion, 
            bool hasActiveVersion, 
            address owner, 
            uint256 totalVersions
        );
}