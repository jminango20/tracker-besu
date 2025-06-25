# Solidity API

## IAddressDiscovery

_Interface to manage addresses of smart contracts and their updates_

### updateAddress

```solidity
function updateAddress(bytes32 smartContract, address newAddress) external
```

Function to register/update a new smart contract address.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| smartContract | bytes32 | Name of the smart contract using keccak256 |
| newAddress | address | Address of the smart contract |

### getContractAddress

```solidity
function getContractAddress(bytes32 smartContract) external view returns (address)
```

Function to get the address of a smart contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| smartContract | bytes32 | Name of the smart contract using keccak256 |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Address of the smart contract |

### isRegistered

```solidity
function isRegistered(bytes32 smartContract) external view returns (bool)
```

Function to check if a smart contract is registered.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| smartContract | bytes32 | Name of the smart contract using keccak256 |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the smart contract is registered, false otherwise |

### AddressUpdated

```solidity
event AddressUpdated(bytes32 smartContract, address oldAddress, address newAddress, address updatedBy)
```

Event emitted when a smart contract address is registered or updated.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| smartContract | bytes32 | Name of the smart contract |
| oldAddress | address | Old address of the smart contract |
| newAddress | address | New address of the smart contract |
| updatedBy | address | Address of the user who updated the smart contract address |

### InvalidAddress

```solidity
error InvalidAddress(address addr)
```

_Error when smart contract address is invalid_

### ContractNotRegistered

```solidity
error ContractNotRegistered(bytes32 smartContract)
```

_Error when a smart contract is not registered_

