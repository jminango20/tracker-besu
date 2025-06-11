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

