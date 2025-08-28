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
        CREATE,      // Initial asset creation - 0
        UPDATE,      // Register asset - 1
        TRANSFER,    // Transfer ownership - 2
        TRANSFERIN,  // Transfer inner - 3
        SPLIT,       // Split into multiple assets - 4
        GROUP,       // Group multiple assets into one - 5
        UNGROUP,     // Ungroup assets back to originals - 6
        TRANSFORM,   // Transform to new asset type - 7
        INACTIVATE,  // Permanently inactivate asset - 8
        CREATE_DOCUMENT, //Create document - 9
        DATA_SHEET_ASSET, //Data sheet - 10
        PARTIALLY_CONSUMED_ASSET //Partially consumed - 11
    }

    // =============================================================
    //                        STRUCTS
    // =============================================================
    
    struct Asset {
        bytes32 assetId;              // Unique sequential asset ID
        address owner;                // Current owner
        string location;              // Physical location
        uint256 amount;               // Physical quantity
        bytes32 dataHash;             // Hash of sensitive data
        
        AssetStatus status;           // Current status
        AssetOperation operation;     // Operation performed
        
        uint256 createdAt;            // Creation timestamp
        uint256 lastUpdated;          // Last update timestamp
        
        // Grouping relationships
        bytes32[] groupedAssets;      // If this is a group, list of grouped assets
        bytes32 groupedBy;            // If this asset is grouped, reference to group
        
        // Transfer tracking
        address originOwner;          // Original owner (for transfer operations)
        string externalId;            // External system references

        //Transformation tracking
        bytes32 parentAssetId;      // Asset that was transformed (0x0 if original)
        bytes32 transformationId;    // Transformation ID ("" if original)
        bytes32[] childAssets;      // Assets that were transformed from the original (parentAssetId)
    }

    /**
     * Input for creating new assets
     */
    struct CreateAssetInput {
        bytes32 assetId;              // Asset identifier
        bytes32 channelName;          // Channel for permissions
        string location;              // Initial location
        uint256 amount;               // Initial amount
        bytes32 dataHash;             // Hashes of schema data
        string externalId;            // External references (optional)
    }

    /**
     * Input for updating existing assets
     */
    struct UpdateAssetInput {
        bytes32 assetId;              // Asset to update
        bytes32 channelName;          // Channel for permissions
        string newLocation;          // New location
        uint256 newAmount;           // New amount (optional)
        bytes32 dataHash;            // New data hash
    }

    /**
     * Input for transferring assets
     */
    struct TransferAssetInput {
        bytes32 assetId;              // Asset to transfer
        bytes32 channelName;          // Channel for permissions
        address newOwner;             // New owner address
        string newLocation;           // New location (optional)
        uint256 newAmount;            // New amount (optional)
        bytes32 dataHash;             // Additional data hash
        string externalId;            // External tracking ID
    }

    /**
     * Input for transforming assets
     */
    struct TransformAssetInput {
        bytes32 assetId;              // Asset to transform
        bytes32 newAssetId;           // Transformation ID for tracking free form data (eg. "BEEF-PROCESSING")
        bytes32 channelName;          // Channel for permissions
        string newLocation;           // Location for new asset
        uint256 newAmount;            // Amount for new asset
    }

    /**
     * Input for splitting assets
     */
    struct SplitAssetInput {
        bytes32 assetId;              // Asset to split
        bytes32 channelName;          // Channel for permissions
        uint256[] amounts;            // Amounts for each new asset
        string location;              // Location for new assets
        bytes32[] dataHashes;         // A data hash for each new asset
    }

    /**
     * Input for grouping assets
     */
    struct GroupAssetsInput {
        bytes32[] assetIds;           // Assets to group
        bytes32 groupAssetId;         // Group identifier
        bytes32 channelName;          // Channel for permissions
        string location;              // Location for group asset
        bytes32 dataHash;             // Data hash
    }

    /**
     * Input for ungrouping assets
     */
    struct UngroupAssetsInput {
        bytes32 assetId;           // Group asset to ungroup
        bytes32 channelName;       // Channel permissions
        string location;           // New location (empty = no change)
        bytes32 dataHash;          // Single hash for all ungrouped assets
    }

    /**
     * Input for inactivating assets
     */
    struct InactivateAssetInput {
        bytes32 assetId;           // Asset to inactivate
        bytes32 channelName;       // Channel permissions  
        string finalLocation;      // Final location (empty = no change)
        bytes32 finalDataHash;     // Final data hash (0x0 = no data)
    }

    // =============================================================
    //                    RELATIONSHIP TYPES
    // =============================================================

    /**
     * @notice Enumeration of asset relationship types for lineage tracking
     */
    enum RelationshipType {
        SPLIT,           // Child came from splitting parent
        TRANSFORM,       // Child is transformation of parent
        GROUP_COMPONENT, // Child is component of a group (parent is group)
        UNGROUP          // Child reactivated from group dissolution
    }

    // =============================================================
    //                    LINEAGE STRUCTURES
    // =============================================================

    /**
    * @notice Structure to represent asset lineage information
    */
    struct LineageNode {
        bytes32 assetId;
        bytes32[] parents;
        bytes32[] children;
        uint8 depth;
        RelationshipType relationshipType;
        uint256 timestamp;
    }

    /**
    * @notice Structure for complex asset composition tracking
    */
    struct AssetCompositionData {
        bytes32[] componentAssets;
        uint256[] componentAmounts;
        uint256[] componentPercentages;
        uint256 lastUpdated;
        bool isActive;
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
        string location,
        uint256 amount,
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
        string previousLocation,
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
        bytes32[] originalAssetIds,
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
    //                    ENHANCED EVENTS
    // =============================================================

    /**
     * @notice Emitted when a parent-child relationship is established between assets
     * @param channelName The channel where the assets exist
     * @param childAssetId The ID of the child asset
     * @param parentAssetId The ID of the parent asset
     * @param relationshipType Type of relationship: 0=SPLIT, 1=TRANSFORM, 2=GROUP_COMPONENT
     * @param timestamp When the relationship was established
     */
    event AssetLineage(
        bytes32 indexed channelName,
        bytes32 indexed childAssetId,
        bytes32 indexed parentAssetId,
        uint8 relationshipType,  // SPLIT, TRANSFORM, GROUP_COMPONENT only
        uint256 timestamp
    );

    /**
     * @notice Emitted when multiple assets are related in a single operation
     * @param channelName The channel where the operation occurred
     * @param primaryAssetId The main asset involved (e.g., group asset or split origin)
     * @param relatedAssets Array of related asset IDs
     * @param operationType The operation type that created this relationship
     * @param blockNumber Block when the relationship was created
     */
    event AssetRelationship(
        bytes32 indexed channelName,
        bytes32 indexed primaryAssetId,
        bytes32[] relatedAssets,
        uint8 operationType,
        uint256 blockNumber
    );

    /**
     * @notice Emitted when an asset's composition changes (for complex blends)
     * @param channelName The channel where the asset exists
     * @param assetId The asset whose composition changed
     * @param componentAssets Array of component asset IDs
     * @param componentAmounts Array of amounts for each component
     * @param timestamp When the composition was recorded
     */
    event AssetComposition(
        bytes32 indexed channelName,
        bytes32 indexed assetId,
        bytes32[] componentAssets,
        uint256[] componentAmounts,
        uint256 timestamp
    );

    /**
     * @notice Emitted when an asset reaches a specific depth in the transformation chain
     * @param channelName The channel where the asset exists
     * @param assetId The asset ID
     * @param depth The depth level (0 = origin, 1+ = transformations)
     * @param originAssets Array of origin asset IDs that this asset traces back to
     */
    event AssetDepthCalculated(
        bytes32 indexed channelName,
        bytes32 indexed assetId,
        uint8 depth,
        bytes32[] originAssets
    );


    // CUSTODY TRACKING (Ownership changes)  
    event AssetCustodyChanged(
        bytes32 indexed channelName,
        bytes32 indexed assetId,
        address indexed previousOwner,
        address newOwner,
        string newLocation,
        uint256 timestamp
    );

    // STATE TRACKING (Metadata changes)
    event AssetStateChanged(
        bytes32 indexed channelName,
        bytes32 indexed assetId,
        string previousLocation,
        string newLocation,
        uint256 previousAmount,
        uint256 newAmount,
        uint256 timestamp
    );

    // COMPOSITION TRACKING
    event AssetCompositionDissolved(
        bytes32 indexed channelName,
        bytes32 indexed groupAssetId,
        bytes32[] dissolvedAssets,
        uint256 timestamp
    );

    // COMPOSITION TRACKING (SPLIT)
    event AssetSplitComposition(
        bytes32 indexed channelName,
        bytes32 indexed originalAssetId,
        bytes32[] splitAssets,
        uint256[] splitAmounts,
        uint256 timestamp
    );

    
    // =============================================================
    //                        ERRORS
    // =============================================================

    error InvalidAssetId(bytes32 channelName, bytes32 assetId);
    error AssetNotFound(bytes32 channelName, bytes32 assetId);
    error AssetNotActive(bytes32 channelName, bytes32 assetId);
    error AssetAlreadyExists(bytes32 channelName,bytes32 assetId);
    error NotAssetOwner(bytes32 channelName, bytes32 assetId, address caller);
    error InvalidGroupAmount(uint256 amount);
    error TransferToSameOwner(bytes32 channelName, bytes32 assetId, address newOwner);
    error EmptyLocation();
    error EmptyAmountsArray();
    error ArrayLengthMismatch();
    error InvalidSplitAmount(uint256 amount);
    error SplitAmountTooSmall(uint256 amount, uint256 minimum);
    error AmountConservationViolated(uint256 original, uint256 totalSplit);
    error InsufficientAssetsToGroup(uint256 provided, uint256 minimum);
    error GroupAssetAlreadyExists(bytes32 groupAssetId);
    error DuplicateAssetsInGroup();
    error SelfReferenceInGroup(bytes32 assetId);
    error MixedOwnershipNotAllowed(address expected, address found);
    error AssetNotGrouped(bytes32 assetId);
    error AssetAlreadyUngrouped(bytes32 assetId);
    error GroupedAssetNotFound(bytes32 groupAssetId, bytes32 childAssetId);
    error TransformationChainTooDeep(uint256 current, uint256 maximum);
    error InsufficientSplitParts(uint256 provided, uint8 minimum);
    error TooManyAssetsForDuplicateCheck(uint256 provided, uint256 maximum);
    error OnlyTransactionOrchestrator();
    error InvalidGroupRelationship(bytes32 childAssetId, bytes32 expectedGroupId);
    error GroupedAssetNotInactive(bytes32 childAssetId);

    // =============================================================
    //                    ASSET REGISTRY
    // =============================================================

    /**
     * Create a new asset
     * @param input Asset creation parameters
     * @param originCaller Origin caller
     */
    function createAsset(CreateAssetInput calldata input, address originCaller) external;

    /**
     * Update an existing asset
     * @param input Asset update parameters
     * @param originCaller Origin caller
     */
    function updateAsset(UpdateAssetInput calldata input, address originCaller) external;

    /**
     * Transfer asset ownership
     * @param input Transfer parameters
     * @param originCaller Origin caller
     */
    function transferAsset(TransferAssetInput calldata input, address originCaller) external;

    /**
     * Transform asset into a new asset
     * @param input Transform parameters
     * @param originCaller Origin caller
     */
    function transformAsset(TransformAssetInput calldata input, address originCaller) external;

    /**
     * Split asset into multiple assets
     * @param input Split parameters
     * @param originCaller Origin caller
     */
    function splitAsset(SplitAssetInput calldata input, address originCaller) external;

    /**
     * Group multiple assets into one
     * @param input Group parameters
     * @param originCaller Origin caller
     */
    function groupAssets(GroupAssetsInput calldata input, address originCaller) external;

    /**
     * Ungroup assets back to originals
     * @param input Ungroup parameters
     * @param originCaller Origin caller
     */

    function ungroupAssets(UngroupAssetsInput calldata input, address originCaller) external;

    /**
     * Permanently inactivate an asset
     * @param input Inactivate parameters
     * @param originCaller Origin caller
     */
    function inactivateAsset(InactivateAssetInput calldata input, address originCaller) external;

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
}