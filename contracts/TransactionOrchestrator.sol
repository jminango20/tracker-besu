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
    mapping(bytes32 => uint256) private _assetCounterByChannel;    

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
        IAddressDiscovery addressDiscovery = IAddressDiscovery(_getAddressDiscovery());

        IProcessRegistry processRegistry = IProcessRegistry(
            addressDiscovery.getContractAddress(PROCESS_REGISTRY)
        );

        IAssetRegistry assetRegistry = IAssetRegistry(
            addressDiscovery.getContractAddress(ASSET_REGISTRY)
        );

        _validateRequestFields(request);
        _validateProcess(request, processRegistry);
        
        bytes32[] memory affectedAssets = _routeAndExecuteOperation(
            request, 
            processRegistry, 
            assetRegistry
        );  
        
        //Get process for operation mapping
        IProcessRegistry.Process memory process = _getProcess(request, processRegistry);
        IAssetRegistry.AssetOperation operation = _mapProcessActionToAssetOperation(process.action);
        
        //Emit events for tracking
        emit OperationExecuted(
            request.channelName,
            request.processId,
            request.natureId,
            request.stageId,
            _msgSender(),
            affectedAssets,
            operation,
            block.number,
            Utils.timestamp()
        );
        
        emit ProcessExecuted(
            request.channelName,
            request.processId,
            request.natureId,
            request.stageId,
            _msgSender(),
            Utils.timestamp()
        );
        
        //Emit asset-specific events for efficient queries
        for (uint256 i = 0; i < affectedAssets.length; i++) {
            emit AssetModified(
                request.channelName,
                affectedAssets[i],
                _msgSender(),
                operation,
                block.number,
                Utils.timestamp()
            );
        }        
    }

    // =============================================================
    //                    VALIDATION FUNCTIONS
    // =============================================================
    function _validateRequestFields(TransactionRequest calldata request) private pure {
        if (request.processId == bytes32(0)) revert InvalidProcessId();
        if (request.natureId == bytes32(0)) revert InvalidNatureId();
        if (request.stageId == bytes32(0)) revert InvalidStageId();

        if (request.dataHashes.length == 0) revert EmptyDataHashes();
        if (request.dataHashes.length > MAX_DATA_HASHES) {
            revert TooManyDataHashes(request.dataHashes.length, MAX_DATA_HASHES);
        }
    }

    function _validateProcess(TransactionRequest calldata request, IProcessRegistry processRegistry) 
        private 
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

    function _getProcess(TransactionRequest calldata request, IProcessRegistry processRegistry) 
        private 
        view 
        returns (IProcessRegistry.Process memory) 
    {      
        return processRegistry.getProcess(
            request.channelName,
            request.processId,
            request.natureId,
            request.stageId
        );
    }

    // =============================================================
    //                    OPERATION ROUTING
    // =============================================================

    /**
     * @dev Routes and executes the appropriate operation
     */
    function _routeAndExecuteOperation(
        TransactionRequest calldata request,
        IProcessRegistry processRegistry,
        IAssetRegistry assetRegistry
    ) private returns (bytes32[] memory affectedAssets) {
                
        IProcessRegistry.Process memory process = _getProcess(request, processRegistry);
       
        // Route based on process action
        if (process.action == IProcessRegistry.ProcessAction.CREATE_ASSET) {
            affectedAssets = _executeCreateAsset(assetRegistry, request);
            
        } else if (process.action == IProcessRegistry.ProcessAction.UPDATE_ASSET) {
            affectedAssets = _executeUpdateAsset(assetRegistry, request);
            
        } else if (process.action == IProcessRegistry.ProcessAction.TRANSFER_ASSET) {
            affectedAssets = _executeTransferAsset(assetRegistry, request);
            
        } else if (process.action == IProcessRegistry.ProcessAction.TRANSFORM_ASSET) {
            affectedAssets = _executeTransformAsset(assetRegistry, request);
            
        } else if (process.action == IProcessRegistry.ProcessAction.SPLIT_ASSET) {
            affectedAssets = _executeSplitAsset(assetRegistry, request);
            
        } else if (process.action == IProcessRegistry.ProcessAction.GROUP_ASSET) {
            affectedAssets = _executeGroupAssets(assetRegistry, request);
            
        } else if (process.action == IProcessRegistry.ProcessAction.UNGROUP_ASSET) {
            affectedAssets = _executeUngroupAssets(assetRegistry, request);
            
        } else if (process.action == IProcessRegistry.ProcessAction.INACTIVATE_ASSET) {
            affectedAssets = _executeInactivateAsset(assetRegistry, request);
            
        } else {
            revert UnsupportedOperation(process.action);
        }
        
        return affectedAssets;
    }

    // =============================================================
    //                    OPERATION IMPLEMENTATIONS
    // =============================================================

    function _executeCreateAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) private returns (bytes32[] memory affectedAssets) {
        
        // Generate deterministic asset ID
        bytes32 assetId = _generateAssetId(request.channelName);
        
        // Prepare input
        IAssetRegistry.CreateAssetInput memory input = IAssetRegistry.CreateAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            amount: request.operationData.initialAmount,
            idLocal: request.operationData.initialLocation,
            dataHashes: request.dataHashes,
            externalIds: request.operationData.externalIds
        });
        
        // Execute
        assetRegistry.createAsset(input, _msgSender());
        
        // Return affected assets
        affectedAssets = new bytes32[](1);
        affectedAssets[0] = assetId;
        
        return affectedAssets;
    }

    function _executeUpdateAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) private returns (bytes32[] memory affectedAssets) {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        IAssetRegistry.UpdateAssetInput memory input = IAssetRegistry.UpdateAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            idLocal: request.operationData.newLocation,
            amount: request.operationData.newAmount,
            dataHashes: request.dataHashes
        });
        
        assetRegistry.updateAsset(input, _msgSender());
        
        affectedAssets = new bytes32[](1);
        affectedAssets[0] = assetId;
        
        return affectedAssets;
    }

    function _executeTransferAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) private returns (bytes32[] memory affectedAssets) {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        IAssetRegistry.TransferAssetInput memory input = IAssetRegistry.TransferAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            newOwner: request.operationData.targetOwner,
            idLocal: request.operationData.newLocation,
            dataHashes: request.dataHashes,
            externalIds: request.operationData.externalIds
        });
        
        assetRegistry.transferAsset(input, _msgSender());
        
        affectedAssets = new bytes32[](1);
        affectedAssets[0] = assetId;
        
        return affectedAssets;
    }

    function _executeTransformAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) private returns (bytes32[] memory affectedAssets) {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        IAssetRegistry.TransformAssetInput memory input = IAssetRegistry.TransformAssetInput({
            assetId: assetId,
            transformationId: string(abi.encodePacked("TRANSFORM_", Utils.timestamp())),
            channelName: request.channelName,
            amount: request.operationData.newAmount,
            idLocal: request.operationData.newLocation,
            dataHashes: request.dataHashes
        });
        
        assetRegistry.transformAsset(input, _msgSender());
        
        // For transform, we return the original asset ID
        // The new asset ID is generated internally by AssetRegistry
        affectedAssets = new bytes32[](1);
        affectedAssets[0] = assetId;
        
        return affectedAssets;
    }

    function _executeSplitAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) private returns (bytes32[] memory affectedAssets) {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        // Create data hashes array for each split
        bytes32[] memory splitDataHashes = new bytes32[](request.operationData.splitAmounts.length);
        for (uint256 i = 0; i < splitDataHashes.length; i++) {
            if (i < request.dataHashes.length) {
                splitDataHashes[i] = request.dataHashes[i];
            } else {
                splitDataHashes[i] = request.dataHashes[0]; // Use first hash as default
            }
        }
        
        IAssetRegistry.SplitAssetInput memory input = IAssetRegistry.SplitAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            amounts: request.operationData.splitAmounts,
            idLocal: request.operationData.newLocation,
            dataHashes: splitDataHashes
        });
        
        assetRegistry.splitAsset(input, _msgSender());
        
        // For split, we return the original asset ID
        // New asset IDs are generated internally by AssetRegistry
        affectedAssets = new bytes32[](1);
        affectedAssets[0] = assetId;
        
        return affectedAssets;
    }

    function _executeGroupAssets(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) private returns (bytes32[] memory affectedAssets) {
        
        bytes32 groupAssetId = _generateAssetId(request.channelName);
        
        IAssetRegistry.GroupAssetsInput memory input = IAssetRegistry.GroupAssetsInput({
            assetIds: request.targetAssetIds,
            groupAssetId: groupAssetId,
            channelName: request.channelName,
            idLocal: request.operationData.newLocation,
            dataHashes: request.dataHashes
        });
        
        assetRegistry.groupAssets(input, _msgSender());
        
        // Return both original assets and new group asset
        affectedAssets = new bytes32[](request.targetAssetIds.length + 1);
        for (uint256 i = 0; i < request.targetAssetIds.length; i++) {
            affectedAssets[i] = request.targetAssetIds[i];
        }
        affectedAssets[request.targetAssetIds.length] = groupAssetId;
        
        return affectedAssets;
    }

    function _executeUngroupAssets(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) private returns (bytes32[] memory affectedAssets) {
        
        bytes32 groupAssetId = request.targetAssetIds[0];
        
        bytes32 dataHash = request.dataHashes.length > 0 ? request.dataHashes[0] : bytes32(0);
        
        IAssetRegistry.UngroupAssetsInput memory input = IAssetRegistry.UngroupAssetsInput({
            assetId: groupAssetId,
            channelName: request.channelName,
            idLocal: request.operationData.newLocation,
            dataHash: dataHash
        });
        
        assetRegistry.ungroupAssets(input, _msgSender());
        
        affectedAssets = new bytes32[](1);
        affectedAssets[0] = groupAssetId;
        
        return affectedAssets;
    }

    function _executeInactivateAsset(
        IAssetRegistry assetRegistry, 
        TransactionRequest calldata request
    ) private returns (bytes32[] memory affectedAssets) {
        
        bytes32 assetId = request.targetAssetIds[0];
        
        bytes32 finalDataHash = request.dataHashes.length > 0 ? request.dataHashes[0] : bytes32(0);
        
        IAssetRegistry.InactivateAssetInput memory input = IAssetRegistry.InactivateAssetInput({
            assetId: assetId,
            channelName: request.channelName,
            finalLocation: request.operationData.newLocation,
            finalDataHash: finalDataHash
        });
        
        assetRegistry.inactivateAsset(input, _msgSender());
        
        affectedAssets = new bytes32[](1);
        affectedAssets[0] = assetId;
        
        return affectedAssets;
    }

    // =============================================================
    //                    HELPER FUNCTIONS
    // =============================================================

    function _generateAssetId(bytes32 channelName) private returns (bytes32) {
        _assetCounterByChannel[channelName]++;
        return keccak256(abi.encodePacked(
            channelName,
            _assetCounterByChannel[channelName],
            _msgSender()
        ));
    }

    function _mapProcessActionToAssetOperation(IProcessRegistry.ProcessAction action) 
        private 
        pure 
        returns (IAssetRegistry.AssetOperation) 
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

    // =============================================================
    //                    IMPLEMENTATION REQUIREMENTS
    // =============================================================

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