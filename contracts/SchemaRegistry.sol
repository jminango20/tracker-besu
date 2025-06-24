// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {ISchemaRegistry} from "./interfaces/ISchemaRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    SCHEMA_ADMIN_ROLE,
    MAX_STRING_LENGTH,
    MAX_PAGE_SIZE
    } from "./lib/Constants.sol";

/**
 * @title SchemaRegistry
 * @notice Contract for managing data schemas in the trace system
 * @dev Inherits from BaseTraceContract for common functionality
 */
contract SchemaRegistry is Context, BaseTraceContract, ISchemaRegistry {

    // =============================================================
    //                        STORAGE
    // =============================================================

    /**
     * Mapping to store schemasId by channel name
     * @dev channelName => schemaId => version => Schema
     */
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => Schema))) private _schemasByChannelName;

    /**
     * Mapping to track schemaId existence by channel name
     * @dev channelName => schemaId => version => exists
     */
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => bool))) private _schemaExistsByChannelName;

    /**
     * Mapping for schema count per channel
     * @dev channelName => count
     */
    mapping(bytes32 => uint256) private _channelSchemaCount;

    /**
     * Mapping for schemas by owner and channel
     * @dev owner => channelName => schemaId => version
     */
    mapping(address => mapping(bytes32 => mapping(uint256 => bytes32))) private _schemasByOwner;

    /**
     * Mapping for schema count by owner and channel
     * @dev owner => channelName => count
     */
    mapping(address => mapping(bytes32 => uint256)) private _ownerSchemaCount;

    /**
     * Mapping for latest version by name and channel
     * @dev channelName => schemaId => version 
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) private _latestVersions;

    /**
     * Mapping for active schemas by channel
     * @dev channelName => schemaId => version => isActive
     */
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => bool))) private _isActiveSchemaIdByVersionAndChannel;

    /**
     * Mapping to track active version per schema 
     * @dev channelName => schemaId => activeVersion
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) private _activeVersions;

    /**
     * Mapping for active schema count per channel
     * @dev channelName => count
     */
    mapping(bytes32 => uint256) private _activeSchemaCount;



    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /**
     * Constructor for SchemaRegistry
     * @param addressDiscovery_ Address of the AddressDiscovery contract
     */
    constructor(address addressDiscovery_) 
        BaseTraceContract(addressDiscovery_) 
    {
        _grantRole(SCHEMA_ADMIN_ROLE, _msgSender());
    }

    // =============================================================
    //                    SCHEMA MANAGEMENT
    // =============================================================

    /**
     * @inheritdoc ISchemaRegistry
     */
    function createSchema(SchemaInput calldata schemaInput) 
        external 
        validChannelName(schemaInput.channelName)
        onlyChannelMember(schemaInput.channelName)
    {

        if (schemaInput.id == bytes32(0)) revert InvalidSchemaId();
        if (bytes(schemaInput.name).length == 0) revert InvalidSchemaName();
        if (schemaInput.dataHash == bytes32(0)) revert InvalidDataHash();
        if (bytes(schemaInput.description).length > MAX_STRING_LENGTH) revert DescriptionTooLong();

        
        if (_schemaExistsByChannelName[schemaInput.channelName][schemaInput.id][schemaInput.version]) {
            revert SchemaAlreadyExistsInChannel(schemaInput.channelName, schemaInput.id, schemaInput.version);   
        }
        
        // Create schema
        Schema memory newSchema = Schema({
            id: schemaInput.id,
            name: schemaInput.name,
            version: schemaInput.version,
            dataHash: schemaInput.dataHash,
            owner: _msgSender(),
            channelName: schemaInput.channelName,
            status: SchemaStatus.ACTIVE, 
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            description: schemaInput.description
        });


        // Store updates
        _schemasByChannelName[schemaInput.channelName][schemaInput.id][schemaInput.version] = newSchema;
        _schemaExistsByChannelName[schemaInput.channelName][schemaInput.id][schemaInput.version] = true;
        _latestVersions[schemaInput.channelName][schemaInput.id] = schemaInput.version;
        _isActiveSchemaIdByVersionAndChannel[schemaInput.channelName][schemaInput.id][schemaInput.version] = true;
        _activeVersions[schemaInput.channelName][schemaInput.id] = schemaInput.version;

        // Owner tracking
        uint256 ownerIndex = _ownerSchemaCount[_msgSender()][schemaInput.channelName];
        _schemasByOwner[_msgSender()][schemaInput.channelName][ownerIndex] = schemaInput.id;

        // Increment counters 
        unchecked {
            _channelSchemaCount[schemaInput.channelName]++;
            _ownerSchemaCount[_msgSender()][schemaInput.channelName]++;
            _activeSchemaCount[schemaInput.channelName]++;
        }

        emit SchemaCreated(
            newSchema.id,
            newSchema.name,
            newSchema.version,
            newSchema.owner,
            newSchema.channelName,
            block.timestamp
        );
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function deprecateSchema(bytes32 schemaId, bytes32 channelName)
        external 
        validChannelName(channelName)
        onlyChannelMember(channelName)
    {
        if (schemaId == bytes32(0)) revert InvalidSchemaId();

        uint256 latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion == 0) {
            revert SchemaNotFoundInChannel(channelName, schemaId);
        }

        uint256 activeVersion = _activeVersions[channelName][schemaId];
        if (activeVersion == 0) {
            revert NoActiveSchemaVersion(schemaId);
        }

        // Verify owner
        Schema storage activeSchema = _schemasByChannelName[channelName][schemaId][activeVersion];
        if (activeSchema.owner != _msgSender()) {
            revert NotSchemaOwner(schemaId, _msgSender());
        }

        if (activeSchema.status != SchemaStatus.ACTIVE) {
            revert SchemaNotActive(schemaId, activeSchema.status);
        }

        uint256 deprecatedCount = 0;

        // Deprecate just active versions of the schema
        for (uint256 version = 1; version <= latestVersion; version++) {
            if (_schemaExistsByChannelName[channelName][schemaId][version]) {
                Schema storage schema = _schemasByChannelName[channelName][schemaId][version];
                
                if (schema.status == SchemaStatus.ACTIVE) {
                    schema.status = SchemaStatus.DEPRECATED;
                    schema.updatedAt = block.timestamp;
                    deprecatedCount++;

                    _isActiveSchemaIdByVersionAndChannel[channelName][schemaId][version] = false;
                }
            }
        }

        _activeVersions[channelName][schemaId] = 0;

         unchecked {
            _activeSchemaCount[channelName]--;
        }
        
        emit SchemaDeprecated(
            schemaId,
            _msgSender(),
            channelName,
            block.timestamp,
            deprecatedCount  
        );
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function inactivateSchema(bytes32 schemaId, uint256 version, bytes32 channelName) 
        external 
        validChannelName(channelName)
        onlyChannelMember(channelName)
    {
        if (schemaId == bytes32(0)) revert InvalidSchemaId();
        if (version == 0) revert InvalidVersion();

        if (!_schemaExistsByChannelName[channelName][schemaId][version]) {
            revert SchemaVersionNotFoundInChannel(channelName, schemaId, version);
        }

        Schema storage schema = _schemasByChannelName[channelName][schemaId][version];

        if (schema.owner != _msgSender()) {
           revert NotSchemaOwner(schemaId, _msgSender());
        }

        if (schema.status == SchemaStatus.INACTIVE) {
            revert SchemaAlreadyInactive(schemaId, version);
        }

        if (schema.status != SchemaStatus.ACTIVE && schema.status != SchemaStatus.DEPRECATED) {
            revert SchemaNotActiveOrDeprecated(schemaId, schema.status);
        }

        SchemaStatus previousStatus = schema.status;

        // Update schema status
        schema.status = SchemaStatus.INACTIVE;
        schema.updatedAt = block.timestamp;

        if (_isActiveSchemaIdByVersionAndChannel[channelName][schemaId][version]) {
            _isActiveSchemaIdByVersionAndChannel[channelName][schemaId][version] = false;
        }

        // If the schema was active, update the active version
        if (_activeVersions[channelName][schemaId] == version) {
            _activeVersions[channelName][schemaId] = 0;
            
            unchecked {
                _activeSchemaCount[channelName]--;
            }
        }

        emit SchemaInactivated(
            schemaId,
            version,
            previousStatus,
            _msgSender(),
            channelName,
            block.timestamp
        );
    }


    /**
     * @inheritdoc ISchemaRegistry
     */
    function updateSchema(SchemaUpdateInput calldata schemaUpdateInput) 
        external 
        validChannelName(schemaUpdateInput.channelName)
        onlyChannelMember(schemaUpdateInput.channelName)
    {
        if (schemaUpdateInput.id == bytes32(0)) revert InvalidSchemaId();
        if (schemaUpdateInput.newVersion == 0) revert InvalidVersion();
        if (schemaUpdateInput.newDataHash == bytes32(0)) revert InvalidDataHash();
        if (bytes(schemaUpdateInput.description).length > MAX_STRING_LENGTH) revert DescriptionTooLong();

        uint256 latestVersion = _latestVersions[schemaUpdateInput.channelName][schemaUpdateInput.id];
        if (latestVersion == 0) {
            revert SchemaNotFoundInChannel(schemaUpdateInput.channelName, schemaUpdateInput.id);
        }

        uint256 activeVersion = _activeVersions[schemaUpdateInput.channelName][schemaUpdateInput.id];
        if (activeVersion == 0) {
            revert NoActiveSchemaVersion(schemaUpdateInput.id);
        }

        //Get the current schema
        Schema storage currentSchema = _schemasByChannelName[schemaUpdateInput.channelName][schemaUpdateInput.id][activeVersion];

        if (currentSchema.owner != _msgSender()) {
            revert NotSchemaOwner(schemaUpdateInput.id, _msgSender());
        }

        if (currentSchema.status != SchemaStatus.ACTIVE) {
            revert SchemaNotActive(schemaUpdateInput.id, currentSchema.status);
        }

        // New version must be greater than latest version (numerical validation)
        if (schemaUpdateInput.newVersion <= latestVersion) {
            revert InvalidNewVersion(schemaUpdateInput.id, latestVersion, schemaUpdateInput.newVersion);
        }

        if (_schemaExistsByChannelName[schemaUpdateInput.channelName][schemaUpdateInput.id][schemaUpdateInput.newVersion]) {
            revert SchemaVersionAlreadyExists(schemaUpdateInput.channelName, schemaUpdateInput.id, schemaUpdateInput.newVersion);
        }

        uint256 timestamp = block.timestamp;

        // Update the schema
        currentSchema.status = SchemaStatus.DEPRECATED;
        currentSchema.updatedAt = timestamp;

        Schema memory newSchema = Schema({
            id: schemaUpdateInput.id,           
            name: currentSchema.name,
            version: schemaUpdateInput.newVersion,
            dataHash: schemaUpdateInput.newDataHash,
            owner: _msgSender(),                            
            channelName: schemaUpdateInput.channelName,
            status: SchemaStatus.ACTIVE,
            createdAt: timestamp,
            updatedAt: timestamp,
            description: schemaUpdateInput.description
        });

        // Storages Updates
        _schemasByChannelName[schemaUpdateInput.channelName][schemaUpdateInput.id][schemaUpdateInput.newVersion] = newSchema;
        _schemaExistsByChannelName[schemaUpdateInput.channelName][schemaUpdateInput.id][schemaUpdateInput.newVersion] = true;

        _latestVersions[schemaUpdateInput.channelName][schemaUpdateInput.id] = schemaUpdateInput.newVersion;
        _activeVersions[schemaUpdateInput.channelName][schemaUpdateInput.id] = schemaUpdateInput.newVersion;

        _isActiveSchemaIdByVersionAndChannel[schemaUpdateInput.channelName][schemaUpdateInput.id][schemaUpdateInput.newVersion] = true;
        _isActiveSchemaIdByVersionAndChannel[schemaUpdateInput.channelName][schemaUpdateInput.id][activeVersion] = false;

        uint256 ownerIndex = _ownerSchemaCount[_msgSender()][schemaUpdateInput.channelName];
        _schemasByOwner[_msgSender()][schemaUpdateInput.channelName][ownerIndex] = schemaUpdateInput.id;

        unchecked {
            _channelSchemaCount[schemaUpdateInput.channelName]++;  // New version = new schema count
            _ownerSchemaCount[_msgSender()][schemaUpdateInput.channelName]++;  // Owner has one more schema
            // _activeSchemaCount stays same (1 deprecated, 1 new active)
        }

        emit SchemaUpdated(
            schemaUpdateInput.id,        
            activeVersion,                     // Previous version (deprecated)
            schemaUpdateInput.newVersion,     // New version (active)
            _msgSender(),                      
            schemaUpdateInput.channelName,    
            timestamp                         
        );
    }


    /**
     * @inheritdoc ISchemaRegistry
     */
    function getSchema(bytes32 channelName, bytes32 schemaId, uint256 version) 
        external 
        view 
        validChannelName(channelName)
        onlyChannelMember(channelName)
        returns (Schema memory schema) 
    {
        if (!_schemaExistsByChannelName[channelName][schemaId][version]) {
            revert SchemaVersionNotFoundInChannel(channelName, schemaId, version);
        }
        
        return _schemasByChannelName[channelName][schemaId][version];
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getActiveSchema(bytes32 channelName, bytes32 schemaId) 
        external 
        view 
        validChannelName(channelName)
        onlyChannelMember(channelName)
        returns (Schema memory schema) 
    {
        uint256 activeVersion = _activeVersions[channelName][schemaId];
        if (activeVersion == 0) {
            revert NoActiveSchemaVersion(schemaId);
        }
        
        return _schemasByChannelName[channelName][schemaId][activeVersion];
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getLatestSchema(bytes32 channelName, bytes32 schemaId) 
        external 
        view 
        validChannelName(channelName)
        onlyChannelMember(channelName)
        returns (Schema memory schema) 
    {
        uint256 latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion == 0) {
            revert SchemaNotFoundInChannel(channelName, schemaId);
        }
        
        return _schemasByChannelName[channelName][schemaId][latestVersion];
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getSchemaVersions(bytes32 channelName, bytes32 schemaId) 
        external 
        view 
        validChannelName(channelName)
        onlyChannelMember(channelName)
        returns (uint256[] memory versions, Schema[] memory schemas) 
    {
        uint256 latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion == 0) {
            revert SchemaNotFoundInChannel(channelName, schemaId);
        }
        
        uint256 existingCount = 0;
        for (uint256 i = 1; i <= latestVersion; i++) {
            if (_schemaExistsByChannelName[channelName][schemaId][i]) {
                existingCount++;
            }
        }
        
        versions = new uint256[](existingCount);
        schemas = new Schema[](existingCount);
        
        uint256 index = 0;
        for (uint256 i = 1; i <= latestVersion; i++) {
            if (_schemaExistsByChannelName[channelName][schemaId][i]) {
                versions[index] = i;
                schemas[index] = _schemasByChannelName[channelName][schemaId][i];
                index++;
            }
        }
    }



    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================




    // =============================================================
    //                    IMPLEMENTATION REQUIREMENTS
    // =============================================================

    /**
     * @inheritdoc BaseTraceContract
     */
    function getVersion() external pure override returns (string memory) {
        return "1.0.0";
    }
}