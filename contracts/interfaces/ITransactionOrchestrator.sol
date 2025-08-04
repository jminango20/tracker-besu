// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAssetRegistry.sol";

/**
 * @title ITransactionOrchestrator
 * @notice Central orchestrator for all trace operations (equivalent to Fabric submitTransaction)
 * @dev Integrates ProcessRegistry + SchemaRegistry + AssetRegistry
 */
interface ITransactionOrchestrator {

    // =============================================================
    //                        ENUMS
    // =============================================================
    
    enum TransactionStatus {
        PENDING,     // Submitted but not processed
        PROCESSING,  // Being executed
        COMPLETED,   // Successfully completed
        FAILED,      // Failed with error
        REVERTED     // Reverted due to business logic
    }

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
        
        // Target assets (empty for createAsset)
        bytes32[] targetAssetIds;     // Assets to operate on
        
        // Operation data
        OperationData operationData;  // Operation-specific parameters
        
        // Schema data (off-chain)
        bytes32[] dataHashes;         // Hashes of sensitive data
        
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
        string[] externalIds;         // External tracking IDs
        
        // SPLIT_ASSET
        uint256[] splitAmounts;       // Amounts for each split asset
        
        // GROUP_ASSET
        uint256 groupAmount;          // Total amount for group
        
        // UPDATE_ASSET / TRANSFORM_ASSET
        uint256 newAmount;            // Updated amount (0 = no change)
        bytes32 newProcessId;         // New process ID (for transform)
        
