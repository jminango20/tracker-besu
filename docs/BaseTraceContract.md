# Solidity API

## BaseTraceContract

Abstract contract providing common functionality for all trace contracts

_Base contract that all trace system contracts should inherit from_

### InvalidAddress

```solidity
error InvalidAddress(address addr)
```

### InvalidChannelName

```solidity
error InvalidChannelName(bytes32 channelName)
```

### UnauthorizedChannelAccess

```solidity
error UnauthorizedChannelAccess(bytes32 channelName, address caller)
```

### InvalidPageNumber

```solidity
error InvalidPageNumber(uint256 page)
```

### InvalidPageSize

```solidity
error InvalidPageSize(uint256 pageSize)
```

### constructor

```solidity
constructor(address addressDiscovery) internal
```

Constructor for BaseTraceContract

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressDiscovery | address | Address of the AddressDiscovery contract |

### onlyChannelMember

```solidity
modifier onlyChannelMember(bytes32 channelName)
```

Ensures caller is a member of the specified channel

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel to check membership for |

### validChannelName

```solidity
modifier validChannelName(bytes32 channelName)
```

Validates that channel Name is not empty

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The channel Name to validate |

### validPagination

```solidity
modifier validPagination(uint256 page, uint256 pageSize)
```

Validates pagination parameters

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| page | uint256 | Page number (1-indexed) |
| pageSize | uint256 | Number of items per page |

### validAddress

```solidity
modifier validAddress(address addr)
```

Validates that address is not zero

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | Address to validate |

### isChannelMember

```solidity
function isChannelMember(bytes32 channelName, address account) external view returns (bool)
```

Checks if an account is a member of a channel

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | Name of the channel to check |
| account | address | Account to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the account is a member |

### _setAddressDiscovery

```solidity
function _setAddressDiscovery(address addressDiscoveryAdd) internal
```

Sets the address discovery instance

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressDiscoveryAdd | address | Address of the address discovery contract |

### _getAddressDiscovery

```solidity
function _getAddressDiscovery() internal view returns (contract IAddressDiscovery)
```

Gets the address discovery instance

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAddressDiscovery | The address discovery contract |

### _getAccessChannelManager

```solidity
function _getAccessChannelManager() internal view returns (contract IAccessChannelManager)
```

Gets the access channel manager instance

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAccessChannelManager | The access channel manager contract |

### _requireChannelMember

```solidity
function _requireChannelMember(bytes32 channelName, address member) internal view
```

Requires that caller is a member of the specified channel

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel to check membership for |
| member | address | Account to check |

### _calculatePagination

```solidity
function _calculatePagination(uint256 totalItems, uint256 page, uint256 pageSize) internal pure returns (uint256 startIndex, uint256 endIndex, uint256 totalPages, bool hasNextPage)
```

Calculates pagination values

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalItems | uint256 | Total number of items |
| page | uint256 | Page number (1-indexed) |
| pageSize | uint256 | Items per page |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| startIndex | uint256 | Starting index for the page |
| endIndex | uint256 | Ending index for the page |
| totalPages | uint256 | Total number of pages |
| hasNextPage | bool | Whether there's a next page |

### _generateId

```solidity
function _generateId(bytes32 param1, bytes32 param2, bytes32 param3) internal pure returns (bytes32)
```

Generates a unique ID based on multiple parameters

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| param1 | bytes32 | First parameter |
| param2 | bytes32 | Second parameter |
| param3 | bytes32 | Third parameter |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | Unique bytes32 ID |

### getVersion

```solidity
function getVersion() external pure virtual returns (string)
```

Get the version of the contract

_Should be implemented by inheriting contracts_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | Version string |

