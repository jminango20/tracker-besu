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

### getSchema

```solidity
function getSchema(bytes32 channelName, bytes32 schemaId, uint256 version) external view returns (struct ISchemaRegistry.Schema schema)
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

