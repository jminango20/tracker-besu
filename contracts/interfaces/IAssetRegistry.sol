// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAssetRegistry
 * Interface for managing asset lifecycle in the trace system
 */
interface IAssetRegistry {

    // =============================================================
    //                        ENUMS
    // =============================================================
    
    enum AssetStatus { 
        ACTIVE,     // Asset is active and can be operated on
        INACTIVE    // Asset is inactive (after split, group, transform, inactivate)
    }
    
    enum AssetOperation { 
        CREATE,      // Initial asset creation
        UPDATE,    // Register asset
        TRANSFER,    // Transfer ownership
        TRANSFERIN,  // Transfer inner
        SPLIT,       // Split into multiple assets
        GROUP,       // Group multiple assets into one
        UNGROUP,     // Ungroup assets back to originals
        TRANSFORM,   // Transform to new asset type
        INACTIVATE,  // Permanently inactivate asset
        CREATE_DOCUMENT, //Create document
        DATA_SHEET_ASSET, //Data sheet
        PARTIALLY_CONSUMED_ASSET //Partially consumed
    }

    // =============================================================
    //                        STRUCTS
    // =============================================================
    
    struct Asset {
        bytes32 assetId;              // Unique sequential asset ID
        address owner;                // Current owner
        uint256 amount;               // Physical quantity
        string idLocal;               // Physical location
        bytes32[] dataHashes;         // Hashes of sensitive data
        AssetStatus status;           // Current status
        AssetOperation operation;     // Operation performed
        uint256 createdAt;            // Creation timestamp
        uint256 lastUpdated;          // Last update timestamp
        
        // Grouping relationships
        bytes32[] groupedAssets;      // If this is a group, list of grouped assets
        bytes32 groupedBy;            // If this asset is grouped, reference to group
        
        // Transfer tracking
        address originOwner;          // Original owner (for transfer operations)
        string[] externalIds;         // External system references
    }

    /**
     * Input for creating new assets
     */
    struct CreateAssetInput {
        bytes32 assetId;              // Asset identifier
        bytes32 channelName;          // Channel for permissions
        uint256 amount;               // Initial amount
        string idLocal;               // Initial location
        bytes32[] dataHashes;         // Hashes of schema data
        string[] externalIds;         // External references (optional)
    }

    /**
     * Input for updating existing assets
     */
    struct UpdateAssetInput {
        bytes32 assetId;              // Asset to update
        bytes32 channelName;          // Channel for permissions
        string idLocal;               // New location
        uint256 amount;               // New amount (optional)
        bytes32[] dataHashes;         // New data hashes
    }

    /**
     * Input for transferring assets
     */
    struct TransferAssetInput {
        bytes32 assetId;              // Asset to transfer
        bytes32 channelName;          // Channel for permissions
        address newOwner;             // New owner address
        string idLocal;               // New location (optional)
        bytes32[] dataHashes;         // Additional data hashes
        string[] externalIds;         // External tracking IDs
    }

    /**
     * Input for transforming assets
     */
    struct TransformAssetInput {
        bytes32 assetId;              // Asset to transform
        bytes32 newProcessId;         // New process for transformed asset
        bytes32 channelName;          // Channel for permissions
        uint256 amount;               // Amount for new asset
        string idLocal;               // Location for new asset
        bytes32[] dataHashes;         // Data for new asset
    }

    /**
     * Input for splitting assets
     */
    struct SplitAssetInput {
        bytes32 assetId;              // Asset to split
        bytes32 channelName;          // Channel for permissions
        uint256[] amounts;            // Amounts for each new asset
        string idLocal;               // Location for new assets
        bytes32[][] dataHashes;      // Data hashes for each new asset
    }

    /**
     * Input for grouping assets
     */
    struct GroupAssetsInput {
        bytes32[] assetIds;           // Assets to group
        bytes32 channelName;          // Channel for permissions
        uint256 amount;               // Amount for group asset
        string idLocal;               // Location for group asset
        bytes32[] dataHashes;         // Data for group asset
    }
    
    // =============================================================
    //                        EVENTS
    // =============================================================

    /**
     * Emitted when a new asset is created
     */
    event AssetCreated(
        bytes32 indexed channelName,
        bytes32 indexed assetId,
        address indexed owner,
        uint256 amount,
        string idLocal,
        uint256 timestamp
    );

    /**
     * Emitted when an asset is updated
     */
    event AssetUpdated(
        bytes32 indexed channelName,
        bytes32 indexed assetId,
        address indexed owner,
        uint256 newAmount,
        string newLocation,
        uint256 timestamp
    );

    /**
     * Emitted when an asset is transferred
     */
    event AssetTransferred(
        bytes32 indexed channelName,
        bytes32 indexed assetId,
        address indexed fromOwner,
        address toOwner,
        string newLocation,
        uint256 timestamp
    );

    /**
     * Emitted when an asset is transformed
     */
    event AssetTransformed(
        bytes32 indexed originalAssetId,
        bytes32 indexed newAssetId,
        address indexed owner,
        bytes32 newProcessId,
        uint256 timestamp
    );

    /**
     * Emitted when an asset is split
     */
    event AssetSplit(
        bytes32 indexed originalAssetId,
        bytes32[] newAssetIds,
        address indexed owner,
        uint256[] amounts,
        uint256 timestamp
    );

