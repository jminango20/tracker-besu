// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {ISchemaRegistry} from "./interfaces/ISchemaRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    SCHEMA_ADMIN_ROLE,
    MAX_STRING_LENGTH
    } from "./lib/Constants.sol";

/**
 * @title SchemaRegistry
 * @notice Contract for managing data schemas in the trace system
 * @dev Inherits from BaseTraceContract for common functionality
 */
contract SchemaRegistry is Context,BaseTraceContract, ISchemaRegistry {

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

        // Verify owner
        Schema storage firstSchema = _schemasByChannelName[channelName][schemaId][1];
        if (firstSchema.owner != _msgSender()) {
            revert NotSchemaOwner(schemaId, _msgSender());
        }

        uint256 deprecatedCount = 0;

        // Deprecate all versions of the schema
        for (uint256 version = 1; version <= latestVersion; version++) {
            if (_schemaExistsByChannelName[channelName][schemaId][version]) {
                Schema storage schema = _schemasByChannelName[channelName][schemaId][version];
                
                if (schema.status == SchemaStatus.ACTIVE) {
                    schema.status = SchemaStatus.DEPRECATED;
                    schema.updatedAt = block.timestamp;
                    deprecatedCount++;
                }
            }
        }

        uint256 activeVersion = _activeVersions[channelName][schemaId];
        if (activeVersion != 0) {
            _activeVersions[channelName][schemaId] = 0; // Sem versão ativa

            unchecked {
                _activeSchemaCount[channelName]--;
            }
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

        if (schema.status != SchemaStatus.ACTIVE && schema.status != SchemaStatus.DEPRECATED) {
            revert SchemaNotActiveOrDeprecated(schemaId, schema.status);
        }

        schema.status = SchemaStatus.INACTIVE;
        schema.updatedAt = block.timestamp;

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
            _msgSender(),
            channelName,
            block.timestamp
        );
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