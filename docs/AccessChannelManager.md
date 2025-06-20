# Solidity API

## AccessChannelManager

Contract for managing scalable access channels

### Channel

```solidity
struct Channel {
  bool exists;
  bool isActive;
  address creator;
  uint256 memberCount;
  uint256 createdAt;
}
```

### validChannelAndActive

```solidity
modifier validChannelAndActive(bytes32 channelName)
```

Validates that the channel exists and is active.

### validChannel

```solidity
modifier validChannel(bytes32 channelName)
```

Validates that the channel exists.

### validAddress

```solidity
modifier validAddress(address addr)
```

Validates that the address is not zero.

### validBatchSize

```solidity
modifier validBatchSize(uint256 batchSize)
```

Validates that the batch size is valid.

### constructor

```solidity
constructor() public
```

### createChannel

```solidity
function createChannel(bytes32 channelName) external
```

Function to create a new channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel to create |

### activateChannel

```solidity
function activateChannel(bytes32 channelName) external
```

Function to activate a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel to activate |

### desactivateChannel

```solidity
function desactivateChannel(bytes32 channelName) external
```

Function to desactivate a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel to desactivate |

### addChannelMember

```solidity
function addChannelMember(bytes32 channelName, address member) external
```

Function to add a member to a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |
| member | address | The address of the member to add |

### addChannelMembers

```solidity
function addChannelMembers(bytes32 channelName, address[] members) external
```

Function to add multiple members to a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |
| members | address[] | Array of addresses of the members to add |

### removeChannelMember

```solidity
function removeChannelMember(bytes32 channelName, address member) external
```

Function to remove a member from a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |
| member | address | The address of the member to remove |

### removeChannelMembers

```solidity
function removeChannelMembers(bytes32 channelName, address[] members) external
```

Function to remove multiple members from a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |
| members | address[] | Array of addresses of the members to remove |

### isChannelMember

```solidity
function isChannelMember(bytes32 channelName, address member) external view returns (bool)
```

Function to check if a member is a part of a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |
| member | address | The address of the member to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the member is a part of the channel, false otherwise |

### getChannelMembersPaginated

```solidity
function getChannelMembersPaginated(bytes32 channelName, uint256 page, uint256 pageSize) external view returns (address[] members, uint256 totalMembers, uint256 totalPages, bool hasNextPage)
```

Function to get the members of a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |
| page | uint256 | Page number (1-indexed) |
| pageSize | uint256 | Number of members per page |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| members | address[] | Array of addresses of the members in the channel |
| totalMembers | uint256 | Total number of members in the channel |
| totalPages | uint256 | Total number of pages |
| hasNextPage | bool | Whether there is a next page |

### getChannelInfo

```solidity
function getChannelInfo(bytes32 channelName) external view returns (bool exists, bool isActive, address creator, uint256 memberCount, uint256 createdAt)
```

Function to get information about a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| exists | bool | Whether the channel exists |
| isActive | bool | Whether the channel is active |
| creator | address | Address of the creator of the channel |
| memberCount | uint256 | Number of members in the channel |
| createdAt | uint256 | Block timestamp when the channel was created |

### getChannelCount

```solidity
function getChannelCount() external view returns (uint256)
```

Function to get the total number of channels.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | totalChannels Total number of channels |

### getAllChannelsPaginated

```solidity
function getAllChannelsPaginated(uint256 page, uint256 pageSize) external view returns (bytes32[] channels, uint256 totalChannels, uint256 totalPages, bool hasNextPage)
```

Function to get the total number of channels.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| page | uint256 | Page number (1-indexed) |
| pageSize | uint256 | Number of channels per page |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| channels | bytes32[] | Array of names of the channels |
| totalChannels | uint256 | Total number of channels |
| totalPages | uint256 | Total number of pages |
| hasNextPage | bool | Whether there is a next page |

### getChannelMemberCount

```solidity
function getChannelMemberCount(bytes32 channelName) external view returns (uint256)
```

Function to get the total number of members in a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | memberCount Number of members in the channel |

### areChannelMembers

```solidity
function areChannelMembers(bytes32 channelName, address[] members) external view returns (bool[] results)
```

Function to check if multiple members are part of a channel.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channelName | bytes32 | The name of the channel |
| members | address[] | Array of addresses of the members to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| results | bool[] | Array of booleans indicating if each member is a part of the channel |

### addChannelAdmin

```solidity
function addChannelAdmin(address newChannelAdmin) external
```

Function to add a new channel admin.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newChannelAdmin | address | Address of the new channel admin |

### removeChannelAdmin

```solidity
function removeChannelAdmin(address addressChannelAdmin) external
```

Function to remove a channel admin.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressChannelAdmin | address | Address of channel admin to remove |

### addChannelAuthority

```solidity
function addChannelAuthority(address newChannelAuthority) external
```

Function to add a new channel authority.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newChannelAuthority | address | Address of the new channel authority |

### removeChannelAuthority

```solidity
function removeChannelAuthority(address addressChannelAuthority) external
```

Function to remove a channel authority.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressChannelAuthority | address | Address of channel authority to remove |

