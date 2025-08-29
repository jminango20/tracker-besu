// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {ITransactionOrchestrator} from "./interfaces/ITransactionOrchestrator.sol";
import {IAddressDiscovery} from "./interfaces/IAddressDiscovery.sol";

import {IProcessRegistry} from "./interfaces/IProcessRegistry.sol";
import {ISchemaRegistry} from "./interfaces/ISchemaRegistry.sol";
import {IAssetRegistry} from "./interfaces/IAssetRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {
    DEFAULT_ADMIN_ROLE, 
    TRANSACTION_ADMIN_ROLE,
    PROCESS_REGISTRY,
    SCHEMA_REGISTRY,
    ASSET_REGISTRY,
    MAX_DATA_HASHES,
    MAX_SPLIT_COUNT,
    MIN_GROUP_SIZE,
    MAX_GROUP_SIZE
} from "./lib/Constants.sol";
import {Utils} from "./lib/Utils.sol";

/**
 * @title TransactionOrchestrator
 * @notice Central orchestrator for all trace operations (equivalent to Fabric submitTransaction)
 * @dev Optimized version with event-driven tracking and minimal storage
 */
contract TransactionOrchestrator is Context, BaseTraceContract, ITransactionOrchestrator, Pausable {

    // =============================================================
    //                        MINIMAL STORAGE
    // =============================================================

    /**
     * Asset counter by channel for deterministic IDs (only business-critical storage)
     * @dev channelName => assetCounter
     */
    mapping(bytes32 => uint256) private _assetCounters;    

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    constructor(address addressDiscovery_) 
        BaseTraceContract(addressDiscovery_) 
    {
        _grantRole(TRANSACTION_ADMIN_ROLE, _msgSender());
    }

    // =============================================================
    //                    MAIN FUNCTION
    // =============================================================

    /**
     * @inheritdoc ITransactionOrchestrator
     */
    function submitTransaction(TransactionRequest calldata request) 
        external 
        nonReentrant
        whenNotPaused
        validChannelName(request.channelName)
        onlyChannelMember(request.channelName)
    {
        _validateRequest(request);

        IProcessRegistry processRegistry = IProcessRegistry(_getRegistry(PROCESS_REGISTRY));
        IAssetRegistry assetRegistry = IAssetRegistry(_getRegistry(ASSET_REGISTRY));

        _validateProcess(request, processRegistry);
        
        bytes32[] memory affectedAssets = _executeOperation(
            request, 
            processRegistry, 
            assetRegistry
        );  
        
        _emitEvents(request, affectedAssets, processRegistry);
    }

    // =============================================================
    //                    VALIDATION FUNCTIONS
    // =============================================================
    function _validateRequest(TransactionRequest calldata request) private pure {
        if (request.processId == bytes32(0)) revert InvalidProcessId();
        if (request.natureId == bytes32(0)) revert InvalidNatureId();
        if (request.stageId == bytes32(0)) revert InvalidStageId();
    }

    function _validateProcess(TransactionRequest calldata request, IProcessRegistry processRegistry) 
        internal 
        view 
    {        
        (bool processValid, string memory processError) = 
            processRegistry.validateProcessForSubmission(
                request.channelName,
                request.processId,
                request.natureId,
                request.stageId
            );
        
        if (!processValid) {
            revert TransactionValidationFailed(processError);
        }
    }

    function _getRegistry(bytes32 registryName) internal view returns (address) {
        return IAddressDiscovery(_getAddressDiscovery()).getContractAddress(registryName);
    }

    // =============================================================
    //                    OPERATION EXECUTION
    // =============================================================

    /**
     * @dev Routes and executes the appropriate operation
     */
    function _executeOperation(
        TransactionRequest calldata request,
        IProcessRegistry processRegistry,
        IAssetRegistry assetRegistry
    ) private returns (bytes32[] memory affectedAssets) {
                
        IProcessRegistry.Process memory process = processRegistry.getProcess(
            request.channelName,
            request.processId,
            request.natureId,
            request.stageId
        );
       
        // Route based on process action
        if (process.action == IProcessRegistry.ProcessAction.CREATE_ASSET) {
            return _executeCreateAsset(assetRegistry, request);
        } else if (process.action == IProcessRegistry.ProcessAction.UPDATE_ASSET) {
            return _executeUpdateAsset(assetRegistry, request);
        } else if (process.action == IProcessRegistry.ProcessAction.TRANSFER_ASSET) {
            return _executeTransferAsset(assetRegistry, request);
        } else if (process.action == IProcessRegistry.ProcessAction.TRANSFORM_ASSET) {
            return _executeTransformAsset(assetRegistry, request);
        } else if (process.action == IProcessRegistry.ProcessAction.SPLIT_ASSET) {
            return _executeSplitAsset(assetRegistry, request);
        } else if (process.action == IProcessRegistry.ProcessAction.GROUP_ASSET) {
            return _executeGroupAssets(assetRegistry, request);
        } else if (process.action == IProcessRegistry.ProcessAction.UNGROUP_ASSET) {
            return _executeUngroupAssets(assetRegistry, request);
        } else if (process.action == IProcessRegistry.ProcessAction.INACTIVATE_ASSET) {
            return _executeInactivateAsset(assetRegistry, request);
        } else {
            revert UnsupportedOperation(process.action);
        }
    }

    function _executeCreateAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) internal returns (bytes32[] memory) 
    {
        
        // Generate deterministic asset ID
        bytes32 assetId = _generateAssetId(request.channelName);            
        
        // Prepare input
        IAssetRegistry.CreateAssetInput memory input = IAssetRegistry.CreateAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            location: request.operationData.initialLocation,
            amount: request.operationData.initialAmount,
            dataHash: request.dataHash,
            externalId: request.operationData.externalId
        });         
        
        // Execute
        assetRegistry.createAsset(input, _msgSender());
        
        return _singleAssetArray(assetId);        
    }

    function _executeUpdateAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) internal returns (bytes32[] memory) 
    {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        IAssetRegistry.UpdateAssetInput memory input = IAssetRegistry.UpdateAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            newLocation: request.operationData.newLocation,
            newAmount: request.operationData.newAmount,
            dataHash: request.dataHash
        });
        
        assetRegistry.updateAsset(input, _msgSender());
        
        return _singleAssetArray(assetId);
    }

    function _executeTransferAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) internal returns (bytes32[] memory) 
    {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        IAssetRegistry.TransferAssetInput memory input = IAssetRegistry.TransferAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            newOwner: request.operationData.targetOwner,
            newLocation: request.operationData.newLocation,
            newAmount: request.operationData.newAmount,
            dataHash: request.dataHash,
            externalId: request.operationData.externalId
        });
        
        assetRegistry.transferAsset(input, _msgSender());
        
        return _singleAssetArray(assetId);
    }

    function _executeTransformAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) internal returns (bytes32[] memory) 
    {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        IAssetRegistry.TransformAssetInput memory input = IAssetRegistry.TransformAssetInput({
            assetId: assetId,
            newAssetId: request.operationData.newAssetId,
            channelName: request.channelName,
            newAmount: request.operationData.newAmount,
            newLocation: request.operationData.newLocation
        });
        
        assetRegistry.transformAsset(input, _msgSender());
        
        return _singleAssetArray(assetId);
    }

    function _executeSplitAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) internal returns (bytes32[] memory) 
    {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        bytes32[] memory splitDataHashes = _prepareSplitDataHashes(request);
        
        IAssetRegistry.SplitAssetInput memory input = IAssetRegistry.SplitAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            amounts: request.operationData.splitAmounts,
            location: request.operationData.newLocation,
            dataHashes: splitDataHashes
        });
        
        assetRegistry.splitAsset(input, _msgSender());
        
        return _singleAssetArray(assetId);
    }

    function _executeGroupAssets(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) internal returns (bytes32[] memory) 
    {
        
        bytes32 groupAssetId = _generateAssetId(request.channelName);
        
        IAssetRegistry.GroupAssetsInput memory input = IAssetRegistry.GroupAssetsInput({
            assetIds: request.targetAssetIds,
            groupAssetId: groupAssetId,
            channelName: request.channelName,
            location: request.operationData.newLocation,
            dataHash: request.dataHash
        });
        
        assetRegistry.groupAssets(input, _msgSender());
        
        // Return both original assets and new group asset
        bytes32[] memory affectedAssets = new bytes32[](request.targetAssetIds.length + 1);
        for (uint256 i = 0; i < request.targetAssetIds.length; i++) {
            affectedAssets[i] = request.targetAssetIds[i];
        }
        affectedAssets[request.targetAssetIds.length] = groupAssetId;
        
        return affectedAssets;
    }

    function _executeUngroupAssets(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) internal returns (bytes32[] memory) 
    {
        
        bytes32 groupAssetId = request.targetAssetIds[0];
                
        IAssetRegistry.UngroupAssetsInput memory input = IAssetRegistry.UngroupAssetsInput({
            assetId: groupAssetId,
            channelName: request.channelName,
            location: request.operationData.newLocation,
            dataHash: request.dataHash
        });
        
        assetRegistry.ungroupAssets(input, _msgSender());
        
        return _singleAssetArray(groupAssetId);
    }

    function _executeInactivateAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) internal returns (bytes32[] memory) 
    {
        
        bytes32 assetId = request.targetAssetIds[0];
                
        IAssetRegistry.InactivateAssetInput memory input = IAssetRegistry.InactivateAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            finalLocation: request.operationData.newLocation,
            finalDataHash: request.dataHash
        });

        assetRegistry.inactivateAsset(input, _msgSender());
        
        return _singleAssetArray(assetId);
    }

    // =============================================================
    //                    INTERNAL HELPERS
    // =============================================================

    function _generateAssetId(bytes32 channelName) internal returns (bytes32) {
        _assetCounters[channelName]++;
        return keccak256(abi.encodePacked(
            channelName,
            _assetCounters[channelName],
            _msgSender(),
            block.timestamp
        ));
    }

    function _singleAssetArray(bytes32 assetId) internal pure returns (bytes32[] memory) {
        bytes32[] memory result = new bytes32[](1);
        result[0] = assetId;
        return result;
    }

    function _prepareSplitDataHashes(TransactionRequest calldata request) internal pure returns (bytes32[] memory) {
        bytes32[] memory splitDataHashes = new bytes32[](request.operationData.splitAmounts.length);
        for (uint256 i = 0; i < splitDataHashes.length; i++) {
            if (i < request.dataHashes.length) {
                splitDataHashes[i] = request.dataHashes[i];
            } else {
                splitDataHashes[i] = request.dataHashes[0]; // Use first hash as default
            }
        }
        return splitDataHashes;
    }

    function _emitEvents(
        TransactionRequest calldata request,
        bytes32[] memory affectedAssets,
        IProcessRegistry processRegistry
    ) internal {
        IProcessRegistry.Process memory process = processRegistry.getProcess(
            request.channelName,
            request.processId,
            request.natureId,
            request.stageId
        );

        IAssetRegistry.AssetOperation operation = _mapProcessActionToAssetOperation(process.action);
        uint256 timestamp = Utils.timestamp();
        
        emit OperationExecuted(
            request.channelName,
            request.processId,
            request.natureId,
            request.stageId,
            _msgSender(),
            affectedAssets,
            operation,
            block.number,
            timestamp
        );
        
        // Simplified event emission - only essential events
        for (uint256 i = 0; i < affectedAssets.length; i++) {
            emit AssetModified(
                request.channelName,
                affectedAssets[i],
                _msgSender(),
                operation,
                block.number,
                timestamp
            );
        }
    }

    function _mapProcessActionToAssetOperation(IProcessRegistry.ProcessAction action) 
        internal pure returns (IAssetRegistry.AssetOperation) 
    {
        if (action == IProcessRegistry.ProcessAction.CREATE_ASSET) {
            return IAssetRegistry.AssetOperation.CREATE;
        } else if (action == IProcessRegistry.ProcessAction.UPDATE_ASSET) {
            return IAssetRegistry.AssetOperation.UPDATE;
        } else if (action == IProcessRegistry.ProcessAction.TRANSFER_ASSET) {
            return IAssetRegistry.AssetOperation.TRANSFER;
        } else if (action == IProcessRegistry.ProcessAction.TRANSFORM_ASSET) {
            return IAssetRegistry.AssetOperation.TRANSFORM;
        } else if (action == IProcessRegistry.ProcessAction.SPLIT_ASSET) {
            return IAssetRegistry.AssetOperation.SPLIT;
        } else if (action == IProcessRegistry.ProcessAction.GROUP_ASSET) {
            return IAssetRegistry.AssetOperation.GROUP;
        } else if (action == IProcessRegistry.ProcessAction.UNGROUP_ASSET) {
            return IAssetRegistry.AssetOperation.UNGROUP;
        } else if (action == IProcessRegistry.ProcessAction.INACTIVATE_ASSET) {
            return IAssetRegistry.AssetOperation.INACTIVATE;
        } else if (action == IProcessRegistry.ProcessAction.CREATE_DOCUMENT) {
            return IAssetRegistry.AssetOperation.CREATE_DOCUMENT;
        } else {
            return IAssetRegistry.AssetOperation.CREATE; // Default
        }
    }

    // =============================================================
    //                    ADMIN FUNCTIONS
    // =============================================================
    function pauseTransactions() external onlyRole(TRANSACTION_ADMIN_ROLE) {
        _pause();
    }

    function resumeTransactions() external onlyRole(TRANSACTION_ADMIN_ROLE) {
        _unpause();
    }

    function setAddressDiscovery(address discovery) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setAddressDiscovery(discovery);
    }

    function getAddressDiscovery() external view returns (address) {
        return address(_getAddressDiscovery());
    }

    function getVersion() external pure override returns (string memory) {
        return "1.0.0";
    }
}