    /**
     * Emitted when assets are grouped
     */
    event AssetsGrouped(
        bytes32[] indexed originalAssetIds,
        bytes32 indexed groupAssetId,
        address indexed owner,
        uint256 totalAmount,
        uint256 timestamp
    );

    /**
     * Emitted when assets are ungrouped
     */
    event AssetsUngrouped(
        bytes32 indexed groupAssetId,
        bytes32[] originalAssetIds,
        address indexed owner,
        uint256 timestamp
    );

    /**
     * Emitted when an asset is inactivated
     */
    event AssetInactivated(
        bytes32 indexed assetId,
        address indexed owner,
        AssetOperation lastOperation,
        uint256 timestamp
    );

    
    // =============================================================
    //                        ERRORS
    // =============================================================

    error InvalidAssetId(bytes32 channelName, bytes32 assetId);
    error AssetNotFound(bytes32 channelName, bytes32 assetId);
    error AssetNotActive(bytes32 channelName, bytes32 assetId);
    error AssetAlreadyExists(bytes32 assetId);
    error NotAssetOwner(bytes32 channelName, bytes32 assetId, address caller);
    error InvalidAmount(uint256 amount);
    error ProcessValidationFailed(bytes32 channelName, bytes32 processId);
    error TransferToSameOwner(bytes32 channelName, bytes32 assetId, address newOwner);
    error EmptyDataHashes();
    error EmptyLocation();

    // =============================================================
    //                    ASSET REGISTRY
    // =============================================================

    /**
     * Create a new asset
     * @param input Asset creation parameters
     */
    function createAsset(CreateAssetInput calldata input) external;

    /**
     * Update an existing asset
     * @param input Asset update parameters
     */
    function updateAsset(UpdateAssetInput calldata input) external;

    /**
     * Transfer asset ownership
     * @param input Transfer parameters
     */
    function transferAsset(TransferAssetInput calldata input) external;

    /**
     * Transform asset into a new asset
     * @param input Transform parameters
     * @return newAssetId Identifier for the transformed asset
     */
    function transformAsset(TransformAssetInput calldata input) 
        external returns (bytes32 newAssetId);

    /**
     * Split asset into multiple assets
     * @param input Split parameters
     * @return newAssetIds Array of new asset identifiers
     */
    function splitAsset(SplitAssetInput calldata input) 
        external returns (bytes32[] memory newAssetIds);

    /**
     * Group multiple assets into one
     * @param input Group parameters
     * @return groupAssetId Identifier for the group asset
     */
    function groupAssets(GroupAssetsInput calldata input) 
        external returns (bytes32 groupAssetId);

    /**
     * Ungroup assets back to originals
     * @param assetId Group asset to ungroup
     * @param channelName Channel for permissions
     * @param dataHashes Additional data for ungrouped assets
     * @return ungroupedAssetIds Array of ungrouped asset identifiers
     */
    function ungroupAssets(
        bytes32 assetId, 
        bytes32 channelName,
        bytes32[] calldata dataHashes
    ) external returns (bytes32[] memory ungroupedAssetIds);

    /**
     * Permanently inactivate an asset
     * @param assetId Asset to inactivate
     * @param channelName Channel for permissions
     * @param dataHashes Final data hashes
     */
    function inactivateAsset(
        bytes32 assetId,
        bytes32 channelName,
        bytes32[] calldata dataHashes
    ) external;

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * Get asset details
     * @param channelName Channel name
     * @param assetId Asset identifier
     * @return asset Asset data
     */
    function getAsset(bytes32 channelName, bytes32 assetId) 
        external view returns (Asset memory asset);

    /**
     * Check if asset exists and is active
     * @param channelName Channel name
     * @param assetId Asset identifier
     * @return active True if asset exists and is active
     */
    function isAssetActive(bytes32 channelName, bytes32 assetId) 
        external view returns (bool active);

    /**
     * Get assets owned by an address
     * @param owner Owner address
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     * @return assetIds Array of asset identifiers
     * @return totalAssets Total number of assets owned
     * @return hasNextPage True if there are more pages
     */
    function getAssetsByOwner(
        address owner,
        uint256 page,
        uint256 pageSize
    ) external view returns (
        bytes32[] memory assetIds,
        uint256 totalAssets,
        bool hasNextPage
    );

    /**
     * Get asset transaction history
     * @param channelName Channel name
     * @param assetId Asset identifier
     * @return operations Array of operations performed
     * @return timestamps Array of operation timestamps
     */
    function getAssetHistory(bytes32 channelName, bytes32 assetId) 
        external view returns (
            AssetOperation[] memory operations,
            uint256[] memory timestamps
        );

    /**
     * Get assets by status
     * @param status Asset status to filter by
     * @param page Page number (1-indexed)
     * @param pageSize Number of items per page
     * @return assetIds Array of asset identifiers
     * @return totalAssets Total number of assets with status
     * @return hasNextPage True if there are more pages
     */
    function getAssetsByStatus(
        AssetStatus status,
        uint256 page,
        uint256 pageSize
    ) external view returns (
        bytes32[] memory assetIds,
        uint256 totalAssets,
        bool hasNextPage
    );
}