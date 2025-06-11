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
  bytes32 schemaId;
  string name;
  bytes32 newDataHash;
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

### SchemaAlreadyExistsInChannel

```solidity
error SchemaAlreadyExistsInChannel(bytes32 channelName, bytes32 schemaId)
```

### SchemaHasNoVersions

```solidity
error SchemaHasNoVersions(bytes32 schemaId, bytes32 channelName)
```

### InvalidSchemaId

```solidity
error InvalidSchemaId()
```

### InvalidSchemaName

```solidity
error InvalidSchemaName()
```

### InvalidDataHash

```solidity
error InvalidDataHash()
```

### DescriptionTooLong

```solidity
error DescriptionTooLong()
```

### SchemaAlreadyExists

```solidity
error SchemaAlreadyExists(bytes32 schemaId)
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

