// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {ISchemaRegistry} from "./interfaces/ISchemaRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    SCHEMA_ADMIN_ROLE,
    MAX_STRING_LENGTH
    } from "./lib/Constants.sol";
import {Utils} from "./lib/Utils.sol";
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
     * Mapping for latest version by name and channel
     * @dev channelName => schemaId => version 
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) private _latestVersions;

    /**
     * Mapping to track active version per schema 
     * @dev channelName => schemaId => activeVersion
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) private _activeVersions;

    /**
     * Mapping for efficient list of existing versions
     * @dev channelName => schemaId => version[]
     */
    mapping(bytes32 => mapping(bytes32 => uint256[])) private _schemaVersionLists;

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

        _validateSchemaInput(schemaInput.id, schemaInput.dataHash, schemaInput.name, schemaInput.description);
        _validateLatestVersion(schemaInput.channelName, schemaInput.id);
        
        Schema memory newSchema = _createNewSchema(schemaInput);
        _storeNewSchema(newSchema);
        
        emit SchemaCreated(
            newSchema.id,
            newSchema.name,
            newSchema.version,
            newSchema.owner,
            newSchema.channelName,
            newSchema.createdAt
        );
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function setSchemaStatus(
        bytes32 schemaId, 
        uint256 version,
        bytes32 channelName,
        SchemaStatus newStatus
    )
        external 
        validChannelName(channelName)
        onlyChannelMember(channelName)
    {
        _setSchemaStatus(schemaId, version, channelName, newStatus);
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function deprecateSchema(bytes32 schemaId, bytes32 channelName)
        external 
        validChannelName(channelName)
        onlyChannelMember(channelName)
    {        
        uint256 activeVersion = _getAndValidateActiveVersion(channelName, schemaId);
        _setSchemaStatus(schemaId, activeVersion, channelName, SchemaStatus.DEPRECATED);
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function inactivateSchema(bytes32 schemaId, uint256 version, bytes32 channelName) 
        external 
        validChannelName(channelName)
        onlyChannelMember(channelName)
    {
        _setSchemaStatus(schemaId, version, channelName, SchemaStatus.INACTIVE);
    }
    
    /**
     * @inheritdoc ISchemaRegistry
     */
    function updateSchema(SchemaUpdateInput calldata schemaUpdateInput) 
        external 
        validChannelName(schemaUpdateInput.channelName)
        onlyChannelMember(schemaUpdateInput.channelName)
    {
        _validateSchemaUpdateInput(schemaUpdateInput.id, schemaUpdateInput.newDataHash, schemaUpdateInput.description);
        
        uint256 activeVersion = _getAndValidateActiveVersion(schemaUpdateInput.channelName, schemaUpdateInput.id);
        
        Schema storage currentActiveSchema  = _getExistingSchema(schemaUpdateInput.channelName, schemaUpdateInput.id, activeVersion);        
        _validateSchemaOwnership(currentActiveSchema);

        _validateSchemaStatus(currentActiveSchema);

        uint256 timestamp = Utils.timestamp();

        _deprecateSchema(currentActiveSchema);
        
        Schema memory newSchema = _updatedSchema(schemaUpdateInput, currentActiveSchema, timestamp);

        _storeUpdatedSchema(newSchema);
     
        emit SchemaUpdated(
            newSchema.id,        
            activeVersion,      // Previous version (deprecated)
            newSchema.version,  // New version (active)
            newSchema.owner,                      
            newSchema.channelName,    
            timestamp                         
        );
    }
    
    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getSchema(bytes32 channelName, bytes32 schemaId) 
        external 
        view 
        validChannelName(channelName)
        returns (Schema memory schema) 
    {
        _validateSchemaId(schemaId);
        
        uint256 activeVersion  = _getAndValidateActiveVersion(channelName, schemaId);
        
        return _schemasByChannelName[channelName][schemaId][activeVersion];
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getSchemaByVersion(bytes32 channelName, bytes32 schemaId, uint256 version) 
        external 
        view 
        validChannelName(channelName)
        returns (Schema memory schema) 
    {
        _validateSchemaId(schemaId);
        _validateVersion(version);

        return _getExistingSchema(channelName, schemaId, version);
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getActiveSchema(bytes32 channelName, bytes32 schemaId) 
        external 
        view 
        validChannelName(channelName)
        returns (Schema memory schema) 
    {
        
        _validateSchemaId(schemaId);
        
        uint256 activeVersion  = _getAndValidateActiveVersion(channelName, schemaId);
        
        return _schemasByChannelName[channelName][schemaId][activeVersion];
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getLatestSchema(bytes32 channelName, bytes32 schemaId) 
        external 
        view 
        validChannelName(channelName)
        returns (Schema memory schema) 
    {
        _validateSchemaId(schemaId);

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
        returns (uint256[] memory versions, Schema[] memory schemas) 
    {
        _validateSchemaId(schemaId);

        uint256 latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion == 0) {
            revert SchemaNotFoundInChannel(channelName, schemaId);
        }
        
        return _getSchemaVersions(channelName, schemaId);
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getSchemaInfo(bytes32 channelName, bytes32 schemaId)
        external
        view
        validChannelName(channelName)
        returns (
            uint256 latestVersion,
            uint256 activeVersion,      // 0 = nenhuma ativa
            bool hasActiveVersion,
            address owner,              // Owner da última versão
            uint256 totalVersions
        )
    {
        _validateSchemaId(schemaId);
        
        latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion == 0) {
            revert SchemaNotFoundInChannel(channelName, schemaId);
        }
        
        activeVersion = _activeVersions[channelName][schemaId];
        hasActiveVersion = activeVersion != 0;
        
        Schema storage latestSchema = _schemasByChannelName[channelName][schemaId][latestVersion];
        owner = latestSchema.owner;
        
        totalVersions = _schemaVersionLists[channelName][schemaId].length;
    }

    // =============================================================
    //                    INTERNAL VALIDATION
    // =============================================================
    function _validateSchemaInput(
        bytes32 id,
        bytes32 dataHash,
        string calldata name,
        string calldata description
    ) internal pure {
        if (id == bytes32(0)) revert InvalidSchemaId();
        if (dataHash == bytes32(0)) revert InvalidDataHash();
        if (bytes(name).length == 0) revert InvalidSchemaName(); 
        if (bytes(description).length > MAX_STRING_LENGTH) revert DescriptionTooLong();
    }

    function _validateSchemaUpdateInput(
        bytes32 id,
        bytes32 dataHash,
        string calldata description
    ) internal pure {
        if (id == bytes32(0)) revert InvalidSchemaId();
        if (dataHash == bytes32(0)) revert InvalidDataHash();
        if (bytes(description).length > MAX_STRING_LENGTH) revert DescriptionTooLong();
    }

    function _validateSchemaId(bytes32 schemaId) internal pure {
        if (schemaId == bytes32(0)) revert InvalidSchemaId();
    }

    function _validateVersion(uint256 version) internal pure {
        if (version == 0) revert InvalidVersion();
    }

    function _getAndValidateActiveVersion(bytes32 channelName, bytes32 schemaId) internal view returns (uint256) {
        uint256 activeVersion = _activeVersions[channelName][schemaId];
        if (activeVersion == 0) revert NoActiveSchemaVersion (channelName, schemaId);
        return activeVersion;
    }

    function _validateLatestVersion(bytes32 channelName, bytes32 schemaId) internal view {
        uint256 latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion != 0) revert SchemaAlreadyExistsCannotRecreate(channelName, schemaId);
    }

    function _validateSchemaOwnership(Schema storage schema) internal view {
        if (schema.owner != _msgSender()) revert NotSchemaOwner(schema.channelName, schema.id, _msgSender());
    }

    function _validateSchemaCanBeInactivated(Schema storage schema) internal view {
        if (schema.status == SchemaStatus.INACTIVE) revert SchemaAlreadyInactive(schema.channelName, schema.id, schema.version);
    }

    function _validateSchemaStatus(Schema storage schema) internal view {
        if (schema.status != SchemaStatus.ACTIVE) revert SchemaNotActive(schema.channelName, schema.id, schema.status);
    }

    // =============================================================
    //                    INTERNAL OPERATIONS
    // =============================================================
    function _getExistingSchema(bytes32 channelName, bytes32 schemaId, uint256 version) 
        internal 
        view 
        returns (Schema storage schema) 
    {
        if (!_schemaExistsByChannelName[channelName][schemaId][version]) {
            revert SchemaVersionNotFoundInChannel(channelName, schemaId, version);
        }
        return _schemasByChannelName[channelName][schemaId][version];
    }

    function _createNewSchema(SchemaInput calldata input) internal view returns (Schema memory) {
        return Schema({
            id: input.id,
            name: input.name,
            version: 1,
            dataHash: input.dataHash,
            owner: _msgSender(),
            channelName: input.channelName,
            status: SchemaStatus.ACTIVE,
            createdAt: Utils.timestamp(),
            updatedAt: Utils.timestamp(),
            description: input.description
        });
    }

    function _updatedSchema(
        SchemaUpdateInput calldata input, 
        Schema storage currentSchema,
        uint256 timestamp
    ) internal view returns (Schema memory) {
        return Schema({
            id: input.id,
            name: currentSchema.name,
            version: currentSchema.version + 1,
            dataHash: input.newDataHash,
            owner: _msgSender(),
            channelName: input.channelName,
            status: SchemaStatus.ACTIVE,
            createdAt: timestamp,
            updatedAt: timestamp,
            description: input.description
        });
    }

    function _storeNewSchema(Schema memory schema) internal {
        bytes32 channelName = schema.channelName;
        bytes32 schemaId = schema.id;
        uint256 version = schema.version;
        
        _schemasByChannelName[channelName][schemaId][version] = schema;
        _schemaExistsByChannelName[channelName][schemaId][version] = true;
        _latestVersions[channelName][schemaId] = version;
        _activeVersions[channelName][schemaId] = version;   

        _schemaVersionLists[schema.channelName][schema.id].push(schema.version);     
    }

    function _storeUpdatedSchema(Schema memory newSchema) internal {
        bytes32 channelName = newSchema.channelName;
        bytes32 schemaId = newSchema.id;
        uint256 newVersion = newSchema.version;
        
        _schemasByChannelName[channelName][schemaId][newVersion] = newSchema;
        _schemaExistsByChannelName[channelName][schemaId][newVersion] = true;
        _latestVersions[channelName][schemaId] = newVersion;
        _activeVersions[channelName][schemaId] = newVersion;

        _schemaVersionLists[channelName][schemaId].push(newVersion);
    }

    function _inactivateSchemaVersion(Schema storage schema) internal {
        schema.status = SchemaStatus.INACTIVE;
        schema.updatedAt = Utils.timestamp();
    }

    function _deprecateSchema(Schema storage schema) internal {
        schema.status = SchemaStatus.DEPRECATED;
        schema.updatedAt = Utils.timestamp();
    }

    function _clearActiveVersion(bytes32 channelName, bytes32 schemaId) internal {
        _activeVersions[channelName][schemaId] = 0;
    }

    function _setSchemaStatus(
        bytes32 schemaId, 
        uint256 version,
        bytes32 channelName,
        SchemaStatus newStatus) internal {

        _validateSchemaId(schemaId);
        _validateVersion(version);

        Schema storage schema = _getExistingSchema(channelName, schemaId, version);
        _validateSchemaOwnership(schema);

        SchemaStatus currentStatus = schema.status;

        _validateStatusTransition(currentStatus, newStatus);

        schema.status = newStatus;
        schema.updatedAt = Utils.timestamp();

        // Atualizar active version se necessário
        uint256 currentActiveVersion = _activeVersions[channelName][schemaId];
        if (currentActiveVersion == version && newStatus != SchemaStatus.ACTIVE) {
            _activeVersions[channelName][schemaId] = 0; // Clear active
        }

        emit SchemaStatusChanged(
            schemaId, 
            version, 
            channelName, 
            currentStatus, 
            newStatus, 
            _msgSender(), 
            Utils.timestamp()
        );
    }

    function _validateStatusTransition(SchemaStatus current, SchemaStatus newStatus) internal pure {
        
        // INACTIVE is final - cannot go anywhere
        if (current == SchemaStatus.INACTIVE) {
            revert InvalidStatusTransition(current, newStatus);
        }
        
        // DEPRECATED cannot go back to ACTIVE
        if (current == SchemaStatus.DEPRECATED && newStatus == SchemaStatus.ACTIVE) {
            revert InvalidStatusTransition(current, newStatus);
        }
    }

    // =============================================================
    //                    ARRAY BUILDERS
    // =============================================================

    function _getSchemaVersions(bytes32 channelName, bytes32 schemaId)
        internal
        view
        returns (uint256[] memory versions, Schema[] memory schemas)
    {
        versions = _schemaVersionLists[channelName][schemaId];
        uint256 length = versions.length;
        
        schemas = new Schema[](length);
        for (uint256 i = 0; i < length;) {
            uint256 version = versions[i];
            schemas[i] = _schemasByChannelName[channelName][schemaId][version];
            unchecked { ++i; }
        }
    }

    // =============================================================
    //                    IMPLEMENTATION REQUIREMENTS
    // =============================================================

    /**
     * Set the address discovery contract
     * @param discovery Address of the discovery contract
     */
    function setAddressDiscovery(address discovery) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setAddressDiscovery(discovery);
    }

    /**
     * Get the address discovery contract
     * @return discovery Address of the discovery contract
     */
    function getAddressDiscovery() external view returns (address) {
        return address(_getAddressDiscovery());
    }
    
    /**
     * @inheritdoc BaseTraceContract
     */
    function getVersion() external pure override returns (string memory) {
        return "1.0.0";
    }   
}