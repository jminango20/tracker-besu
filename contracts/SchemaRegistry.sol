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
     * @dev channelName => schemaId => Schema
     */
    mapping(bytes32 => mapping(bytes32 => Schema)) private _schemasByChannelName;

    /**
     * Mapping to track schemaId existence by channel name
     * @dev channelName => schemaId => exists
     */
    mapping(bytes32 => mapping(bytes32 => bool)) private _schemaExistsByChannelName;

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
     * Mapping for schema versions by name and channel
     * @dev channelName => schemaId => version 
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) private _schemaVersions;

    /**
     * Mapping for latest version by name and channel
     * @dev channelName => schemaId => version 
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) private _latestVersions;

    /**
     * Mapping for active schemas by channel
     * @dev channelName => schemaId => bool
     */
    mapping(bytes32 => mapping(bytes32 => bool)) private _isActiveSchemaIdByChannel;

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

        
        if (_schemaExistsByChannelName[schemaInput.channelName][schemaInput.id]) {
            revert SchemaAlreadyExistsInChannel(schemaInput.channelName, schemaInput.id);   
        }
        
        // Create schema
        Schema memory newSchema = Schema({
            id: schemaInput.id,
            name: schemaInput.name,
            version: 1,
            dataHash: schemaInput.dataHash,
            owner: _msgSender(),
            channelName: schemaInput.channelName,
            status: SchemaStatus.ACTIVE, 
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            description: schemaInput.description
        });


        // Store updates
        _schemasByChannelName[schemaInput.channelName][schemaInput.id] = newSchema;
        _schemaExistsByChannelName[schemaInput.channelName][schemaInput.id] = true;
        _schemaVersions[schemaInput.channelName][schemaInput.id] = 1;
        _latestVersions[schemaInput.channelName][schemaInput.id] = 1;
        _isActiveSchemaIdByChannel[schemaInput.channelName][schemaInput.id] = true;

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