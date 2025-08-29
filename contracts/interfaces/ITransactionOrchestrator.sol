// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAssetRegistry} from "./IAssetRegistry.sol";
import {IProcessRegistry} from "./IProcessRegistry.sol";

/**
 * @title ITransactionOrchestrator
 * @notice Central orchestrator for all trace operations (equivalent to Fabric submitTransaction)
 * @dev Integrates ProcessRegistry + SchemaRegistry + AssetRegistry
 */
interface ITransactionOrchestrator {
    // =============================================================
    //                        STRUCTS
    // =============================================================

    /**
     * Unified transaction request for all asset operations
     * @dev Single entry point equivalent to Fabric submitTransaction
     */
    struct TransactionRequest {
        // Process identification (required for all operations)
        bytes32 processId;            // Process identifier
        bytes32 natureId;             // Product nature 
        bytes32 stageId;              // Operation stage 
        bytes32 channelName;          // Channel for permissions
        
        /**
         * Target assets to operate on (usage varies by operation type)
         * @dev Usage patterns:
         * - CREATE_ASSET: [] (empty array - no existing assets affected)
         * - UPDATE_ASSET: [assetId] (single asset to update)
         * - TRANSFER_ASSET: [assetId] (single asset to transfer)
         * - TRANSFORM_ASSET: [assetId] (single asset to transform)
         * - SPLIT_ASSET: [assetId] (single asset to split)
         * - GROUP_ASSET: [assetId1, assetId2, ...] (multiple assets to group)
         * - UNGROUP_ASSET: [groupId] (single group asset to ungroup)
         * - INACTIVATE_ASSET: [assetId] (single asset to inactivate)
         */
        bytes32[] targetAssetIds;     // Assets to operate on
        
        // Operation data
        OperationData operationData;  // Operation-specific parameters
        
        // Schema data (off-chain)
        bytes32 dataHash;             // Hashes of sensitive data
        bytes32[] dataHashes;         // Hashes of sensitive data - split
        
        // Metadata
        string description;           // Operation description (optional)
    }

    /**
     * Operation-specific data structure
     * @dev Flexible structure to handle all operation types
     */
    struct OperationData {
        // CREATE_ASSET
        uint256 initialAmount;        // Initial amount for new asset
        string initialLocation;       // Initial location for new asset
        
        // TRANSFER_ASSET
        address targetOwner;          // New owner for transfer
        string externalId;            // External tracking IDs
        
        // SPLIT_ASSET
        uint256[] splitAmounts;       // Amounts for each split asset
                
        // TRANSFORM_ASSET
        bytes32 newAssetId;           // New asset ID (for transform)

        // Common fields
        string newLocation;           // Updated/new location
        uint256 newAmount;            // Updated amount (0 = no change)
    }
    
    // =============================================================
    //                        EVENTS
    // =============================================================

    /**
     * @notice Main transaction event for comprehensive tracking
     */
    event OperationExecuted(
        bytes32 indexed channelName,
        bytes32 indexed processId,
        bytes32 natureId,
        bytes32 stageId,
        address operator,
        bytes32[] affectedAssets,
        IAssetRegistry.AssetOperation operation,
        uint256 indexed blockNumber,      
        uint256 timestamp
    );

    /**
     * @notice Asset-specific event for efficient filtering
     */
    event AssetModified(
        bytes32 indexed channelName,
        bytes32 indexed assetId,
        address indexed operator,
        IAssetRegistry.AssetOperation operation,
        uint256 blockNumber,
        uint256 timestamp
    );

    // =============================================================
    //                        ERRORS
    // =============================================================

    error TransactionValidationFailed(string errorMessage);
    error UnsupportedOperation(IProcessRegistry.ProcessAction action);
    error InvalidProcessId();
    error InvalidNatureId();
    error InvalidStageId();
   
    // =============================================================
    //                    MAIN FUNCTIONS
    // =============================================================

    /**
     * @notice Submit a transaction for execution (main entry point)
     * @dev Equivalent to Fabric submitTransaction - validates and routes to appropriate operation
     * @param request Transaction request with all operation data
     */
    function submitTransaction(TransactionRequest calldata request) external;

    // =============================================================
    //                    ADMIN FUNCTIONS
    // =============================================================

    /**
     * @notice Pause transaction processing (emergency stop)
     */
    function pauseTransactions() external;

    /**
     * @notice Resume transaction processing
     */
    function resumeTransactions() external;
}