        // Common fields
        string newLocation;           // Updated/new location
    }

    /**
     * @notice Transaction execution result
     */
    struct TransactionResult {
        bytes32 transactionId;        // Unique transaction identifier
        TransactionStatus status;     // Execution status
        bytes32[] affectedAssetIds;   // Assets created/modified
        bytes32 resultDataHash;       // Hash of result data
        uint256 executedAt;           // Execution timestamp
        uint256 gasUsed;              // Gas consumed
        string errorMessage;          // Error details (if failed)
    }

    /**
     * @notice Transaction metadata for queries
     */
    struct TransactionInfo {
        bytes32 transactionId;        // Transaction identifier
        bytes32 processId;            // Process used
        bytes32[] targetAssetIds;     // Target assets
        address initiator;            // Who initiated the transaction
        TransactionStatus status;     // Current status
        uint256 submittedAt;          // Submission timestamp
        uint256 executedAt;           // Execution timestamp
        bytes32 channelName;          // Channel used
    }

    // =============================================================
    //                        EVENTS
    // =============================================================

    /**
     * @notice Emitted when a transaction is submitted
     */
    event TransactionSubmitted(
        bytes32 indexed transactionId,
        address indexed initiator,
        bytes32 indexed processId,
        bytes32 channelName,
        bytes32[] targetAssetIds,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a transaction is executed
     */
    event TransactionExecuted(
        bytes32 indexed transactionId,
        TransactionStatus indexed status,
        bytes32[] affectedAssetIds,
        uint256 gasUsed,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a transaction fails
     */
    event TransactionFailed(
        bytes32 indexed transactionId,
        address indexed initiator,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted for audit trail
     */
    event AuditTrail(
        bytes32 indexed transactionId,
        bytes32 indexed processId,
        address indexed initiator,
        bytes32 channelName,
        IAssetRegistry.AssetOperation operation,
        bytes32[] assetIds,
        uint256 timestamp
    );

    // =============================================================
    //                    MAIN FUNCTIONS
    // =============================================================

    /**
     * @notice Submit a transaction for execution (main entry point)
     * @dev Equivalent to Fabric submitTransaction - validates and routes to appropriate operation
     * @param request Transaction request with all operation data
     * @return transactionId Unique transaction identifier
     */
    function submitTransaction(TransactionRequest calldata request) 
        external returns (bytes32 transactionId);

    /**
     * @notice Execute multiple transactions in batch
     * @param requests Array of transaction requests
     * @return transactionIds Array of transaction identifiers
     */
    function batchSubmitTransactions(TransactionRequest[] calldata requests)
        external returns (bytes32[] memory transactionIds);

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Get transaction result
     * @param transactionId Transaction identifier
     * @return result Transaction execution result
     */
    function getTransactionResult(bytes32 transactionId) 
        external view returns (TransactionResult memory result);

    /**
     * @notice Get transaction information
     * @param transactionId Transaction identifier
     * @return info Transaction metadata
     */
    function getTransactionInfo(bytes32 transactionId) 
        external view returns (TransactionInfo memory info);

    /**
     * @notice Get transaction history for an asset
     * @param assetId Asset identifier
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     * @return transactionIds Array of transaction IDs affecting this asset
     * @return totalTransactions Total number of transactions
     * @return hasNextPage True if there are more pages
     */
    function getAssetTransactionHistory(
        bytes32 assetId,
        uint256 page,
        uint256 pageSize
    ) external view returns (
        bytes32[] memory transactionIds,
        uint256 totalTransactions,
        bool hasNextPage
    );

    /**
     * @notice Get transactions by initiator
     * @param initiator Address that submitted transactions
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     * @return transactionIds Array of transaction IDs
     * @return totalTransactions Total number of transactions
     * @return hasNextPage True if there are more pages
     */
    function getTransactionsByInitiator(
        address initiator,
        uint256 page,
        uint256 pageSize
    ) external view returns (
        bytes32[] memory transactionIds,
        uint256 totalTransactions,
        bool hasNextPage
    );

    /**
     * @notice Get transactions by process
     * @param processId Process identifier
     * @param channelName Channel name
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     * @return transactionIds Array of transaction IDs
     * @return totalTransactions Total number of transactions
     * @return hasNextPage True if there are more pages
     */
    function getTransactionsByProcess(
        bytes32 processId,
        bytes32 channelName,
        uint256 page,
        uint256 pageSize
    ) external view returns (
        bytes32[] memory transactionIds,
        uint256 totalTransactions,
        bool hasNextPage
    );

    /**
     * @notice Get transactions by channel
     * @param channelName Channel name
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     * @return transactionIds Array of transaction IDs
     * @return totalTransactions Total number of transactions
     * @return hasNextPage True if there are more pages
     */
    function getTransactionsByChannel(
        bytes32 channelName,
        uint256 page,
        uint256 pageSize
    ) external view returns (
        bytes32[] memory transactionIds,
        uint256 totalTransactions,
        bool hasNextPage
    );

    /**
     * @notice Get transactions by status
     * @param status Transaction status to filter
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     * @return transactionIds Array of transaction IDs
     * @return totalTransactions Total number of transactions
     * @return hasNextPage True if there are more pages
     */
    function getTransactionsByStatus(
        TransactionStatus status,
        uint256 page,
        uint256 pageSize
    ) external view returns (
        bytes32[] memory transactionIds,
        uint256 totalTransactions,
        bool hasNextPage
    );

    /**
     * @notice Get pending transactions count
     * @return count Number of pending transactions
     */
    function getPendingTransactionsCount() external view returns (uint256 count);

    /**
     * @notice Get total transactions count
     * @return count Total number of transactions
     */
    function getTotalTransactionsCount() external view returns (uint256 count);

    // =============================================================
    //                    VALIDATION FUNCTIONS
    // =============================================================

    /**
     * @notice Validate a transaction request before submission
     * @param request Transaction request to validate
     * @return isValid True if request is valid
     * @return reason Validation failure reason (if invalid)
     */
    function validateTransactionRequest(TransactionRequest calldata request) 
        external view returns (bool isValid, string memory reason);

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

    /**
     * @notice Check if transactions are paused
     * @return paused True if transactions are paused
     */
    function isTransactionsPaused() external view returns (bool paused);
}