# Solidity API

## ISchemaRegistry

_Interface for managing data schemas in the trace system_

### SchemaStatus

```solidity
enum SchemaStatus {
  ACTIVE,
  DEPRECATED,
  INACTIVE
}
```

### SchemaInput

```solidity
struct SchemaInput {
  bytes32 id;
  string name;
  bytes32 dataHash;
  bytes32 channelName;
  string description;
}
```

### SchemaUpdateInput

```solidity
struct SchemaUpdateInput {
  bytes32 id;
  bytes32 newDataHash;
  bytes32 channelName;
  string description;
}
```

### Schema

```solidity
struct Schema {
  bytes32 id;
  string name;
  uint256 version;
  bytes32 dataHash;
  address owner;
  bytes32 channelName;
  enum ISchemaRegistry.SchemaStatus status;
  uint256 createdAt;
  uint256 updatedAt;
  string description;
}
```

### SchemaCreated

```solidity
event SchemaCreated(bytes32 schemaId, string name, uint256 version, address owner, bytes32 channelName, uint256 timestamp)
```

### SchemaDeprecated

```solidity
event SchemaDeprecated(bytes32 schemaId, uint256 version, address owner, bytes32 channelName, uint256 timestamp)
```

### SchemaInactivated

```solidity
event SchemaInactivated(bytes32 schemaId, uint256 version, enum ISchemaRegistry.SchemaStatus status, address owner, bytes32 channelName, uint256 timestamp)
```

### SchemaUpdated

```solidity
event SchemaUpdated(bytes32 schemaId, uint256 previousVersion, uint256 newVersion, address owner, bytes32 channelName, uint256 timestamp)
```

### InvalidSchemaId

```solidity
error InvalidSchemaId()
```

### InvalidDataHash

```solidity
error InvalidDataHash()
```

### InvalidSchemaName

```solidity
error InvalidSchemaName()
```

### DescriptionTooLong

```solidity
error DescriptionTooLong()
```

### InvalidVersion

```solidity
error InvalidVersion()
```

### SchemaNotFoundInChannel

```solidity
error SchemaNotFoundInChannel(bytes32 channelName, bytes32 schemaId)
```

### SchemaVersionNotFoundInChannel

```solidity
error SchemaVersionNotFoundInChannel(bytes32 channelName, bytes32 schemaId, uint256 version)
```

### NotSchemaOwner

```solidity
error NotSchemaOwner(bytes32 channelName, bytes32 schemaId, address owner)
```

### SchemaNotActive

```solidity
error SchemaNotActive(bytes32 channelName, bytes32 schemaId, enum ISchemaRegistry.SchemaStatus status)
```

### SchemaAlreadyInactive

```solidity
error SchemaAlreadyInactive(bytes32 channelName, bytes32 schemaId, uint256 version)
```

### SchemaHasNoActiveVersion

```solidity
error SchemaHasNoActiveVersion(bytes32 channelName, bytes32 schemaId)
```

### NoActiveSchemaVersion

```solidity
error NoActiveSchemaVersion(bytes32 channelName, bytes32 schemaId)
```

### SchemaAlreadyExistsCannotRecreate

```solidity
error SchemaAlreadyExistsCannotRecreate(bytes32 channelName, bytes32 schemaId)
```

### SchemaNotDeprecated

```solidity
error SchemaNotDeprecated(bytes32 channelName, bytes32 schemaId, uint256 version)
```

### createSchema

```solidity
function createSchema(struct ISchemaRegistry.SchemaInput schema) external
```

Creates a new schema

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| schema | struct ISchemaRegistry.SchemaInput | Schema data to create |

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
function updateSchema(struct ISchemaRegistry.SchemaUpdateInput schema) external
```

Updates a schema

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| schema | struct ISchemaRegistry.SchemaUpdateInput | Schema data to update |

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

