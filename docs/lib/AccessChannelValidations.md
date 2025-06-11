# Solidity API

## AccessChannelValidations

_Centralized validation library for channel operations_

### ChannelAlreadyExists

```solidity
error ChannelAlreadyExists(bytes32 channelName)
```

### ChannelDoesNotExist

```solidity
error ChannelDoesNotExist(bytes32 channelName)
```

### ChannelAlreadyActive

```solidity
error ChannelAlreadyActive(bytes32 channelName)
```

### ChannelAlreadyDeactivated

```solidity
error ChannelAlreadyDeactivated(bytes32 channelName)
```

### ChannelNotActive

```solidity
error ChannelNotActive(bytes32 channelName)
```

### CreatorCannotBeMember

```solidity
error CreatorCannotBeMember(bytes32 channelName, address member)
```

### MemberAlreadyInChannel

```solidity
error MemberAlreadyInChannel(bytes32 channelName, address member)
```

### InvalidMemberAddress

```solidity
error InvalidMemberAddress(address member)
```

### MemberNotInChannel

```solidity
error MemberNotInChannel(bytes32 channelName, address member)
```

### ChannelMemberLimitExceeded

```solidity
error ChannelMemberLimitExceeded(bytes32 channelName, uint256 limit)
```

### EmptyMemberArray

```solidity
error EmptyMemberArray()
```

### BatchSizeExceeded

```solidity
error BatchSizeExceeded(uint256 provided, uint256 maximum)
```

### InvalidPageNumber

```solidity
error InvalidPageNumber(uint256 page)
```

### InvalidPageSize

```solidity
error InvalidPageSize(uint256 pageSize)
```

### validateAddress

```solidity
function validateAddress(address addr) internal pure
```

_Validates that an address is not zero_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | Address to validate |

### requireChannelExists

```solidity
function requireChannelExists(bool exists, bytes32 channelName) internal pure
```

_Validates that a channel exists_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| exists | bool | Channel existence flag |
| channelName | bytes32 | Channel name for error reporting |

### requireChannelActive

```solidity
function requireChannelActive(bool isActive, bytes32 channelName) internal pure
```

_Validates that a channel is active_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| isActive | bool | Channel active flag |
| channelName | bytes32 | Channel name for error reporting |

### requireChannelNotExists

```solidity
function requireChannelNotExists(bool exists, bytes32 channelName) internal pure
```

_Validates channel doesn't already exist_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| exists | bool | Channel existence flag |
| channelName | bytes32 | Channel name for error reporting |

### requireChannelNotActive

```solidity
function requireChannelNotActive(bool isActive, bytes32 channelName) internal pure
```

_Validates channel is already active_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| isActive | bool | Channel active flag |
| channelName | bytes32 | Channel name for error reporting |

### requireChannelNotDeactivated

```solidity
function requireChannelNotDeactivated(bool isActive, bytes32 channelName) internal pure
```

_Validates channel is already deactivated_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| isActive | bool | Channel active flag |
| channelName | bytes32 | Channel name for error reporting |

### requireMemberNotInChannel

```solidity
function requireMemberNotInChannel(bool isMember, bytes32 channelName, address member) internal pure
```

_Validates member is not already in channel_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| isMember | bool | Member status flag |
| channelName | bytes32 | Channel name for error reporting |
| member | address | Member address for error reporting |

### requireMemberInChannel

```solidity
function requireMemberInChannel(bool isMember, bytes32 channelName, address member) internal pure
```

_Validates member is in channel_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| isMember | bool | Member status flag |
| channelName | bytes32 | Channel name for error reporting |
| member | address | Member address for error reporting |

### requireCreatorNotMember

```solidity
function requireCreatorNotMember(address creator, address member, bytes32 channelName) internal pure
```

_Validates creator cannot be added as member_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| creator | address | Channel creator address |
| member | address | Member address to check |
| channelName | bytes32 | Channel name for error reporting |

### requireMemberLimitNotExceeded

```solidity
function requireMemberLimitNotExceeded(uint256 currentCount, uint256 limit, bytes32 channelName) internal pure
```

_Validates member limit not exceeded_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| currentCount | uint256 | Current member count |
| limit | uint256 | Maximum allowed members |
| channelName | bytes32 | Channel name for error reporting |

### requireNonEmptyArray

```solidity
function requireNonEmptyArray(uint256 arrayLength) internal pure
```

_Validates array is not empty_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| arrayLength | uint256 | Length of array to check |

### requireBatchSizeValid

```solidity
function requireBatchSizeValid(uint256 batchSize, uint256 maxBatchSize) internal pure
```

_Validates batch size doesn't exceed maximum_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| batchSize | uint256 | Size of batch operation |
| maxBatchSize | uint256 | Maximum allowed batch size |

