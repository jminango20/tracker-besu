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

    /**
     * Mapping to track parent and child assets by channel - TRANSFOM ONLY
     * @dev channelName => parentAssetId => childAssetId
     */
    mapping(bytes32 => mapping(bytes32 => bytes32)) private _parentAssetByChannel;
    /**
     * @dev channelName => childAssetId => parentAssetId
     */
    mapping(bytes32 => mapping(bytes32 => bytes32[])) private _childAssetsByChannel;



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
        nonReentrant
        validChannelName(input.channelName)
        onlyChannelMember(input.channelName)
    {
        _validateCreateAssetInput(input);

        if (_assetExistsByChannel[input.channelName][input.assetId]) {
            revert AssetAlreadyExists(input.channelName, input.assetId);
        }

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
        nonReentrant
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
        nonReentrant 
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

        ChannelAccess.requireMember(_getAddressDiscovery(), transfer.channelName, transfer.newOwner);

        address currentOwner = asset.owner;

        asset.owner = transfer.newOwner;    //New Owner
        asset.idLocal = transfer.idLocal;
        asset.operation = AssetOperation.TRANSFER;
        asset.lastUpdated = Utils.timestamp();

        //Replace externalIds completely  
        delete asset.externalIds;
        for (uint256 i = 0; i < transfer.externalIds.length; i++) {
            asset.externalIds.push(transfer.externalIds[i]);
        }

        //Update owner enumeration
        _removeAssetFromOwner(transfer.channelName, transfer.assetId, currentOwner);
        _addAssetToOwner(transfer.channelName, transfer.assetId, transfer.newOwner);

        _addToHistory(transfer.channelName, transfer.assetId, AssetOperation.TRANSFER, Utils.timestamp());

        emit AssetTransferred(
            transfer.channelName,
            transfer.assetId,
            currentOwner,
            transfer.newOwner,
            transfer.idLocal,
            Utils.timestamp()
        );
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function transformAsset(TransformAssetInput calldata transform) 
        external
        nonReentrant
        validChannelName(transform.channelName) 
        onlyChannelMember(transform.channelName)
    {
        _validateTransformAssetInput(transform);

        if(!_assetExistsByChannel[transform.channelName][transform.assetId]) {
            revert AssetNotFound(transform.channelName, transform.assetId);
        }

        Asset storage originalAsset = _assetsByChannel[transform.channelName][transform.assetId];

        if (originalAsset.status != AssetStatus.ACTIVE) {
            revert AssetNotActive(transform.channelName, transform.assetId);
        }

        if (originalAsset.owner != _msgSender()) {
            revert NotAssetOwner(transform.channelName, transform.assetId, _msgSender());
        }

        uint256 currentDepth = _getTransformationDepth(transform.channelName, transform.assetId);
        if (currentDepth + 1 > MAX_TRANSFORMATION_DEPTH) {
            revert TransformationChainTooDeep(currentDepth + 1, MAX_TRANSFORMATION_DEPTH);
        }

        //1. Gerar novo asset ID
        bytes32 newAssetId = _generateTransformedAssetId(
            transform.channelName, 
            transform.assetId, 
            transform.transformationId
        );

        if (_assetExistsByChannel[transform.channelName][newAssetId]) {
            revert AssetAlreadyExists(transform.channelName, newAssetId);
        }

        //2. Inativar original asset
        _removeAssetFromOwner(transform.channelName, transform.assetId, originalAsset.owner);
        _updateAssetInStatusEnumeration(transform.channelName, transform.assetId, AssetStatus.INACTIVE);
        
        originalAsset.status = AssetStatus.INACTIVE;
        originalAsset.operation = AssetOperation.TRANSFORM;
        originalAsset.lastUpdated = Utils.timestamp();


        //3. Criar Novo Asset
        Asset storage newAsset = _assetsByChannel[transform.channelName][newAssetId];
        newAsset.assetId = newAssetId;
        newAsset.owner = originalAsset.owner;   //Herda
        newAsset.amount = transform.amount == 0 ? originalAsset.amount : transform.amount;
        newAsset.idLocal = transform.idLocal;

        for (uint256 i = 0; i < originalAsset.groupedAssets.length; i++) {
            newAsset.groupedAssets.push(originalAsset.groupedAssets[i]);
        }

        newAsset.groupedBy = originalAsset.groupedBy;
        
        for (uint256 i = 0; i < originalAsset.externalIds.length; i++) {
            newAsset.externalIds.push(originalAsset.externalIds[i]);
        }
        
        //3.1 Novos campos de transformação do novo asset
        newAsset.parentAssetId = transform.assetId;
        newAsset.transformationId = transform.transformationId;
        
        // Copiar dataHashes
        for (uint256 i = 0; i < transform.dataHashes.length; i++) {
            newAsset.dataHashes.push(transform.dataHashes[i]);
        }

        newAsset.status = AssetStatus.ACTIVE;
        newAsset.operation = AssetOperation.TRANSFORM;
        newAsset.createdAt = Utils.timestamp();
        newAsset.lastUpdated = Utils.timestamp();
        newAsset.originOwner = originalAsset.owner;

        //4. Atualizar Rastreabilidade
        _assetExistsByChannel[transform.channelName][newAssetId] = true;
        _parentAssetByChannel[transform.channelName][newAssetId] = transform.assetId;
        _childAssetsByChannel[transform.channelName][transform.assetId].push(newAssetId);

        // Adicionar childAsset ao original
        originalAsset.childAssets.push(newAssetId);

        //5. Atualizar Mapeamentos
        _addAssetToOwner(transform.channelName, newAssetId, newAsset.owner);
        _addAssetToStatus(transform.channelName, newAssetId, AssetStatus.ACTIVE);
        
        _addToHistory(transform.channelName, transform.assetId, AssetOperation.TRANSFORM, Utils.timestamp());
        _addToHistory(transform.channelName, newAssetId, AssetOperation.TRANSFORM, Utils.timestamp());

        emit AssetTransformed(
            transform.assetId,
            newAssetId,
            newAsset.owner,
            transform.transformationId,
            Utils.timestamp()
        );
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function splitAsset(SplitAssetInput calldata split) 
        external
        nonReentrant
        validChannelName(split.channelName)
        onlyChannelMember(split.channelName) 
    {
        _validateSplitAssetInput(split);

        if(!_assetExistsByChannel[split.channelName][split.assetId]) {
            revert AssetNotFound(split.channelName, split.assetId);
        }

        Asset storage originalAsset = _assetsByChannel[split.channelName][split.assetId];
        
        if (originalAsset.status != AssetStatus.ACTIVE) {
            revert AssetNotActive(split.channelName, split.assetId);
        }
    
        if (originalAsset.owner != _msgSender()) {
            revert NotAssetOwner(split.channelName, split.assetId, _msgSender());
        }

        //1. Validar conservação da quantidade (amount)
        uint256 totalSplitAmount = 0;
        for (uint256 i = 0; i < split.amounts.length; i++) {
            totalSplitAmount += split.amounts[i];
        }
        
        if (totalSplitAmount != originalAsset.amount) {
            revert AmountConservationViolated(originalAsset.amount, totalSplitAmount);
        }

        //2. Inativar original asset
        _removeAssetFromOwner(split.channelName, split.assetId, originalAsset.owner);
        _updateAssetInStatusEnumeration(split.channelName, split.assetId, AssetStatus.INACTIVE);

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
            newAsset.amount = split.amounts[i];             // Amount específico
            newAsset.idLocal = split.idLocal;               // Nova localização
            
            //DADOS INDIVIDUAIS
            newAsset.dataHashes = new bytes32[](1);
            newAsset.dataHashes[0] = split.dataHashes[i];
            
            //Não herda grouping (como Fabric)
            newAsset.groupedBy = bytes32(0);
            newAsset.groupedAssets = new bytes32[](0);
            newAsset.externalIds = new string[](0);
            
            //TRACKING DE SPLIT
            newAsset.parentAssetId = split.assetId;
            // transformationId personalizado para split
            newAsset.transformationId = string(abi.encodePacked("SPLIT_", _uint2str(i + 1)));
            newAsset.childAssets = new bytes32[](0);        // Splits não têm filhos inicialmente
            
            //METADATA
            newAsset.status = AssetStatus.ACTIVE;
            newAsset.operation = AssetOperation.SPLIT;
            newAsset.createdAt = Utils.timestamp();
            newAsset.lastUpdated = Utils.timestamp();
            newAsset.originOwner = originalAsset.owner;
            
            //REGISTRAR EXISTÊNCIA E INDEXAÇÃO
            _assetExistsByChannel[split.channelName][newAssetId] = true;
            _addAssetToOwner(split.channelName, newAssetId, newAsset.owner);
            _addAssetToStatus(split.channelName, newAssetId, AssetStatus.ACTIVE);
            _addToHistory(split.channelName, newAssetId, AssetOperation.SPLIT, Utils.timestamp());
            
            newAssetIds[i] = newAssetId;
        }

        //4. Atualizar Rastreabilidade
        _addToHistory(split.channelName, split.assetId, AssetOperation.SPLIT, Utils.timestamp());
        
        //5. Adicionar child assets no original
        originalAsset.childAssets = newAssetIds;
        
        emit AssetSplit(
            split.assetId,
            newAssetIds,
            originalAsset.owner,
            split.amounts,
            Utils.timestamp()
        );
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function groupAssets(GroupAssetsInput calldata group) 
        external
        nonReentrant
        validChannelName(group.channelName)
        onlyChannelMember(group.channelName)
    {
        _validateGroupAssetsInput(group);
        uint256 totalAmounts = _validateAssetsAndAmountConservation(group);

        //1. Inativar assets a serem agrupados
        for (uint256 i = 0; i < group.assetIds.length; i++) {
            Asset storage originalAsset = _assetsByChannel[group.channelName][group.assetIds[i]];
            
            _removeAssetFromOwner(group.channelName, group.assetIds[i], originalAsset.owner);
            _updateAssetInStatusEnumeration(group.channelName, group.assetIds[i], AssetStatus.INACTIVE);
            
            originalAsset.status = AssetStatus.INACTIVE;
            originalAsset.operation = AssetOperation.GROUP;
            originalAsset.groupedBy = group.groupAssetId;  
            originalAsset.lastUpdated = Utils.timestamp();
            
            // Atualizar mappings
            _addToHistory(group.channelName, group.assetIds[i], AssetOperation.GROUP, Utils.timestamp());
        }

        //2. Criar asset de agrupamento
        Asset storage groupAsset = _assetsByChannel[group.channelName][group.groupAssetId];

        groupAsset.assetId = group.groupAssetId;  // User-defined ID
        groupAsset.owner = _msgSender();           // Owner dos assets originais
        groupAsset.amount = totalAmounts;         // Total amount (já validado conservation)
        groupAsset.idLocal = group.idLocal;      // Nova localização do grupo

        for (uint256 i = 0; i < group.dataHashes.length; i++) {
            groupAsset.dataHashes.push(group.dataHashes[i]);
        }

        //2.1 Relacionar assets no grupo
        for (uint256 i = 0; i < group.assetIds.length; i++) {
            groupAsset.groupedAssets.push(group.assetIds[i]);  // REVERSE TRACKING
        }

        groupAsset.groupedBy = bytes32(0);                // Grupo não está agrupado em outro (inicialmente)

        groupAsset.externalIds = new string[](0);         // Grupo não herda external IDs
        groupAsset.parentAssetId = bytes32(0);            // Não é transformation
        groupAsset.transformationId = "";                 // Não é transformation
        groupAsset.childAssets = new bytes32[](0);        // Grupo não tem child assets inicialmente

        groupAsset.status = AssetStatus.ACTIVE;
        groupAsset.operation = AssetOperation.GROUP;
        groupAsset.createdAt = Utils.timestamp();
        groupAsset.lastUpdated = Utils.timestamp();
        groupAsset.originOwner = _msgSender();

        //3. Registrar existência e indexação
        _assetExistsByChannel[group.channelName][group.groupAssetId] = true;
        _addAssetToOwner(group.channelName, group.groupAssetId, _msgSender());
        _addAssetToStatus(group.channelName, group.groupAssetId, AssetStatus.ACTIVE);
        _addToHistory(group.channelName, group.groupAssetId, AssetOperation.GROUP, Utils.timestamp());

        emit AssetsGrouped(
            group.assetIds,
            group.groupAssetId,
            _msgSender(),
            totalAmounts,
            Utils.timestamp()
        );
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function ungroupAssets(UngroupAssetsInput calldata ungroup) 
        external
        nonReentrant
        validChannelName(ungroup.channelName)
        onlyChannelMember(ungroup.channelName)
    {
        _validateUngroupAssetsInput(ungroup);

        if (!_assetExistsByChannel[ungroup.channelName][ungroup.assetId]) {
            revert AssetNotFound(ungroup.channelName, ungroup.assetId);
        }

        Asset storage groupAsset = _assetsByChannel[ungroup.channelName][ungroup.assetId];

        if (groupAsset.status != AssetStatus.ACTIVE) {
            revert AssetNotActive(ungroup.channelName, ungroup.assetId);
        }
        
        if (groupAsset.owner != _msgSender()) {
            revert NotAssetOwner(ungroup.channelName, ungroup.assetId, _msgSender());
        }

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
                // Substituir dataHashes com novo hash
                delete childAsset.dataHashes;
                childAsset.dataHashes = new bytes32[](1);
                childAsset.dataHashes[0] = ungroup.dataHash;
            }
            
            if (bytes(ungroup.idLocal).length > 0) {
                childAsset.idLocal = ungroup.idLocal;
            }
            
            //1.3 Desvincular asset filho do grupo
            childAsset.groupedBy = bytes32(0);  // Não está mais agrupado
            
            //1.4 Atualizar status e history e Reativar asset filho
            _updateAssetInStatusEnumeration(ungroup.channelName, childAssetId, AssetStatus.ACTIVE);            
            
            childAsset.status = AssetStatus.ACTIVE;
            childAsset.operation = AssetOperation.UNGROUP;
            childAsset.lastUpdated = Utils.timestamp();

            _addAssetToOwner(ungroup.channelName, childAssetId, childAsset.owner);
            _addToHistory(ungroup.channelName, childAssetId, AssetOperation.UNGROUP, Utils.timestamp());
        }

        //2. Remove and Inactivate asset grupo
        _removeAssetFromOwner(ungroup.channelName, ungroup.assetId, groupAsset.owner);
        _updateAssetInStatusEnumeration(ungroup.channelName, ungroup.assetId, AssetStatus.INACTIVE);
        
        groupAsset.status = AssetStatus.INACTIVE;
        groupAsset.operation = AssetOperation.UNGROUP;
        groupAsset.lastUpdated = Utils.timestamp();
        
        //3. Atualizar status e history
        _addToHistory(ungroup.channelName, ungroup.assetId, AssetOperation.UNGROUP, Utils.timestamp());
        
        emit AssetsUngrouped(
            ungroup.assetId,
            ungroupedAssetIds,
            groupAsset.owner,
            Utils.timestamp()
        );
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function inactivateAsset(InactivateAssetInput calldata inactivate) 
        external 
        validChannelName(inactivate.channelName)
        onlyChannelMember(inactivate.channelName)    
    {
        _validateInactivateAssetInput(inactivate);
        
        if (!_assetExistsByChannel[inactivate.channelName][inactivate.assetId]) {
            revert AssetNotFound(inactivate.channelName, inactivate.assetId);
        }
        
        Asset storage asset = _assetsByChannel[inactivate.channelName][inactivate.assetId];
        
        if (asset.status != AssetStatus.ACTIVE) {
            revert AssetNotActive(inactivate.channelName, inactivate.assetId);
        }
        
        if (asset.owner != _msgSender()) {
            revert NotAssetOwner(inactivate.channelName, inactivate.assetId, _msgSender());
        }
        
        if (bytes(inactivate.finalLocation).length > 0) {
            asset.idLocal = inactivate.finalLocation;
        }
        
        if (inactivate.finalDataHash != bytes32(0)) {
            // Substituir dataHashes com hash final
            delete asset.dataHashes;
            asset.dataHashes = new bytes32[](1);
            asset.dataHashes[0] = inactivate.finalDataHash;
        }
        
        asset.status = AssetStatus.INACTIVE;
        asset.operation = AssetOperation.INACTIVATE;
        asset.lastUpdated = Utils.timestamp();
        
        _updateAssetInStatusEnumeration(inactivate.channelName, inactivate.assetId, AssetStatus.INACTIVE);
        _addToHistory(inactivate.channelName, inactivate.assetId, AssetOperation.INACTIVATE, Utils.timestamp());
        
        emit AssetInactivated(
            inactivate.assetId,
            asset.owner,
            AssetOperation.INACTIVATE,
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

    /**
     * @inheritdoc IAssetRegistry
     */
    function getTransformationHistory(bytes32 channelName, bytes32 assetId) 
        external 
        view 
        returns (bytes32[] memory transformationChain) 
    {
        if (!_assetExistsByChannel[channelName][assetId]) {
            revert AssetNotFound(channelName, assetId);
        }
        
        return _buildTransformationChain(channelName, assetId);
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function getAssetsByOwner(
        bytes32 channelName,
        address owner, 
        uint256 page, 
        uint256 pageSize
    ) external 
      view 
      validChannelName(channelName)
      validAddress(owner)
      validPagination(page, pageSize)
      returns (
        bytes32[] memory assetIds, 
        uint256 totalAssets, 
        bool hasNextPage
    )
    {
        bytes32[] storage ownerAssets = _assetsByChannelAndOwner[channelName][owner];
        totalAssets = ownerAssets.length;

        if (totalAssets == 0) {
            return (new bytes32[](0), 0, false);
        }

        (uint256 startIndex, uint256 endIndex, uint256 totalPages, bool _hasNextPage) = _calculatePagination(totalAssets, page, pageSize);
    
        hasNextPage = _hasNextPage;

        if (page > totalPages) {
            return (new bytes32[](0), totalAssets, false);
        }

        uint256 resultLength = endIndex - startIndex;
        assetIds = new bytes32[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            assetIds[i] = ownerAssets[startIndex + i];
        }
    }

    /**
     * @inheritdoc IAssetRegistry
     */
    function getAssetsByStatus(
        bytes32 channelName,
        AssetStatus status, 
        uint256 page, 
        uint256 pageSize
    ) external 
      view
      validChannelName(channelName)
      validPagination(page, pageSize) 
      returns (
        bytes32[] memory assetIds, 
        uint256 totalAssets, 
        bool hasNextPage
    ) 
    {
         bytes32[] storage statusAssets = _assetsByChannelAndStatus[channelName][status];
        totalAssets = statusAssets.length;

        if (totalAssets == 0) {
            return (new bytes32[](0), 0, false);
        }

        (uint256 startIndex, uint256 endIndex, uint256 totalPages, bool _hasNextPage) = _calculatePagination(totalAssets, page, pageSize);
        hasNextPage = _hasNextPage;

        if (page > totalPages) {
            return (new bytes32[](0), totalAssets, false);
        }

        uint256 resultLength = endIndex - startIndex;
        assetIds = new bytes32[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            assetIds[i] = statusAssets[startIndex + i];
        }
    }


    // =============================================================
    //                    VALIDATION FUNCTIONS
    // =============================================================
    function _validateCreateAssetInput(CreateAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.idLocal, input.dataHashes);
        _validateExternalIds(input.externalIds);
    }

    function _validateUpdateAssetInput(UpdateAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.idLocal, input.dataHashes);
    }

    function _validateTransferAssetInput(TransferAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.idLocal, input.dataHashes);
        _validateExternalIds(input.externalIds);
        if (input.newOwner == address(0)) revert InvalidAddress(input.newOwner);
    }

    function _validateTransformAssetInput(TransformAssetInput calldata input) internal pure {
        _validateCommonAssetFields(input.assetId, input.channelName, input.idLocal, input.dataHashes);
        // Validar transformationId
        bytes memory transformationBytes = bytes(input.transformationId);
        if (transformationBytes.length == 0 || transformationBytes.length > 64) {
            revert InvalidTransformationId();
        }
    }

    function _validateSplitAssetInput(SplitAssetInput calldata input) internal pure {
        if (input.assetId == bytes32(0)) revert InvalidAssetId(input.channelName, input.assetId);
        if (bytes(input.idLocal).length == 0) revert EmptyLocation();
        
        // Validações de arrays
        if (input.amounts.length == 0) revert EmptyAmountsArray();
        if (input.amounts.length < 2) revert InsufficientSplitParts(input.amounts.length, 2);

        if (input.amounts.length != input.dataHashes.length) revert ArrayLengthMismatch();
        
        // Gas protection
        if (input.amounts.length > MAX_SPLIT_COUNT) {
            revert TooManySplits(input.amounts.length, MAX_SPLIT_COUNT);
        }
        
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
        if (bytes(input.idLocal).length == 0) revert EmptyLocation();
        
        // Validações de arrays
        if (input.assetIds.length < MIN_GROUP_SIZE) {
            revert InsufficientAssetsToGroup(input.assetIds.length, MIN_GROUP_SIZE);
        }
        if (input.assetIds.length > MAX_GROUP_SIZE) {
            revert TooManyAssetsToGroup(input.assetIds.length, MAX_GROUP_SIZE);
        }
        if (input.dataHashes.length == 0) revert EmptyDataHashes();
        if (input.dataHashes.length > MAX_GROUP_DATA_HASHES) {
            revert TooManyDataHashes(input.dataHashes.length, MAX_GROUP_DATA_HASHES);
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

    function _validateAssetsAndAmountConservation(GroupAssetsInput calldata input) internal view returns (uint256) {
        uint256 totalOriginalAmounts = 0;
        address expectedOwner = _msgSender();
        
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
        string calldata idLocal,
        bytes32[] calldata dataHashes
    ) internal pure {
        if (assetId == bytes32(0)) revert InvalidAssetId(channelName, assetId);
        if (bytes(idLocal).length == 0) revert EmptyLocation();
        if (dataHashes.length == 0) revert EmptyDataHashes();
        if (dataHashes.length > MAX_DATA_HASHES) revert TooManyDataHashes(dataHashes.length, MAX_DATA_HASHES);
    }


    function _validateExternalIds(string[] calldata externalIds) internal pure {
        if (externalIds.length > MAX_EXTERNAL_IDS) {
            revert TooManyExternalIds(externalIds.length, MAX_EXTERNAL_IDS);
        }
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

    function _generateTransformedAssetId(bytes32 channelName, bytes32 originalAssetId, string memory transformationId) 
        internal view returns (bytes32) 
    {
        return keccak256(abi.encodePacked(channelName, originalAssetId, transformationId, block.timestamp));
    }

    function _buildTransformationChain(bytes32 channelName, bytes32 assetId) 
        internal view returns (bytes32[] memory chain) 
    {
        bytes32[] memory tempChain = new bytes32[](MAX_TRANSFORMATION_DEPTH + 1);
        uint256 count = 0;
        bytes32 currentId = assetId;
        
        while (currentId != bytes32(0) && count < MAX_TRANSFORMATION_DEPTH + 1) {
            tempChain[count] = currentId;
            currentId = _parentAssetByChannel[channelName][currentId];
            count++;
        }
        
        chain = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            chain[i] = tempChain[count - 1 - i];
        }
    }

    function _updateAssetInStatusEnumeration(bytes32 channelName, bytes32 assetId, AssetStatus newStatus) internal {
        // Get current asset to determine old status
        Asset storage asset = _assetsByChannel[channelName][assetId];
        AssetStatus oldStatus = asset.status;
        
        // If status is the same, no need to update enumeration
        if (oldStatus == newStatus) {
            return;
        }
        
        // Remove from old status array
        _removeAssetFromStatus(channelName, assetId, oldStatus);
        
        // Add to new status array
        _addAssetToStatus(channelName, assetId, newStatus);
    }

    function _removeAssetFromStatus(bytes32 channelName, bytes32 assetId, AssetStatus status) internal {
        bytes32[] storage statusAssets = _assetsByChannelAndStatus[channelName][status];
        uint256 assetIndex = _assetIndexByChannelAndStatus[channelName][assetId];
        uint256 lastIndex = statusAssets.length - 1;
        
        // Move last element to deleted position (swap and pop pattern)
        if (assetIndex != lastIndex) {
            bytes32 lastAssetId = statusAssets[lastIndex];
            statusAssets[assetIndex] = lastAssetId;
            _assetIndexByChannelAndStatus[channelName][lastAssetId] = assetIndex;
        }
        
        // Remove last element
        statusAssets.pop();
        delete _assetIndexByChannelAndStatus[channelName][assetId];
    }

    function _generateSplitAssetId(bytes32 originalAssetId, uint256 index, bytes32 channelName) 
        internal view returns (bytes32) 
    {
        return keccak256(abi.encodePacked(
            originalAssetId, 
            index, 
            channelName, 
            block.number,
            _msgSender()  
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
            currentId = _parentAssetByChannel[channelName][currentId];
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
