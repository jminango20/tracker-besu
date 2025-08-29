// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {IAssetRegistry} from "./interfaces/IAssetRegistry.sol";
import {IProcessRegistry} from "./interfaces/IProcessRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    DEFAULT_ADMIN_ROLE,
    TRANSACTION_ORCHESTRATOR,
    ASSET_ADMIN_ROLE,
    MIN_SPLIT_AMOUNT,
    MIN_GROUP_SIZE,
    MAX_TRANSFORMATION_DEPTH
} from "./lib/Constants.sol";
import {Utils} from "./lib/Utils.sol";
import {ChannelAccess} from "./lib/ChannelAccess.sol";

/**
 * @title AssetRegistry
 * @notice Contract for managing asset lifecycle in the trace system
 */
contract AssetRegistry is Context, BaseTraceContract, IAssetRegistry {

    // =============================================================
    //                        STORAGE
    // =============================================================

    /**
     * Mapping to store assets by ID and channel
     * @dev channelName => assetId => Asset
     */
    mapping(bytes32 => mapping(bytes32 => Asset)) private _assetsByChannel;
    
    /**
     * Modifier to check if the caller is the transaction orchestrator
     */
    modifier onlyTransactionOrchestrator() {
        address orchestratorAddress = _getAddressDiscovery().getContractAddress(TRANSACTION_ORCHESTRATOR);
        if (_msgSender() != orchestratorAddress) {
            revert OnlyTransactionOrchestrator();
        }
        _;
    }
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
    function createAsset(CreateAssetInput calldata input, address originCaller) 
        external
        nonReentrant
        onlyTransactionOrchestrator()
        validChannelName(input.channelName)
        onlyChannelMemberAddress(input.channelName, originCaller)
    {

        _validateCreateAssetInput(input);
        _validateAssetNotExists(input.channelName, input.assetId);
        _performAssetCreate(input, originCaller);
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function updateAsset(UpdateAssetInput calldata update, address originCaller) 
        external
        nonReentrant
        onlyTransactionOrchestrator()
        validChannelName(update.channelName)
        onlyChannelMemberAddress(update.channelName, originCaller)
    { 
        _validateUpdateAssetInput(update);
        _performAssetUpdate(update, originCaller);
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function transferAsset(TransferAssetInput calldata transfer, address originCaller) 
        external
        nonReentrant 
        onlyTransactionOrchestrator()
        validChannelName(transfer.channelName)
        onlyChannelMemberAddress(transfer.channelName, originCaller)
    {
        _validateTransferAssetInput(transfer);
        _performAssetTransfer(transfer, originCaller);
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function transformAsset(TransformAssetInput calldata transform, address originCaller) 
        external
        nonReentrant
        onlyTransactionOrchestrator()
        validChannelName(transform.channelName)
        onlyChannelMemberAddress(transform.channelName, originCaller)
    {
        _validateTransformAssetInput(transform);
        _performAssetTransform(transform, originCaller);
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function splitAsset(SplitAssetInput calldata split, address originCaller) 
        external
        nonReentrant
        onlyTransactionOrchestrator()
        validChannelName(split.channelName)
        onlyChannelMemberAddress(split.channelName, originCaller)
    {
        _validateSplitAssetInput(split);
        _performAssetSplit(split, originCaller);
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function groupAssets(GroupAssetsInput calldata group, address originCaller) 
        external
        nonReentrant
        onlyTransactionOrchestrator()
        validChannelName(group.channelName)
        onlyChannelMemberAddress(group.channelName, originCaller)
    {
        _validateGroupAssetsInput(group);
        _performAssetGroup(group, originCaller);
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function ungroupAssets(UngroupAssetsInput calldata ungroup, address originCaller) 
        external
        nonReentrant
        onlyTransactionOrchestrator()
        validChannelName(ungroup.channelName)
        onlyChannelMemberAddress(ungroup.channelName, originCaller)
    {
        
        _validateUngroupAssetsInput(ungroup);
        _performAssetUngroup(ungroup, originCaller);
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function inactivateAsset(InactivateAssetInput calldata inactivate, address originCaller) 
        external 
        nonReentrant
        onlyTransactionOrchestrator()
        validChannelName(inactivate.channelName)
        onlyChannelMemberAddress(inactivate.channelName, originCaller)
    {
        _validateInactivateAssetInput(inactivate);
        _performAssetInactivate(inactivate, originCaller);
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
        //assetExists(channelName, assetId)
        returns (Asset memory) 
    {
        Asset storage asset = _getExistingAsset(channelName, assetId);
        return asset;
    }

    // =============================================================
    //                    VALIDATION FUNCTIONS
    // =============================================================
    function _validateCreateAssetInput(CreateAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.location);
    }

    function _validateUpdateAssetInput(UpdateAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.newLocation);
    }

    function _validateTransferAssetInput(TransferAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.newLocation);
        if (input.newOwner == address(0)) revert InvalidAddress(input.newOwner);
    }

    function _validateTransformAssetInput(TransformAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.newLocation);
        if (input.newAssetId == bytes32(0)) revert InvalidAssetId(input.channelName, input.newAssetId);
    }

    function _validateSplitAssetInput(SplitAssetInput calldata input) internal pure {
        if (input.assetId == bytes32(0)) revert InvalidAssetId(input.channelName, input.assetId);
        if (bytes(input.location).length == 0) revert EmptyLocation();        
        if (input.amounts.length < 2) revert InsufficientSplitParts(input.amounts.length, 2);
        if (input.amounts.length != input.dataHashes.length) revert ArrayLengthMismatch();
        
        // Validar cada amount individual
        for (uint256 i = 0; i < input.amounts.length; i++) {
            if (input.amounts[i] < MIN_SPLIT_AMOUNT) {
                revert SplitAmountTooSmall(input.amounts[i], MIN_SPLIT_AMOUNT);
            }
        }
    }

    function _validateGroupAssetsInput(GroupAssetsInput calldata input) internal view {
        if (input.groupAssetId == bytes32(0)) revert InvalidAssetId(input.channelName, input.groupAssetId);
        if (bytes(input.location).length == 0) revert EmptyLocation();        
        if (input.assetIds.length < MIN_GROUP_SIZE) {
            revert InsufficientAssetsToGroup(input.assetIds.length, MIN_GROUP_SIZE);
        }

        _validateAssetNotExists(input.channelName, input.groupAssetId);
        
        // Verificar duplicatas nos assets
        if (_hasDuplicateAssets(input.assetIds)) { //TODO - Fazer off-chain
            revert DuplicateAssetsInGroup();
        }
        
        // Verificar auto-referência
        for (uint256 i = 0; i < input.assetIds.length; i++) {
            if (input.assetIds[i] == input.groupAssetId) {
                revert SelfReferenceInGroup(input.assetIds[i]);
            }
        }
    }

    function _validateUngroupAssetsInput(UngroupAssetsInput calldata input) internal pure {
        if (input.assetId == bytes32(0)) revert InvalidAssetId(input.channelName, input.assetId);
    }

    function _validateCanUngroup(Asset storage groupAsset) internal view {
        if (groupAsset.groupedAssets.length == 0) {
            revert AssetNotGrouped(groupAsset.assetId);
        }
        
        if (groupAsset.operation == AssetOperation.UNGROUP) {
            revert AssetAlreadyUngrouped(groupAsset.assetId);
        }

        if (groupAsset.operation != AssetOperation.GROUP) {
            revert AssetNotGrouped(groupAsset.assetId);
        }
    }

    function _validateInactivateAssetInput(InactivateAssetInput calldata input) internal pure {
        if (input.assetId == bytes32(0)) {
            revert InvalidAssetId(input.channelName, input.assetId);
        }       
    }

    function _validateCommonAssetFields(
        bytes32 assetId,
        bytes32 channelName,
        string calldata location
    ) internal pure {
        if (assetId == bytes32(0)) revert InvalidAssetId(channelName, assetId);
        if (bytes(location).length == 0) revert EmptyLocation();
    }

    function _validateAssetNotExists(bytes32 channelName, bytes32 assetId) internal view {
        Asset storage asset = _assetsByChannel[channelName][assetId];
        if (asset.owner != address(0)) {
            revert AssetAlreadyExists(channelName, assetId);
        }
    }

    function _getExistingAsset(bytes32 channelName, bytes32 assetId) internal view returns (Asset storage) {
        Asset storage asset = _assetsByChannel[channelName][assetId];
        if (asset.owner == address(0)) {
            revert AssetNotFound(channelName, assetId);
        }
        return asset;
    }
    
    function _validateAssetActive(Asset storage asset) internal view {
        if (asset.status != AssetStatus.ACTIVE) {
            revert AssetNotActive(asset.channelName, asset.assetId);
        }
    }
    
    function _validateAssetOwner(Asset storage asset, address originCaller) internal view {
        if (asset.owner != originCaller) {
            revert NotAssetOwner(asset.channelName, asset.assetId, originCaller);
        }
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================
    function _performAssetCreate(CreateAssetInput calldata input, address originCaller) internal {

        // Create asset structure
        Asset storage newAsset = _assetsByChannel[input.channelName][input.assetId];

        newAsset.assetId = input.assetId;
        newAsset.channelName = input.channelName;
        newAsset.owner = originCaller;
        newAsset.location = input.location;
        newAsset.amount = input.amount;
        newAsset.dataHash = input.dataHash;
        newAsset.status = AssetStatus.ACTIVE;
        newAsset.operation = AssetOperation.CREATE;
        newAsset.createdAt = Utils.timestamp();
        newAsset.lastUpdated = Utils.timestamp();
        newAsset.originOwner = originCaller;
        newAsset.externalId = input.externalId;

        emit AssetCreated(
            input.channelName,
            input.assetId,
            originCaller,
            input.location,
            input.amount,
            Utils.timestamp()
        );

        emit AssetLineage(
            input.channelName,
            input.assetId,
            bytes32(0), // No parent for created assets
            uint8(RelationshipType.CREATE),
            Utils.timestamp()
        );
    }      

    function _performAssetUpdate(UpdateAssetInput calldata input, address originCaller) internal {

        Asset storage asset = _getExistingAsset(input.channelName, input.assetId);

        _validateAssetActive(asset);
        _validateAssetOwner(asset, originCaller);
        
        // Store current state for events
        string memory currentLocation = asset.location;
        uint256 currentAmount = asset.amount;
        
        // Update core state
        asset.location = input.newLocation;
        if (input.newAmount > 0) {
            asset.amount = input.newAmount;
        }
        asset.operation = AssetOperation.UPDATE;
        asset.lastUpdated = Utils.timestamp();
        asset.dataHash = input.dataHash;
        
        emit AssetUpdated(
            input.channelName,
            input.assetId,
            asset.owner,
            asset.amount,
            asset.location,
            Utils.timestamp()
        );

        // Track state changes for genealogy
        emit AssetStateChanged(
            input.channelName,
            input.assetId,
            currentLocation,
            asset.location,
            currentAmount,
            asset.amount,
            Utils.timestamp()
        );
    }

    function _performAssetTransfer(TransferAssetInput calldata input, address originCaller) internal {
        Asset storage asset = _getExistingAsset(input.channelName, input.assetId);
        
        _validateAssetActive(asset);
        _validateAssetOwner(asset, originCaller);
        
        if (asset.owner == input.newOwner) {
            revert TransferToSameOwner(input.channelName, input.assetId, input.newOwner);
        }

        ChannelAccess.requireMember(_getAddressDiscovery(), input.channelName, input.newOwner);

        address currentOwner = asset.owner;
        string memory currentLocation = asset.location;
        uint256 currentAmount = asset.amount;

        //Update core state
        asset.owner = input.newOwner;   
        asset.location = input.newLocation;
        asset.amount = input.newAmount;
        asset.dataHash = input.dataHash;
        asset.externalId = input.externalId;
        asset.operation = AssetOperation.TRANSFER;
        asset.lastUpdated = Utils.timestamp();

        emit AssetTransferred(
            input.channelName,
            input.assetId,
            currentOwner,
            input.newOwner,
            currentLocation,
            input.newLocation,
            currentAmount,
            input.newAmount,
            Utils.timestamp()
        );

        emit AssetCustodyChanged(
            input.channelName,
            input.assetId,
            currentOwner,
            input.newOwner,
            input.newLocation,
            Utils.timestamp()
        );
    }

    function _performAssetTransform(TransformAssetInput calldata input, address originCaller) internal {

        Asset storage originalAsset = _getExistingAsset(input.channelName, input.assetId);
        _validateAssetActive(originalAsset);
        _validateAssetOwner(originalAsset, originCaller);
        
        uint256 currentDepth = _getTransformationDepth(input.channelName, input.assetId);
        if (currentDepth + 1 > MAX_TRANSFORMATION_DEPTH) {
            revert TransformationChainTooDeep(currentDepth + 1, MAX_TRANSFORMATION_DEPTH);
        }

        _validateAssetNotExists(input.channelName, input.newAssetId);

        //2. Inativar original asset  
        originalAsset.status = AssetStatus.INACTIVE;
        originalAsset.operation = AssetOperation.TRANSFORM;
        originalAsset.lastUpdated = Utils.timestamp();
        originalAsset.childAssets.push(input.newAssetId);

        //3. Criar Novo Asset
        Asset storage newAsset = _assetsByChannel[input.channelName][input.newAssetId];
        newAsset.assetId = input.newAssetId;
        newAsset.channelName = input.channelName;
        newAsset.owner = originalAsset.owner;   //Herda
        newAsset.location = input.newLocation;
        newAsset.amount = input.newAmount == 0 ? originalAsset.amount : input.newAmount;
        newAsset.status = AssetStatus.ACTIVE;
        newAsset.operation = AssetOperation.TRANSFORM;
        newAsset.createdAt = Utils.timestamp();
        newAsset.lastUpdated = Utils.timestamp();
        newAsset.originOwner = originalAsset.originOwner;
        newAsset.dataHash = originalAsset.dataHash;
        newAsset.externalId = originalAsset.externalId;   
        newAsset.parentAssetId = input.assetId;
        newAsset.transformationId = input.newAssetId;

        for (uint256 i = 0; i < originalAsset.groupedAssets.length; i++) {
            newAsset.groupedAssets.push(originalAsset.groupedAssets[i]);
        }

        newAsset.groupedBy = originalAsset.groupedBy;

        emit AssetTransformed(
            input.assetId,
            input.newAssetId,
            newAsset.owner,
            Utils.timestamp()
        );

        emit AssetLineage(
            input.channelName,
            input.newAssetId,
            input.assetId,
            uint8(RelationshipType.TRANSFORM),
            Utils.timestamp()
        );
    }

    function _performAssetSplit(SplitAssetInput calldata input, address originCaller) internal {

        Asset storage originalAsset = _getExistingAsset(input.channelName, input.assetId);
        _validateAssetActive(originalAsset);
        _validateAssetOwner(originalAsset, originCaller);
        
        //1. Validar conservação da quantidade (amount)
        uint256 totalSplitAmount = 0;
        for (uint256 i = 0; i < input.amounts.length; i++) {
                totalSplitAmount += input.amounts[i];
        }
        
        if (totalSplitAmount != originalAsset.amount) {
            revert AmountConservationViolated(originalAsset.amount, totalSplitAmount);
        }

        //2. Inativar original asset
        originalAsset.status = AssetStatus.INACTIVE;
        originalAsset.operation = AssetOperation.SPLIT;
        originalAsset.lastUpdated = Utils.timestamp();

        //3. Criar novos assets filhos
        bytes32[] memory newAssetIds = new bytes32[](input.amounts.length);

        for (uint256 i = 0; i < input.amounts.length; i++) {
            bytes32 newAssetId = _generateSplitAssetId(input.assetId, i, input.channelName);
            _validateAssetNotExists(input.channelName, newAssetId);
            
            Asset storage newAsset = _assetsByChannel[input.channelName][newAssetId];
            
            newAsset.assetId = newAssetId;
            newAsset.channelName = input.channelName;
            newAsset.owner = originalAsset.owner;           // Herda owner
            newAsset.amount = input.amounts[i];            // Amount específico
            newAsset.location = input.location;            // Nova localização
            newAsset.dataHash = input.dataHashes[i];
            newAsset.originOwner = originalAsset.owner;
            newAsset.externalId = originalAsset.externalId;
            newAsset.parentAssetId = input.assetId;
            newAsset.transformationId = _generateSplitTransformationId(i);
            newAsset.status = AssetStatus.ACTIVE;
            newAsset.operation = AssetOperation.SPLIT;
            newAsset.createdAt = Utils.timestamp();
            newAsset.lastUpdated = Utils.timestamp();
            
            newAssetIds[i] = newAssetId;
            originalAsset.childAssets.push(newAssetIds[i]);

            emit AssetLineage(
                input.channelName,
                newAssetId,
                input.assetId,
                uint8(RelationshipType.SPLIT),
                Utils.timestamp()
            );   
        }

        emit AssetSplit(
            input.assetId,
            newAssetIds,
            originalAsset.owner,
            input.amounts,
            Utils.timestamp()
        );

        // Critical for off-chain genealogy construction
        emit AssetComposition(
            input.channelName,
            input.assetId,
            newAssetIds,
            input.amounts,
            Utils.timestamp()
        );
    }

    function _performAssetGroup(GroupAssetsInput calldata input, address originCaller) internal {
        //Pre-validate ALL assets and calculate total (atomic validation)
        uint256 totalAmounts = 0;
        
        for (uint256 i = 0; i < input.assetIds.length; i++) {
            Asset storage asset = _getExistingAsset(input.channelName, input.assetIds[i]);
            _validateAssetActive(asset);
                        
            if (asset.owner != originCaller) {
                revert MixedOwnershipNotAllowed(originCaller, asset.owner);
            }
            
            totalAmounts += asset.amount;
        }

        if (totalAmounts == 0) {
            revert InvalidGroupAmount(totalAmounts);
        }

        //1. Inativar assets a serem agrupados
        for (uint256 i = 0; i < input.assetIds.length; i++) {
            Asset storage originalAsset = _assetsByChannel[input.channelName][input.assetIds[i]];
                        
            originalAsset.status = AssetStatus.INACTIVE;
            originalAsset.operation = AssetOperation.GROUP;
            originalAsset.groupedBy = input.groupAssetId;  
            originalAsset.lastUpdated = Utils.timestamp();            
        }

        //2. Criar asset de agrupamento
        Asset storage groupAsset = _assetsByChannel[input.channelName][input.groupAssetId];

        groupAsset.assetId = input.groupAssetId;   // User-defined ID
        groupAsset.channelName = input.channelName;
        groupAsset.owner = originCaller;           // Owner dos assets originais
        groupAsset.amount = totalAmounts;           // Total amount (já validado conservation)
        groupAsset.location = input.location;      // Localização do grupo
        groupAsset.status = AssetStatus.ACTIVE;
        groupAsset.operation = AssetOperation.GROUP;
        groupAsset.createdAt = Utils.timestamp();
        groupAsset.lastUpdated = Utils.timestamp();
        groupAsset.originOwner = originCaller;
        groupAsset.dataHash = input.dataHash;

        //2.1 Relacionar assets no grupo
        for (uint256 i = 0; i < input.assetIds.length; i++) {
            groupAsset.groupedAssets.push(input.assetIds[i]);

            emit AssetLineage(
                input.channelName,
                input.groupAssetId,
                input.assetIds[i],
                uint8(RelationshipType.GROUP_COMPONENT),
                Utils.timestamp()
            );
        }

        emit AssetsGrouped(
            input.assetIds,
            input.groupAssetId,
            originCaller,
            totalAmounts,
            Utils.timestamp()
        );
    }

    function _performAssetUngroup(UngroupAssetsInput calldata input, address originCaller) internal {

        Asset storage groupAsset = _getExistingAsset(input.channelName, input.assetId);

        _validateAssetActive(groupAsset);
        _validateAssetOwner(groupAsset, originCaller);

        if (groupAsset.groupedAssets.length == 0) {
            revert AssetNotGrouped(input.assetId);
        }

        bytes32[] memory ungroupedAssetIds = groupAsset.groupedAssets; // Array já existe!

        //Reactivate component assets
        for (uint256 i = 0; i < ungroupedAssetIds.length; i++) {
            Asset storage childAsset = _assetsByChannel[input.channelName][ungroupedAssetIds[i]];
            
            if (bytes(input.location).length > 0) {
                childAsset.location = input.location;
            }
            
            if (input.dataHash != bytes32(0)) {
                childAsset.dataHash = input.dataHash;
            }

            childAsset.groupedBy = bytes32(0);
            childAsset.channelName = input.channelName;
            childAsset.status = AssetStatus.ACTIVE;
            childAsset.operation = AssetOperation.UNGROUP;
            childAsset.lastUpdated = Utils.timestamp();

            emit AssetLineage(
                input.channelName,
                ungroupedAssetIds[i],
                input.assetId,
                uint8(RelationshipType.UNGROUP),
                Utils.timestamp()
            );
        }

        //Inactivate asset grupo   
        groupAsset.status = AssetStatus.INACTIVE;
        groupAsset.operation = AssetOperation.UNGROUP;
        groupAsset.lastUpdated = Utils.timestamp();

        emit AssetsUngrouped(
            input.assetId,
            ungroupedAssetIds,
            groupAsset.owner,
            Utils.timestamp()
        );
    }

    function _performAssetInactivate(InactivateAssetInput calldata input, address originCaller) internal {

        Asset storage asset = _getExistingAsset(input.channelName, input.assetId);
        
        _validateAssetActive(asset);
        _validateAssetOwner(asset, originCaller);
        
        if (bytes(input.finalLocation).length > 0) {
            asset.location = input.finalLocation;
        }
        
        if (input.finalDataHash != bytes32(0)) {
            asset.dataHash = input.finalDataHash;
        }
                
        asset.status = AssetStatus.INACTIVE;
        asset.operation = AssetOperation.INACTIVATE;
        asset.lastUpdated = Utils.timestamp();
                
        emit AssetInactivated(
            input.assetId,
            asset.owner,
            AssetOperation.INACTIVATE,
            Utils.timestamp()
        );
    }

    // =============================================================
    //                    INTERNAL HELPERS
    // =============================================================

    function _generateSplitAssetId(bytes32 originalAssetId, uint256 index, bytes32 channelName) 
        internal pure returns (bytes32) 
    {
        return keccak256(abi.encodePacked(
            originalAssetId, 
            index, 
            channelName,
            "SPLIT"
        ));
    }

    function _generateSplitTransformationId(uint256 index) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("SPLIT_", _uint2str(index + 1)));
}


    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        
        unchecked {
            while (j != 0) {
                bstr[--k] = bytes1(uint8(48 + j % 10));
                j /= 10;
            }
        }
        return string(bstr);
    }

    function _hasDuplicateAssets(bytes32[] calldata assetIds) internal pure returns (bool) {
        if (assetIds.length <= 1) return false;

        for (uint256 i = 0; i < assetIds.length; i++) {
            for (uint256 j = i + 1; j < assetIds.length; j++) {
                if (assetIds[i] == assetIds[j]) {
                    return true;
                }
            }
        }
        return false;
    }

    function _getTransformationDepth(
        bytes32 channelName, 
        bytes32 assetId
    ) internal view returns (uint256) {
        uint256 depth = 0;
        bytes32 currentId = assetId;
        
        while (currentId != bytes32(0) && depth < MAX_TRANSFORMATION_DEPTH) {
            Asset storage currentAsset = _assetsByChannel[channelName][currentId];
            if (currentAsset.owner == address(0)) break;

            currentId = currentAsset.parentAssetId;
            if (currentId != bytes32(0)) {
                depth++;
            }
        }
        
        return depth;
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
}
