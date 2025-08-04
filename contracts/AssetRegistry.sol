// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {IAssetRegistry} from "./interfaces/IAssetRegistry.sol";
import {IProcessRegistry} from "./interfaces/IProcessRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    DEFAULT_ADMIN_ROLE,
    PROCESS_REGISTRY,
    MAX_PAGE_SIZE,
    FIRST_PAGE,
    INVALID_PAGE,
    ASSET_ADMIN_ROLE
} from "./lib/Constants.sol";
import {Utils} from "./lib/Utils.sol";

/**
 * @title AssetRegistry
 * @notice Contract for managing asset lifecycle in the trace system
 */
contract AssetRegistry is Context, BaseTraceContract, IAssetRegistry {

    // =============================================================
    //                        STORAGE
    // =============================================================

    /**
     * Mapping to track asset counter by channel
     * @dev channelName => assetCounter
     */
    mapping(bytes32 => uint256) internal _assetCounterByChannel; 

    /**
     * Mapping to store assets by ID and channel
     * @dev channelName => assetId => Asset
     */
    mapping(bytes32 => mapping(bytes32 => Asset)) private _assetsByChannel;

    /**
     * Mapping to track asset existence by channel
     * @dev channelName => assetId => exists
     */
    mapping(bytes32 => mapping(bytes32 => bool)) private _assetExistsByChannel;    
    
    /**
     * Mapping to track assets by channel and owner
     * @dev channelName => owner => assetId[]
     */
    mapping(bytes32 => mapping(address => bytes32[])) private _assetsByChannelAndOwner;

    /**
     * Mapping to track assets by channel and owner index
     * @dev channelName => assetId => index
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) private _assetIndexByChannelAndOwner;

    /**
     * Mapping to track assets by status and channel for query
     * @dev channelName => status => assetId[]
     */
    mapping(bytes32 => mapping(AssetStatus => bytes32[])) private _assetsByChannelAndStatus;

    /**
     * Mapping to track assets by channel and status index
     * @dev channelName => assetId => index
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) private _assetIndexByChannelAndStatus;

    /**
     * Mapping to track asset operation history for traceability by channel
     * @dev channelName => assetId => operation[]
     */
    mapping(bytes32 => mapping(bytes32 => AssetOperation[])) private _assetHistoryByChannel;

    /**
     * Mapping to track asset operation timestamps by channel
     * @dev channelName => assetId => timestamp[]
     */
    mapping(bytes32 => mapping(bytes32 => uint256[])) private _assetHistoryTimestampsByChannel;


    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /**
     * @notice Constructor for AssetRegistry
     * @param addressDiscovery_ Address of the AddressDiscovery contract
     */
    constructor(address addressDiscovery_) 
        BaseTraceContract(addressDiscovery_) 
    {
        _grantRole(ASSET_ADMIN_ROLE, _msgSender());
    }

    // =============================================================
    //                    ASSET REGISTRY
    // =============================================================

    /**
     * @inheritdoc IAssetRegistry
     */
    function createAsset(CreateAssetInput calldata input) 
        external 
        validChannelName(input.channelName)
        onlyChannelMember(input.channelName)
    {
        _validateCreateAssetInput(input);

        // Create asset structure
        Asset storage newAsset = _assetsByChannel[input.channelName][input.assetId];
        newAsset.assetId = input.assetId;
        newAsset.owner = _msgSender();
        newAsset.idLocal = input.idLocal;
        newAsset.amount = input.amount;
        newAsset.status = AssetStatus.ACTIVE;
        newAsset.operation = AssetOperation.CREATE;
        newAsset.createdAt = Utils.timestamp();
        newAsset.lastUpdated = Utils.timestamp();
        newAsset.originOwner = _msgSender();

        for (uint256 i = 0; i < input.dataHashes.length; i++) { //See TODO
            newAsset.dataHashes.push(input.dataHashes[i]);
        }

        for (uint256 i = 0; i < input.externalIds.length; i++) { //See TODO
            newAsset.externalIds.push(input.externalIds[i]);
        }

        // Mark asset as existing
        _assetExistsByChannel[input.channelName][input.assetId] = true;

        _addAssetToOwner(input.channelName, input.assetId, _msgSender());
        _addAssetToStatus(input.channelName, input.assetId, AssetStatus.ACTIVE);
        _addToHistory(input.channelName, input.assetId, AssetOperation.CREATE, Utils.timestamp());

        emit AssetCreated(
            input.channelName,
            input.assetId,
            _msgSender(),
            input.amount,
            input.idLocal,
            Utils.timestamp()
        );
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function updateAsset(UpdateAssetInput calldata update) 
        external
        validChannelName(update.channelName)
        onlyChannelMember(update.channelName) 
    {
        _validateUpdateAssetInput(update);

        if(!_assetExistsByChannel[update.channelName][update.assetId]) {
            revert AssetNotFound(update.channelName, update.assetId);
        }

        Asset storage asset = _assetsByChannel[update.channelName][update.assetId];

        if (asset.status != AssetStatus.ACTIVE) {
            revert AssetNotActive(update.channelName, update.assetId);
        }

        if (asset.owner != _msgSender()) {
            revert NotAssetOwner(update.channelName, update.assetId, _msgSender());
        }

        asset.idLocal = update.idLocal;

        if (update.amount > 0) {
            asset.amount = update.amount;
        }

        //Replace data hashes completely See TODO
        delete asset.dataHashes;
        for (uint256 i = 0; i < update.dataHashes.length; i++) {
            asset.dataHashes.push(update.dataHashes[i]);
        }

        asset.operation = AssetOperation.UPDATE;
        asset.lastUpdated = Utils.timestamp();

        _addToHistory(update.channelName, update.assetId, AssetOperation.UPDATE, Utils.timestamp());

        emit AssetUpdated(
            update.channelName,
            asset.assetId,
            asset.owner,
            asset.amount,
            asset.idLocal,
            Utils.timestamp()
        );
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function transferAsset(TransferAssetInput calldata transfer) 
        external  
        validChannelName(transfer.channelName)
        onlyChannelMember(transfer.channelName)
    {
        _validateTransferAssetInput(transfer);

        if(!_assetExistsByChannel[transfer.channelName][transfer.assetId]) {
            revert AssetNotFound(transfer.channelName, transfer.assetId);
        }

        Asset storage asset = _assetsByChannel[transfer.channelName][transfer.assetId];

        if (asset.status != AssetStatus.ACTIVE) {
            revert AssetNotActive(transfer.channelName, transfer.assetId);
        }

        if (asset.owner != _msgSender()) {
            revert NotAssetOwner(transfer.channelName, transfer.assetId, _msgSender());
        }

        if (asset.owner == transfer.newOwner) {
            revert TransferToSameOwner(transfer.channelName, transfer.assetId, transfer.newOwner);
        }

        address originalOwner = asset.owner;

        asset.owner = transfer.newOwner;    //New Owner
        asset.originOwner = originalOwner;   //Track Original
        asset.idLocal = transfer.idLocal;
        asset.operation = AssetOperation.TRANSFER;
        asset.lastUpdated = Utils.timestamp();

        //Replace externalIds completely  
        delete asset.externalIds;
        for (uint256 i = 0; i < transfer.externalIds.length; i++) {
            asset.externalIds.push(transfer.externalIds[i]);
        }

        //Update owner enumeration
        _removeAssetFromOwner(transfer.channelName, transfer.assetId, originalOwner);
        _addAssetToOwner(transfer.channelName, transfer.assetId, transfer.newOwner);

        _addToHistory(transfer.channelName, transfer.assetId, AssetOperation.TRANSFER, Utils.timestamp());

        emit AssetTransferred(
            transfer.channelName,
            transfer.assetId,
            originalOwner,
            transfer.newOwner,
            transfer.idLocal,
            Utils.timestamp()
        );

    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * @inheritdoc IAssetRegistry
     */
    function getAsset(bytes32 channelName, bytes32 assetId) 
        external 
        view 
        validChannelName(channelName)
        returns (Asset memory asset) 
    {
        if (!_assetExistsByChannel[channelName][assetId]) {
            revert AssetNotFound(channelName, assetId);
        }
        return _assetsByChannel[channelName][assetId];
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function isAssetActive(bytes32 channelName, bytes32 assetId) 
        external 
        view 
        validChannelName(channelName)
        returns (bool active) 
    {
        if (!_assetExistsByChannel[channelName][assetId]) {
            return false;
        }
        return _assetsByChannel[channelName][assetId].status == AssetStatus.ACTIVE;
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function getAssetHistory(bytes32 channelName, bytes32 assetId) 
        external 
        view 
        returns (
            AssetOperation[] memory operations,
            uint256[] memory timestamps
        ) 
    {
        if (!_assetExistsByChannel[channelName][assetId]) {
            revert AssetNotFound(channelName, assetId);
        }
        
        operations = _assetHistoryByChannel[channelName][assetId];
        timestamps = _assetHistoryTimestampsByChannel[channelName][assetId];
    }

    // =============================================================
    //                    VALIDATION FUNCTIONS
    // =============================================================
    function _validateCreateAssetInput(CreateAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.idLocal, input.dataHashes);
    }

    function _validateUpdateAssetInput(UpdateAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.idLocal, input.dataHashes);
    }

    function _validateTransferAssetInput(TransferAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.idLocal, input.dataHashes);
        if (input.newOwner == address(0)) revert InvalidAddress(input.newOwner);
    }

    function _validateCommonAssetFields(
        bytes32 assetId,
        bytes32 channelName,
        string calldata idLocal,
        bytes32[] calldata dataHashes
    ) internal pure {
        if (assetId == bytes32(0)) revert InvalidAssetId(channelName, assetId);
        if (bytes(idLocal).length == 0) revert EmptyLocation();
        if (dataHashes.length == 0) revert EmptyDataHashes();
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    function _addAssetToOwner(bytes32 channelName, bytes32 assetId, address owner) internal {
        uint256 index = _assetsByChannelAndOwner[channelName][owner].length;
        _assetsByChannelAndOwner[channelName][owner].push(assetId);
        _assetIndexByChannelAndOwner[channelName][assetId] = index;
    }

    function _addAssetToStatus(bytes32 channelName, bytes32 assetId, AssetStatus status) internal {
        uint256 index = _assetsByChannelAndStatus[channelName][status].length;
        _assetsByChannelAndStatus[channelName][status].push(assetId);
        _assetIndexByChannelAndStatus[channelName][assetId] = index;
    }

    function _addToHistory(bytes32 channelName, bytes32 assetId, AssetOperation operation, uint256 timestamp) internal {
        _assetHistoryByChannel[channelName][assetId].push(operation);
        _assetHistoryTimestampsByChannel[channelName][assetId].push(timestamp);
    }

    function _removeAssetFromOwner(bytes32 channelName, bytes32 assetId, address owner) internal {
        bytes32[] storage ownerAssets = _assetsByChannelAndOwner[channelName][owner];
        uint256 assetIndex = _assetIndexByChannelAndOwner[channelName][assetId];
        uint256 lastIndex = ownerAssets.length - 1;
        
        // Move last element to deleted position
        if (assetIndex != lastIndex) {
            bytes32 lastAssetId = ownerAssets[lastIndex];
            ownerAssets[assetIndex] = lastAssetId;
            _assetIndexByChannelAndOwner[channelName][lastAssetId] = assetIndex;
        }
        
        // Remove last element
        ownerAssets.pop();
        delete _assetIndexByChannelAndOwner[channelName][assetId];
    }

    // =============================================================
    //                    ADMIN FUNCTIONS
    // =============================================================

    /**
     * @notice Set address discovery contract
     * @param discovery New address discovery contract
     */
    function setAddressDiscovery(address discovery) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setAddressDiscovery(discovery);
    }

    /**
     * @notice Get address discovery contract
     * @return Address of the address discovery contract
     */
    function getAddressDiscovery() external view returns (address) {
        return address(_getAddressDiscovery());
    }

    /**
     * @inheritdoc BaseTraceContract
     */
    function getVersion() external pure override returns (string memory) {
        return "1.0.0";
    }

    // =============================================================
    //                    PLACEHOLDER FUNCTIONS
    // =============================================================
    // Note: These functions are defined in the interface but not implemented yet
    // They will be implemented in the next iterations

    

    function transformAsset(TransformAssetInput calldata) external pure returns (bytes32) {
        revert("Not implemented yet");
    }

    function splitAsset(SplitAssetInput calldata) external pure returns (bytes32[] memory) {
        revert("Not implemented yet");
    }

    function groupAssets(GroupAssetsInput calldata) external pure returns (bytes32) {
        revert("Not implemented yet");
    }

    function ungroupAssets(bytes32, bytes32, bytes32[] calldata) external pure returns (bytes32[] memory) {
        revert("Not implemented yet");
    }

    function inactivateAsset(bytes32, bytes32, bytes32[] calldata) external pure {
        revert("Not implemented yet");
    }

    function getAssetsByOwner(address, uint256, uint256) external pure returns (bytes32[] memory, uint256, bool) {
        revert("Not implemented yet");
    }

    function getAssetsByStatus(AssetStatus, uint256, uint256) external pure returns (bytes32[] memory, uint256, bool) {
        revert("Not implemented yet");
    }
}
