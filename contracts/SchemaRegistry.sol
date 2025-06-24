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

        _validateSchemaInput(schemaInput.id, schemaInput.dataHash, schemaInput.name, schemaInput.description);
        _validateSchemaUniqueness(schemaInput.channelName, schemaInput.id, schemaInput.version);
        
        Schema memory newSchema = _createNewSchema(schemaInput);
        _storeNewSchema(newSchema);
        _updateCounters(schemaInput.channelName, _msgSender(), true);
        
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
        _validateSchemaId(schemaId);

        (uint256 latestVersion, uint256 activeVersion) = _getSchemaVersions(channelName, schemaId);

        _getAndValidateActiveSchema(channelName, schemaId, activeVersion);
        
        uint256 deprecatedCount = _deprecateAllActiveVersions(channelName, schemaId, latestVersion);
        _clearActiveVersion(channelName, schemaId);
        _decrementActiveSchemaCount(channelName);
        
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
        _validateSchemaId(schemaId);
        _validateVersion(version);

        Schema storage schema = _getExistingSchema(channelName, schemaId, version);
        _validateSchemaOwnership(schemaId, schema.owner);
        _validateSchemaCanBeInactivated(schemaId, version, schema.status);
        
        SchemaStatus previousStatus = schema.status;
        _inactivateSchemaVersion(schema, channelName, schemaId, version);

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
        _validateSchemaUpdateInput(schemaUpdateInput.id, schemaUpdateInput.newDataHash, schemaUpdateInput.description);
        _validateVersion(schemaUpdateInput.newVersion);
        
        (uint256 latestVersion, uint256 activeVersion) = _getSchemaVersions(schemaUpdateInput.channelName, schemaUpdateInput.id);
        Schema storage currentSchema = _getAndValidateActiveSchema(schemaUpdateInput.channelName, schemaUpdateInput.id, activeVersion);
        
        _validateVersionSequence(schemaUpdateInput.id, latestVersion, schemaUpdateInput.newVersion);
        _validateNewVersionUniqueness(schemaUpdateInput.channelName, schemaUpdateInput.id, schemaUpdateInput.newVersion);
        
        uint256 timestamp = block.timestamp;
        _deprecateCurrentSchema(currentSchema, timestamp);
        
        Schema memory newSchema = _createUpdatedSchema(schemaUpdateInput, currentSchema, timestamp);
        _storeUpdatedSchema(newSchema, schemaUpdateInput.channelName, activeVersion);
        _updateCountersForUpdate(schemaUpdateInput.channelName, _msgSender());

        emit SchemaUpdated(
            schemaUpdateInput.id,        
            activeVersion,                     // Previous version (deprecated)
            schemaUpdateInput.newVersion,     // New version (active)
            _msgSender(),                      
            schemaUpdateInput.channelName,    
            timestamp                         
        );
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getSchemaByVersion(bytes32 channelName, bytes32 schemaId, uint256 version) 
        external 
        view 
        validChannelName(channelName)
        onlyChannelMember(channelName)
        returns (Schema memory schema) 
    {
        return _getExistingSchema(channelName, schemaId, version);
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
        
        return _buildVersionArrays(channelName, schemaId, latestVersion);
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getSchema(bytes32 channelName, bytes32 schemaId)
        external
        view 
        validChannelName(channelName)
        onlyChannelMember(channelName)
        returns (Schema memory schema) 
    {
        // Try to get active schema first
        uint256 activeVersion = _activeVersions[channelName][schemaId];
        if (activeVersion != 0) {
            return _schemasByChannelName[channelName][schemaId][activeVersion];
        }
        
        // If no active version, get latest
        uint256 latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion == 0) {
            revert SchemaNotFoundInChannel(channelName, schemaId);
        }
        
        return _schemasByChannelName[channelName][schemaId][latestVersion];
    }

    /**
     * @inheritdoc ISchemaRegistry
     */
    function getSchemasByStatus(
        bytes32 channelName, 
        bytes32 schemaId, 
        SchemaStatus status
    ) 
        external 
        view 
        validChannelName(channelName)
        onlyChannelMember(channelName)
        returns (Schema[] memory schemas) 
    {
        uint256 latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion == 0) {
            revert SchemaNotFoundInChannel(channelName, schemaId);
        }

        return _buildSchemasByStatus(channelName, schemaId, latestVersion, status);
    }

    // =============================================================
    //                    ACCESS CONTROL HELPERS
    // =============================================================

    /**
     * Function to add a new schema admin.
     * @param newSchemaAdmin Address of the new schema admin
     */
    function addSchemaAdmin(address newSchemaAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newSchemaAdmin == address(0)) revert InvalidAddress(newSchemaAdmin);
        _grantRole(SCHEMA_ADMIN_ROLE, newSchemaAdmin);
    }

    /**
     * Function to remove a schema admin.
     * @param addressSchemaAdmin Address of schema admin to remove
     */
    function removeSchemaAdmin(address addressSchemaAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (addressSchemaAdmin == address(0)) revert InvalidAddress(addressSchemaAdmin);
        _revokeRole(SCHEMA_ADMIN_ROLE, addressSchemaAdmin);
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

    function _validateSchemaUniqueness(bytes32 channelName, bytes32 schemaId, uint256 version) internal view {
        if (_schemaExistsByChannelName[channelName][schemaId][version]) {
            revert SchemaAlreadyExistsInChannel(channelName, schemaId, version);
        }
    }

    function _validateSchemaOwnership(bytes32 schemaId, address owner) internal view {
        if (owner != _msgSender()) {
            revert NotSchemaOwner(schemaId, _msgSender());
        }
    }

    function _validateSchemaCanBeInactivated(bytes32 schemaId, uint256 version, SchemaStatus status) internal pure {
        if (status == SchemaStatus.INACTIVE) {
            revert SchemaAlreadyInactive(schemaId, version);
        }
        if (status != SchemaStatus.ACTIVE && status != SchemaStatus.DEPRECATED) {
            revert SchemaNotActiveOrDeprecated(schemaId, status);
        }
    }

    function _validateVersionSequence(bytes32 schemaId, uint256 latestVersion, uint256 newVersion) internal pure {
        if (newVersion <= latestVersion) {
            revert InvalidNewVersion(schemaId, latestVersion, newVersion);
        }
    }
    
    function _validateNewVersionUniqueness(bytes32 channelName, bytes32 schemaId, uint256 newVersion) internal view {
        if (_schemaExistsByChannelName[channelName][schemaId][newVersion]) {
            revert SchemaVersionAlreadyExists(channelName, schemaId, newVersion);
        }
    }

    // =============================================================
    //                    INTERNAL OPERATIONS
    // =============================================================
    function _getSchemaVersions(bytes32 channelName, bytes32 schemaId) 
        internal 
        view 
        returns (uint256 latestVersion, uint256 activeVersion) 
    {
        latestVersion = _latestVersions[channelName][schemaId];
        if (latestVersion == 0) revert SchemaNotFoundInChannel(channelName, schemaId);
        
        activeVersion = _activeVersions[channelName][schemaId];
        if (activeVersion == 0) revert NoActiveSchemaVersion(schemaId);
    }

    function _getAndValidateActiveSchema(bytes32 channelName, bytes32 schemaId, uint256 activeVersion) 
        internal 
        view 
        returns (Schema storage schema) 
    {
        schema = _schemasByChannelName[channelName][schemaId][activeVersion];
        _validateSchemaOwnership(schemaId, schema.owner);
        
        if (schema.status != SchemaStatus.ACTIVE) {
            revert SchemaNotActive(schemaId, schema.status);
        }
    }

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
            version: input.version,
            dataHash: input.dataHash,
            owner: _msgSender(),
            channelName: input.channelName,
            status: SchemaStatus.ACTIVE,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            description: input.description
        });
    }

    function _createUpdatedSchema(
        SchemaUpdateInput calldata input, 
        Schema storage currentSchema, 
        uint256 timestamp
    ) internal view returns (Schema memory) {
        return Schema({
            id: input.id,
            name: currentSchema.name,
            version: input.newVersion,
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
        _isActiveSchemaIdByVersionAndChannel[channelName][schemaId][version] = true;
        _activeVersions[channelName][schemaId] = version;
        
        // Owner tracking
        uint256 ownerIndex = _ownerSchemaCount[_msgSender()][channelName];
        _schemasByOwner[_msgSender()][channelName][ownerIndex] = schemaId;
    }

    function _storeUpdatedSchema(Schema memory newSchema, bytes32 channelName, uint256 previousActiveVersion) internal {
        bytes32 schemaId = newSchema.id;
        uint256 newVersion = newSchema.version;
        
        _schemasByChannelName[channelName][schemaId][newVersion] = newSchema;
        _schemaExistsByChannelName[channelName][schemaId][newVersion] = true;
        _latestVersions[channelName][schemaId] = newVersion;
        _activeVersions[channelName][schemaId] = newVersion;
        
        _isActiveSchemaIdByVersionAndChannel[channelName][schemaId][newVersion] = true;
        _isActiveSchemaIdByVersionAndChannel[channelName][schemaId][previousActiveVersion] = false;
        
        // Owner tracking
        uint256 ownerIndex = _ownerSchemaCount[_msgSender()][channelName];
        _schemasByOwner[_msgSender()][channelName][ownerIndex] = schemaId;
    }

    function _deprecateAllActiveVersions(bytes32 channelName, bytes32 schemaId, uint256 latestVersion) 
        internal 
        returns (uint256 deprecatedCount) 
    {
        uint256 timestamp = block.timestamp;
        
        for (uint256 version = 1; version <= latestVersion;) {
            if (_schemaExistsByChannelName[channelName][schemaId][version]) {
                Schema storage schema = _schemasByChannelName[channelName][schemaId][version];
                
                if (schema.status == SchemaStatus.ACTIVE) {
                    schema.status = SchemaStatus.DEPRECATED;
                    schema.updatedAt = timestamp;
                    _isActiveSchemaIdByVersionAndChannel[channelName][schemaId][version] = false;
                    
                    unchecked {
                        ++deprecatedCount;
                    }
                }
            }
            
            unchecked {
                ++version;
            }
        }
    }

    function _inactivateSchemaVersion(Schema storage schema, bytes32 channelName, bytes32 schemaId, uint256 version) internal {
        schema.status = SchemaStatus.INACTIVE;
        schema.updatedAt = block.timestamp;
        
        if (_isActiveSchemaIdByVersionAndChannel[channelName][schemaId][version]) {
            _isActiveSchemaIdByVersionAndChannel[channelName][schemaId][version] = false;
        }
        
        if (_activeVersions[channelName][schemaId] == version) {
            _activeVersions[channelName][schemaId] = 0;
            _decrementActiveSchemaCount(channelName);
        }
    }

    function _deprecateCurrentSchema(Schema storage schema, uint256 timestamp) internal {
        schema.status = SchemaStatus.DEPRECATED;
        schema.updatedAt = timestamp;
    }

    function _clearActiveVersion(bytes32 channelName, bytes32 schemaId) internal {
        _activeVersions[channelName][schemaId] = 0;
    }

    // =============================================================
    //                    COUNTER MANAGEMENT
    // =============================================================
    function _updateCounters(bytes32 channelName, address owner, bool isNewSchema) internal {
        unchecked {
            _channelSchemaCount[channelName]++;
            _ownerSchemaCount[owner][channelName]++;
            if (isNewSchema) {
                _activeSchemaCount[channelName]++;
            }
        }
    }

    function _updateCountersForUpdate(bytes32 channelName, address owner) internal {
        unchecked {
            _channelSchemaCount[channelName]++;
            _ownerSchemaCount[owner][channelName]++;
            // Active count stays same (1 deprecated, 1 new active)
        }
    }

    function _decrementActiveSchemaCount(bytes32 channelName) internal {
        unchecked {
            _activeSchemaCount[channelName]--;
        }
    }

    // =============================================================
    //                    ARRAY BUILDERS
    // =============================================================

    function _buildVersionArrays(bytes32 channelName, bytes32 schemaId, uint256 latestVersion) 
        internal 
        view 
        returns (uint256[] memory versions, Schema[] memory schemas) 
    {
        uint256 existingCount = _countExistingVersions(channelName, schemaId, latestVersion);
        
        versions = new uint256[](existingCount);
        schemas = new Schema[](existingCount);
        
        uint256 index = 0;
        for (uint256 i = 1; i <= latestVersion;) {
            if (_schemaExistsByChannelName[channelName][schemaId][i]) {
                versions[index] = i;
                schemas[index] = _schemasByChannelName[channelName][schemaId][i];
                unchecked {
                    ++index;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    function _countExistingVersions(bytes32 channelName, bytes32 schemaId, uint256 latestVersion) 
        internal 
        view 
        returns (uint256 count) 
    {
        for (uint256 i = 1; i <= latestVersion;) {
            if (_schemaExistsByChannelName[channelName][schemaId][i]) {
                unchecked {
                    ++count;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    function _buildSchemasByStatus(
        bytes32 channelName, 
        bytes32 schemaId, 
        uint256 latestVersion, 
        SchemaStatus status
    ) internal view returns (Schema[] memory schemas) {
        uint256 matchingCount = _countSchemasByStatus(channelName, schemaId, latestVersion, status);
        
        schemas = new Schema[](matchingCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= latestVersion;) {
            if (_schemaExistsByChannelName[channelName][schemaId][i]) {
                Schema storage schema = _schemasByChannelName[channelName][schemaId][i];
                if (schema.status == status) {
                    schemas[index] = schema;
                    unchecked {
                        ++index;
                    }
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    function _countSchemasByStatus(
        bytes32 channelName, 
        bytes32 schemaId, 
        uint256 latestVersion, 
        SchemaStatus status
    ) internal view returns (uint256 count) {
        for (uint256 i = 1; i <= latestVersion;) {
            if (_schemaExistsByChannelName[channelName][schemaId][i]) {
                Schema storage schema = _schemasByChannelName[channelName][schemaId][i];
                if (schema.status == status) {
                    unchecked {
                        ++count;
                    }
                }
            }
            unchecked {
                ++i;
            }
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