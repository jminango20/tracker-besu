# Solidity API

## AddressDiscovery

Contract for managing addresses of smart contracts and their updates

_Contract that facilitates the discovery of addresses of smart contracts to be used in other contracts._

### constructor

```solidity
constructor(address _admin) public
```

Function to initialize the contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _admin | address | Address of the admin |

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

### getAddress

```solidity
function getAddress(bytes32 smartContract) external view returns (address)
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

### addAdmin

```solidity
function addAdmin(address newAddressDiscoveryAdmin) external
```

Function to add a new address discovery admin.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddressDiscoveryAdmin | address | Address of the new address discovery admin |

### removeAdmin

```solidity
function removeAdmin(address addressDiscoveryAdmin) external
```

Function to remove an address discovery admin.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressDiscoveryAdmin | address | Address of the address discovery admin to remove |

