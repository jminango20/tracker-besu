// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {IAssetRegistry} from "./interfaces/IAssetRegistry.sol";
import {IProcessRegistry} from "./interfaces/IProcessRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    DEFAULT_ADMIN_ROLE,
    PROCESS_REGISTRY,
    TRANSACTION_ORCHESTRATOR,
    MAX_PAGE_SIZE,
    FIRST_PAGE,
    INVALID_PAGE,
    ASSET_ADMIN_ROLE,
    MAX_SPLIT_COUNT,
    MIN_SPLIT_AMOUNT,
    MAX_GROUP_SIZE,
    MIN_GROUP_SIZE,
    MAX_GROUP_DATA_HASHES,
    MAX_DATA_HASHES,
    MAX_EXTERNAL_IDS,
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
     * Mapping to track asset existence by channel
     * @dev channelName => assetId => exists
     */
    mapping(bytes32 => mapping(bytes32 => bool)) private _assetExistsByChannel;    
    
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
        //assetExists(split.channelName, split.assetId)
        //assetActive(split.channelName, split.assetId)
        //onlyAssetOwner(split.channelName, split.assetId, originCaller)
    {
        /*
        _validateSplitAssetInput(split);

        Asset storage originalAsset = _assetsByChannel[split.channelName][split.assetId];
        
        //1. Validar conservação da quantidade (amount)
        uint256 totalSplitAmount = 0;
        for (uint256 i = 0; i < split.amounts.length; i++) {
            totalSplitAmount += split.amounts[i];
        }
        
        if (totalSplitAmount != originalAsset.amount) {
            revert AmountConservationViolated(originalAsset.amount, totalSplitAmount);
        }

        //2. Inativar original asset
        originalAsset.status = AssetStatus.INACTIVE;
        originalAsset.operation = AssetOperation.SPLIT;
        originalAsset.lastUpdated = Utils.timestamp();

        //3. Criar novos assets
        bytes32[] memory newAssetIds = new bytes32[](split.amounts.length);

        for (uint256 i = 0; i < split.amounts.length; i++) {
            bytes32 newAssetId = _generateSplitAssetId(split.assetId, i, split.channelName);
            
            // Verificar se ID gerado não existe (safety check)
            if (_assetExistsByChannel[split.channelName][newAssetId]) {
                revert AssetAlreadyExists(split.channelName, newAssetId);
            }
            
            Asset storage newAsset = _assetsByChannel[split.channelName][newAssetId];
            
            //PROPRIEDADES BÁSICAS
            newAsset.assetId = newAssetId;
            newAsset.owner = originalAsset.owner;           // Herda owner
            newAsset.amount = split.amounts[i];            // Amount específico
            newAsset.location = split.location;            // Nova localização
            
            //DADOS INDIVIDUAIS
            newAsset.dataHash = split.dataHashes[i];
            
            //TRACKING DE SPLIT
            newAsset.parentAssetId = split.assetId;
            // transformationId personalizado para split
            newAsset.transformationId = string(abi.encodePacked("SPLIT_", _uint2str(i + 1)));
            
            //METADATA
            newAsset.status = AssetStatus.ACTIVE;
            newAsset.operation = AssetOperation.SPLIT;
            newAsset.createdAt = Utils.timestamp();
            newAsset.lastUpdated = Utils.timestamp();
            newAsset.originOwner = originalAsset.owner;
            
            //REGISTRAR EXISTÊNCIA E INDEXAÇÃO
            _assetExistsByChannel[split.channelName][newAssetId] = true;
            
            newAssetIds[i] = newAssetId;

            _emitLineage(
                split.channelName,
                newAssetId,                 // child (new split asset)
                split.assetId,             // parent (original asset) 
                RelationshipType.SPLIT
            );
        }
        
        //5. Adicionar child assets no original
        originalAsset.childAssets = newAssetIds;

        _emitRelationship(
            split.channelName,
            split.assetId,           // primary (original asset)
            newAssetIds,             // related (all split assets)
            AssetOperation.SPLIT
        );
        
        emit AssetSplit(
            split.assetId,
            newAssetIds,
            originalAsset.owner,
            split.amounts,
            Utils.timestamp()
        );
        */
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
        //assetExists(ungroup.channelName, ungroup.assetId)
        //assetActive(ungroup.channelName, ungroup.assetId)
        //onlyAssetOwner(ungroup.channelName, ungroup.assetId, originCaller)  
    {
        /*
        _validateUngroupAssetsInput(ungroup);

        Asset storage groupAsset = _assetsByChannel[ungroup.channelName][ungroup.assetId];

        _validateCanUngroup(groupAsset);

        //1. Reativar assets a serem desagrupados
        bytes32[] memory ungroupedAssetIds = groupAsset.groupedAssets; // Array já existe!

        for (uint256 i = 0; i < ungroupedAssetIds.length; i++) {
            bytes32 childAssetId = ungroupedAssetIds[i];
            
            //1.1 Verificar se asset filho existe
            if (!_assetExistsByChannel[ungroup.channelName][childAssetId]) {
                revert GroupedAssetNotFound(ungroup.assetId, childAssetId);
            }
            
            Asset storage childAsset = _assetsByChannel[ungroup.channelName][childAssetId];
                        
            //1.2 Aplicar novos dados ao asset filho (se fornecidos)
            if (ungroup.dataHash != bytes32(0)) {
                childAsset.dataHash = ungroup.dataHash;
            }
            
            if (bytes(ungroup.location).length > 0) {
                childAsset.location = ungroup.location;
            }
            
            //1.3 Desvincular asset filho do grupo
            childAsset.groupedBy = bytes32(0);  // Não está mais agrupado  
            childAsset.status = AssetStatus.ACTIVE;
            childAsset.operation = AssetOperation.UNGROUP;
            childAsset.lastUpdated = Utils.timestamp();
        }

        //2. Remove and Inactivate asset grupo   
        groupAsset.status = AssetStatus.INACTIVE;
        groupAsset.operation = AssetOperation.UNGROUP;
        groupAsset.lastUpdated = Utils.timestamp();
                
        emit AssetsUngrouped(
            ungroup.assetId,
            ungroupedAssetIds,
            groupAsset.owner,
            Utils.timestamp()
        );
        */
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
        returns (Asset memory asset) 
    {
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
    }

    function _validateSplitAssetInput(SplitAssetInput calldata input) internal pure {
        if (input.assetId == bytes32(0)) revert InvalidAssetId(input.channelName, input.assetId);
        if (bytes(input.location).length == 0) revert EmptyLocation();
        
        // Validações de arrays
        if (input.amounts.length == 0) revert EmptyAmountsArray();
        if (input.amounts.length < 2) revert InsufficientSplitParts(input.amounts.length, 2);

        if (input.amounts.length != input.dataHashes.length) revert ArrayLengthMismatch();
        
        // Validar cada amount individual
        for (uint256 i = 0; i < input.amounts.length; i++) {
            if (input.amounts[i] == 0) {
                revert InvalidSplitAmount(input.amounts[i]);
            }

            if (input.amounts[i] < MIN_SPLIT_AMOUNT) {
                revert SplitAmountTooSmall(input.amounts[i], MIN_SPLIT_AMOUNT);
            }
        }
    }

    function _validateGroupAssetsInput(GroupAssetsInput calldata input) internal view {
        if (input.groupAssetId == bytes32(0)) revert InvalidAssetId(input.channelName, input.groupAssetId);
        if (bytes(input.location).length == 0) revert EmptyLocation();
        
        // Validações de arrays
        if (input.assetIds.length < MIN_GROUP_SIZE) {
            revert InsufficientAssetsToGroup(input.assetIds.length, MIN_GROUP_SIZE);
        }
        // Verificar que o grupo não existe
        if (_assetExistsByChannel[input.channelName][input.groupAssetId]) {
            revert GroupAssetAlreadyExists(input.groupAssetId);
        }
        
        // Verificar duplicatas nos assets
        if (_hasDuplicateAssets(input.assetIds)) {
            revert DuplicateAssetsInGroup();
        }
        
        // Verificar auto-referência
        for (uint256 i = 0; i < input.assetIds.length; i++) {
            if (input.assetIds[i] == input.groupAssetId) {
                revert SelfReferenceInGroup(input.assetIds[i]);
            }
        }
    }

    function _validateAssetsAndAmountConservation(GroupAssetsInput calldata input, address originalOwner) internal view returns (uint256) {
        uint256 totalOriginalAmounts = 0;
        address expectedOwner = originalOwner;
        
        // Validar cada asset e acumular amounts
        for (uint256 i = 0; i < input.assetIds.length; i++) {
            bytes32 assetId = input.assetIds[i];
            
            if (!_assetExistsByChannel[input.channelName][assetId]) {
                revert AssetNotFound(input.channelName, assetId);
            }
            
            Asset storage asset = _assetsByChannel[input.channelName][assetId];
            
            if (asset.status != AssetStatus.ACTIVE) {
                revert AssetNotActive(input.channelName, assetId);
            }
            
            if (asset.owner != expectedOwner) {
                revert MixedOwnershipNotAllowed(expectedOwner, asset.owner);
            }
            
            totalOriginalAmounts += asset.amount;
        }

        return totalOriginalAmounts;
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

    function _validateAssetExists(bytes32 channelName, bytes32 assetId) internal view {
        if (!_assetExistsByChannel[channelName][assetId]) {
            revert AssetNotFound(channelName, assetId);
        }  
    }
    
    function _validateAssetActive(bytes32 channelName, bytes32 assetId) internal view {
        if (_assetsByChannel[channelName][assetId].status != AssetStatus.ACTIVE) {
            revert AssetNotActive(channelName, assetId);
        }
    }
    
    function _validateAssetOwner(bytes32 channelName, bytes32 assetId, address originCaller) internal view {
        if (_assetsByChannel[channelName][assetId].owner != originCaller) {
            revert NotAssetOwner(channelName, assetId, originCaller);
        }
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================
    function _performAssetCreate(CreateAssetInput calldata input, address originCaller) internal {

        if (_assetExistsByChannel[input.channelName][input.assetId]) {
            revert AssetAlreadyExists(input.channelName, input.assetId);
        }

        // Create asset structure
        Asset storage newAsset = _assetsByChannel[input.channelName][input.assetId];
        newAsset.assetId = input.assetId;
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

        // Mark asset as existing
        _assetExistsByChannel[input.channelName][input.assetId] = true;

        // Para assets criados (origem), emitir evento de profundidade 0
        bytes32[] memory emptyOrigins = new bytes32[](0);
        
        _emitDepthCalculation(
            input.channelName,
            input.assetId,
            0,                       // depth 0 = origin
            emptyOrigins            // no origins (this IS the origin)
        );

        emit AssetCreated(
            input.channelName,
            input.assetId,
            originCaller,
            input.location,
            input.amount,
            Utils.timestamp()
        );
    }      

    function _performAssetUpdate(UpdateAssetInput calldata update, address originCaller) internal {

        _validateAssetExists(update.channelName, update.assetId);
        _validateAssetActive(update.channelName, update.assetId);
        _validateAssetOwner(update.channelName, update.assetId, originCaller);
        
        Asset storage asset = _assetsByChannel[update.channelName][update.assetId];
        
        // Store current state for events
        string memory currentLocation = asset.location;
        uint256 currentAmount = asset.amount;
        
        // Update core state
        asset.location = update.newLocation;
        if (update.newAmount > 0) {
            asset.amount = update.newAmount;
        }
        asset.operation = AssetOperation.UPDATE;
        asset.lastUpdated = Utils.timestamp();
        asset.dataHash = update.dataHash;
        
        _emitUpdateEvents(update.channelName, asset, currentLocation, currentAmount);
    }

    function _performAssetTransfer(TransferAssetInput calldata transfer, address originCaller) internal {
        
        _validateAssetExists(transfer.channelName, transfer.assetId);
        _validateAssetActive(transfer.channelName, transfer.assetId);
        _validateAssetOwner(transfer.channelName, transfer.assetId, originCaller);
        
        Asset storage asset = _assetsByChannel[transfer.channelName][transfer.assetId];

        if (asset.owner == transfer.newOwner) {
            revert TransferToSameOwner(transfer.channelName, transfer.assetId, transfer.newOwner);
        }

        ChannelAccess.requireMember(_getAddressDiscovery(), transfer.channelName, transfer.newOwner);

        address currentOwner = asset.owner;
        string memory currentLocation = asset.location;
        uint256 currentAmount = asset.amount;

        //Update core state
        asset.owner = transfer.newOwner;   
        asset.location = transfer.newLocation;
        asset.amount = transfer.newAmount;
        asset.dataHash = transfer.dataHash;
        asset.externalId = transfer.externalId;
        asset.operation = AssetOperation.TRANSFER;
        asset.lastUpdated = Utils.timestamp();

        _emitCustodyChanged(
            transfer.channelName,
            transfer.assetId,
            currentOwner,
            transfer.newOwner,
            currentLocation,
            transfer.newLocation,
            currentAmount,
            transfer.newAmount
        );

        emit AssetTransferred(
            transfer.channelName,
            transfer.assetId,
            currentOwner,
            transfer.newOwner,
            currentLocation,
            transfer.newLocation,
            Utils.timestamp()
        );
    }

    function _performAssetTransform(TransformAssetInput calldata transform, address originCaller) internal {

        _validateAssetExists(transform.channelName, transform.assetId);
        _validateAssetActive(transform.channelName, transform.assetId);
        _validateAssetOwner(transform.channelName, transform.assetId, originCaller);

        Asset storage originalAsset = _assetsByChannel[transform.channelName][transform.assetId];
        
        uint256 currentDepth = _getTransformationDepth(transform.channelName, transform.assetId);
        if (currentDepth + 1 > MAX_TRANSFORMATION_DEPTH) {
            revert TransformationChainTooDeep(currentDepth + 1, MAX_TRANSFORMATION_DEPTH);
        }

        if (_assetExistsByChannel[transform.channelName][transform.newAssetId]) {
            revert AssetAlreadyExists(transform.channelName, transform.newAssetId);
        }

        //2. Inativar original asset  
        originalAsset.status = AssetStatus.INACTIVE;
        originalAsset.operation = AssetOperation.TRANSFORM;
        originalAsset.lastUpdated = Utils.timestamp();


        //3. Criar Novo Asset
        Asset storage newAsset = _assetsByChannel[transform.channelName][transform.newAssetId];
        newAsset.assetId = transform.newAssetId;
        newAsset.owner = originalAsset.owner;   //Herda
        newAsset.location = transform.newLocation;
        newAsset.amount = transform.newAmount == 0 ? originalAsset.amount : transform.newAmount;
        newAsset.status = AssetStatus.ACTIVE;
        newAsset.operation = AssetOperation.TRANSFORM;
        newAsset.createdAt = Utils.timestamp();
        newAsset.lastUpdated = Utils.timestamp();
        newAsset.originOwner = originalAsset.originOwner;
        newAsset.dataHash = originalAsset.dataHash;
        newAsset.externalId = originalAsset.externalId;   

         //3.1 Novos campos de transformação do novo asset
        newAsset.parentAssetId = transform.assetId;
        newAsset.transformationId = transform.newAssetId;

        for (uint256 i = 0; i < originalAsset.groupedAssets.length; i++) {
            newAsset.groupedAssets.push(originalAsset.groupedAssets[i]);
        }

        newAsset.groupedBy = originalAsset.groupedBy;
        
        //4. Atualizar Rastreabilidade
        _assetExistsByChannel[transform.channelName][transform.newAssetId] = true;
      
        // Adicionar childAsset ao original
        originalAsset.childAssets.push(transform.newAssetId);

        //5. Emitir eventos
        _emitLineage(
            transform.channelName,
            transform.newAssetId,              // child (transformed asset)
            transform.assetId,       // parent (original asset)
            RelationshipType.TRANSFORM
        );
      
        emit AssetTransformed(
            transform.assetId,
            transform.newAssetId,
            newAsset.owner,
            Utils.timestamp()
        );
    }

    function _performAssetGroup(GroupAssetsInput calldata group, address originCaller) internal {

        _validateAssetExists(group.channelName, group.groupAssetId);

        //Pre-validate ALL assets and calculate total (atomic validation)
        Asset[] memory assetsToGroup = new Asset[](group.assetIds.length);
        uint256 totalAmounts = 0;
        
        for (uint256 i = 0; i < group.assetIds.length; i++) {
            bytes32 assetId = group.assetIds[i];
            
            // Validate existence
            if (!_assetExistsByChannel[group.channelName][assetId]) {
                revert AssetNotFound(group.channelName, assetId);
            }
            
            Asset storage asset = _assetsByChannel[group.channelName][assetId];
            
            // Validate business rules
            if (asset.status != AssetStatus.ACTIVE) {
                revert AssetNotActive(group.channelName, assetId);
            }
            
            if (asset.owner != originCaller) {
                revert MixedOwnershipNotAllowed(originCaller, asset.owner);
            }
            
            // Store for batch operation (avoid repeated storage reads)
            assetsToGroup[i] = asset;
            totalAmounts += asset.amount;
        }

        if (totalAmounts == 0) {
            revert InvalidGroupAmount(totalAmounts);
        }

        //1. Inativar assets a serem agrupados
        for (uint256 i = 0; i < group.assetIds.length; i++) {
            Asset storage originalAsset = _assetsByChannel[group.channelName][group.assetIds[i]];
                        
            originalAsset.status = AssetStatus.INACTIVE;
            originalAsset.operation = AssetOperation.GROUP;
            originalAsset.groupedBy = group.groupAssetId;  
            originalAsset.lastUpdated = Utils.timestamp();            
        }

        //2. Criar asset de agrupamento
        Asset storage groupAsset = _assetsByChannel[group.channelName][group.groupAssetId];

        groupAsset.assetId = group.groupAssetId;   // User-defined ID
        groupAsset.owner = originCaller;           // Owner dos assets originais
        groupAsset.amount = totalAmounts;           // Total amount (já validado conservation)
        groupAsset.location = group.location;      // Localização do grupo
        groupAsset.status = AssetStatus.ACTIVE;
        groupAsset.operation = AssetOperation.GROUP;
        groupAsset.createdAt = Utils.timestamp();
        groupAsset.lastUpdated = Utils.timestamp();
        groupAsset.originOwner = originCaller;
        groupAsset.dataHash = group.dataHash;


        //2.1 Relacionar assets no grupo
        for (uint256 i = 0; i < group.assetIds.length; i++) {
            groupAsset.groupedAssets.push(group.assetIds[i]);  // REVERSE TRACKING

            _emitLineage(
                group.channelName,
                group.groupAssetId,      // child (group asset)
                group.assetIds[i],       // parent (component asset)
                RelationshipType.GROUP_COMPONENT
            );
        }

        //3. Registrar existência e indexação
        _assetExistsByChannel[group.channelName][group.groupAssetId] = true;
      
        _emitRelationship(
            group.channelName,
            group.groupAssetId,      // primary (group asset)
            group.assetIds,          // related (component assets)
            AssetOperation.GROUP
        );

        uint256[] memory componentAmounts = new uint256[](group.assetIds.length);
        for (uint256 i = 0; i < group.assetIds.length; i++) {
            Asset storage componentAsset = _assetsByChannel[group.channelName][group.assetIds[i]];
            componentAmounts[i] = componentAsset.amount;
        }
        
        _emitComposition(
            group.channelName,
            group.groupAssetId,
            group.assetIds,
            componentAmounts
        );

        emit AssetsGrouped(
            group.assetIds,
            group.groupAssetId,
            originCaller,
            totalAmounts,
            Utils.timestamp()
        );
    }

    function _performAssetInactivate(InactivateAssetInput calldata inactivate, address originCaller) internal {

        _validateAssetExists(inactivate.channelName, inactivate.assetId);
        _validateAssetActive(inactivate.channelName, inactivate.assetId);
        _validateAssetOwner(inactivate.channelName, inactivate.assetId, originCaller);

        Asset storage asset = _assetsByChannel[inactivate.channelName][inactivate.assetId];
        
        if (bytes(inactivate.finalLocation).length > 0) {
            asset.location = inactivate.finalLocation;
        }
        
        if (inactivate.finalDataHash != bytes32(0)) {
            asset.dataHash = inactivate.finalDataHash;
        }
                
        asset.status = AssetStatus.INACTIVE;
        asset.operation = AssetOperation.INACTIVATE;
        asset.lastUpdated = Utils.timestamp();
                
        emit AssetInactivated(
            inactivate.assetId,
            asset.owner,
            AssetOperation.INACTIVATE,
            Utils.timestamp()
        );
    }

    function _generateTransformedAssetId(bytes32 channelName, bytes32 originalAssetId, string memory transformationId) 
        internal view returns (bytes32) 
    {
        return keccak256(abi.encodePacked(channelName, originalAssetId, transformationId, block.timestamp));
    }

    function _generateSplitAssetId(bytes32 originalAssetId, uint256 index, bytes32 channelName) 
        internal pure returns (bytes32) 
    {
        return keccak256(abi.encodePacked(
            originalAssetId, 
            index, 
            channelName
        ));
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        return string(bstr);
    }

    function _hasDuplicateAssets(bytes32[] calldata assetIds) internal pure returns (bool) {
        if (assetIds.length <= 1) return false;

        if (assetIds.length > MAX_GROUP_SIZE) {
            revert TooManyAssetsForDuplicateCheck(assetIds.length, MAX_GROUP_SIZE);
        }

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
            if (!_assetExistsByChannel[channelName][currentId]) {
                break; // Asset não existe, parar
            }

            Asset storage currentAsset = _assetsByChannel[channelName][currentId];
            currentId = currentAsset.parentAssetId;

            if (currentId != bytes32(0)) {
                depth++;
            }
        }
        
        return depth;
    }

    // =============================================================
    //                    INTERNAL EVENT EMITTER FUNCTIONS
    // =============================================================
    function _emitUpdateEvents(
        bytes32 channelName,
        Asset storage asset,
        string memory previousLocation,
        uint256 previousAmount
    ) internal {
        _emitAssetStateChanged(
            channelName,
            asset.assetId,
            previousLocation,
            asset.location,
            previousAmount,
            asset.amount
        );
        
        emit AssetUpdated(
            channelName,
            asset.assetId,
            asset.owner,
            asset.amount,
            asset.location,
            Utils.timestamp()
        );
    }
    
    function _emitLineage(
        bytes32 channelName,
        bytes32 childId,
        bytes32 parentId,
        RelationshipType relType
    ) internal {
        emit AssetLineage(
            channelName,
            childId,
            parentId,
            uint8(relType),
            Utils.timestamp()
        );
    }

    function _emitRelationship(
        bytes32 channelName,
        bytes32 primaryId,
        bytes32[] memory relatedIds,
        AssetOperation operationType
    ) internal {
        emit AssetRelationship(
            channelName,
            primaryId,
            relatedIds,
            uint8(operationType),
            block.number
        );
    }
    
    function _emitComposition(
        bytes32 channelName,
        bytes32 assetId,
        bytes32[] memory components,
        uint256[] memory amounts
    ) internal {
        emit AssetComposition(
            channelName,
            assetId,
            components,
            amounts,
            Utils.timestamp()
        );
    }

    function _emitDepthCalculation(
        bytes32 channelName,
        bytes32 assetId,
        uint8 depth,
        bytes32[] memory origins
    ) internal {
        emit AssetDepthCalculated(
            channelName,
            assetId,
            depth,
            origins
        );
    }

    function _emitAssetStateChanged(
        bytes32 channelName,
        bytes32 assetId,
        string memory previousLocation,
        string storage newLocation,
        uint256 previousAmount,
        uint256 newAmount
    ) internal {
        emit AssetStateChanged(
            channelName,
            assetId,
            previousLocation,
            newLocation,
            previousAmount,
            newAmount,
            Utils.timestamp()
        );

    }

    function _emitCustodyChanged(
        bytes32 channelName,
        bytes32 assetId,
        address currentOwner,
        address newOwner,
        string memory currentLocation,
        string calldata newLocation,
        uint256 currentAmount,
        uint256 newAmount
    ) internal {
        emit AssetCustodyChanged(
            channelName,
            assetId,
            currentOwner,
            newOwner,
            currentLocation,
            Utils.timestamp()
        );

        if (keccak256(bytes(currentLocation)) != keccak256(bytes(newLocation))) {
            emit AssetStateChanged(
                channelName,
                assetId,
                currentLocation,
                newLocation,
                currentAmount,
                newAmount,
                Utils.timestamp()
            );
        }
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
