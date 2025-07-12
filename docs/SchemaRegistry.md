# Solidity API

## SchemaRegistry

Contract for managing data schemas in the trace system

_Inherits from BaseTraceContract for common functionality_

### constructor

```solidity
constructor(address addressDiscovery_) public
```

Constructor for SchemaRegistry

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressDiscovery_ | address | Address of the AddressDiscovery contract |

### createSchema

```solidity
function createSchema(struct ISchemaRegistry.SchemaInput schemaInput) external
```

Creates a new schema

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| schemaInput | struct ISchemaRegistry.SchemaInput |  |

### deprecateSchema

```solidity
function deprecateSchema(bytes32 schemaId, bytes32 channelName) external
```

Changes the status of a schema to deprecated

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| schemaId | bytes32 | Schema identifier |
| channelName | bytes32 | The name of the channel to which the schema belongs |

### inactivateSchema

```solidity
function inactivateSchema(bytes32 schemaId, uint256 version, bytes32 channelName) external
```

Changes the status of a schema to inactive

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| schemaId | bytes32 | Schema identifier |
| version | uint256 | Schema version |
| channelName | bytes32 | The name of the channel to which the schema belongs |

### updateSchema

```solidity
function updateSchema(struct ISchemaRegistry.SchemaUpdateInput schemaUpdateInput) external
```

Updates a schema

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| schemaUpdateInput | struct ISchemaRegistry.SchemaUpdateInput |  |

### getSchemaByVersion

```solidity
function getSchemaByVersion(bytes32 channelName, bytes32 schemaId, uint256 version) external view returns (struct ISchemaRegistry.Schema schema)
```

Get a specific schema by ID and version

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The channel name |
| schemaId | bytes32 | The schema ID |
| version | uint256 | The schema version |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| schema | struct ISchemaRegistry.Schema | The schema data |

### getActiveSchema

```solidity
function getActiveSchema(bytes32 channelName, bytes32 schemaId) external view returns (struct ISchemaRegistry.Schema schema)
```

Get the active version of a schema

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The channel name |
| schemaId | bytes32 | The schema ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| schema | struct ISchemaRegistry.Schema | The active schema data |

### getLatestSchema

```solidity
function getLatestSchema(bytes32 channelName, bytes32 schemaId) external view returns (struct ISchemaRegistry.Schema schema)
```

Get the latest version of a schema (may not be active)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The channel name |
| schemaId | bytes32 | The schema ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| schema | struct ISchemaRegistry.Schema | The latest schema data |

### getSchemaVersions

```solidity
function getSchemaVersions(bytes32 channelName, bytes32 schemaId) external view returns (uint256[] versions, struct ISchemaRegistry.Schema[] schemas)
```

Get all versions of a specific schema

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The channel name |
| schemaId | bytes32 | The schema ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| versions | uint256[] | Array of version numbers |
| schemas | struct ISchemaRegistry.Schema[] | Array of schema data |

### getSchemaInfo

```solidity
function getSchemaInfo(bytes32 channelName, bytes32 schemaId) external view returns (uint256 latestVersion, uint256 activeVersion, bool hasActiveVersion, address owner, uint256 totalVersions)
```

Get information about a schema

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The channel name |
| schemaId | bytes32 | The schema ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| latestVersion | uint256 | The latest schema version |
| activeVersion | uint256 | The active schema version |
| hasActiveVersion | bool | True if the schema has an active version |
| owner | address | The schema owner |
| totalVersions | uint256 | The total number of versions |

### addSchemaAdmin

```solidity
function addSchemaAdmin(address newSchemaAdmin) external
```

Function to add a new schema admin.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newSchemaAdmin | address | Address of the new schema admin |

### removeSchemaAdmin

```solidity
function removeSchemaAdmin(address addressSchemaAdmin) external
```

Function to remove a schema admin.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressSchemaAdmin | address | Address of schema admin to remove |

### _validateSchemaInput

```solidity
function _validateSchemaInput(bytes32 id, bytes32 dataHash, string name, string description) internal pure
```

### _validateSchemaUpdateInput

```solidity
function _validateSchemaUpdateInput(bytes32 id, bytes32 dataHash, string description) internal pure
```

### _validateSchemaId

```solidity
function _validateSchemaId(bytes32 schemaId) internal pure
```

### _validateVersion

```solidity
function _validateVersion(uint256 version) internal pure
```

### _getAndValidateActiveVersion

```solidity
function _getAndValidateActiveVersion(bytes32 channelName, bytes32 schemaId) internal view returns (uint256)
```

### _validateLatestVersion

```solidity
function _validateLatestVersion(bytes32 channelName, bytes32 schemaId) internal view
```

### _validateSchemaOwnership

```solidity
function _validateSchemaOwnership(struct ISchemaRegistry.Schema schema) internal view
```

### _validateSchemaCanBeInactivated

```solidity
function _validateSchemaCanBeInactivated(struct ISchemaRegistry.Schema schema) internal view
```

### _validateSchemaStatus

```solidity
function _validateSchemaStatus(struct ISchemaRegistry.Schema schema) internal view
```

### _getExistingSchema

```solidity
function _getExistingSchema(bytes32 channelName, bytes32 schemaId, uint256 version) internal view returns (struct ISchemaRegistry.Schema schema)
```

### _createNewSchema

```solidity
function _createNewSchema(struct ISchemaRegistry.SchemaInput input) internal view returns (struct ISchemaRegistry.Schema)
```

### _updatedSchema

```solidity
function _updatedSchema(struct ISchemaRegistry.SchemaUpdateInput input, struct ISchemaRegistry.Schema currentSchema, uint256 timestamp) internal view returns (struct ISchemaRegistry.Schema)
```

### _storeNewSchema

```solidity
function _storeNewSchema(struct ISchemaRegistry.Schema schema) internal
```

### _storeUpdatedSchema

```solidity
function _storeUpdatedSchema(struct ISchemaRegistry.Schema newSchema) internal
```

### _inactivateSchemaVersion

```solidity
function _inactivateSchemaVersion(struct ISchemaRegistry.Schema schema) internal
```

### _deprecateSchema

```solidity
function _deprecateSchema(struct ISchemaRegistry.Schema schema) internal
```

### _clearActiveVersion

```solidity
function _clearActiveVersion(bytes32 channelName, bytes32 schemaId) internal
```

### _getTimeStamp

```solidity
function _getTimeStamp() internal view returns (uint256)
```

### _updateCounters

```solidity
function _updateCounters(bytes32 channelName, address owner) internal
```

### _buildVersionArrays

```solidity
function _buildVersionArrays(bytes32 channelName, bytes32 schemaId, uint256 latestVersion) internal view returns (uint256[] versions, struct ISchemaRegistry.Schema[] schemas)
```

### _countExistingVersions

```solidity
function _countExistingVersions(bytes32 channelName, bytes32 schemaId, uint256 latestVersion) internal view returns (uint256 count)
```

### setAddressDiscovery

```solidity
function setAddressDiscovery(address discovery) external
```

Set the address discovery contract

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| discovery | address | Address of the discovery contract |

### getAddressDiscovery

```solidity
function getAddressDiscovery() external view returns (address)
```

Get the address discovery contract

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | discovery Address of the discovery contract |

### getVersion

```solidity
function getVersion() external pure returns (string)
```

Get the version of the contract

_Should be implemented by inheriting contracts_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | Version string |

