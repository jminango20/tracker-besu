// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {IProcessRegistry} from "./interfaces/IProcessRegistry.sol";
import {ISchemaRegistry} from "./interfaces/ISchemaRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    PROCESS_ADMIN_ROLE,
    MAX_STRING_LENGTH,
    SCHEMA_REGISTRY
    } from "./lib/Constants.sol";
import {Utils} from "./lib/Utils.sol";

/**
 * @title ProcessRegistry
 * @notice Contract for managing business processes in the trace system
 * @dev Inherits from BaseTraceContract for common functionality
 */
contract ProcessRegistry is Context, BaseTraceContract, IProcessRegistry {

    // =============================================================
    //                        STORAGE
    // =============================================================

    /**
     * Main storage for processes by channel and composite key
     * @dev channelName => compositeKey => Process
     */
    mapping(bytes32 => mapping(bytes32 => Process)) private _processes;

    /**
     * Track active process keys for uniqueness validation
     * @dev compositeKey => isActive 
     */
    mapping(bytes32 => bool) private _activeProcessKeys;

    /**
     * Mapping to track process existence by channel name
     * @dev channelName => processId => exists
     */
    mapping(bytes32 => mapping(bytes32 => bool)) private _processExists;

    /**
     * Mapping to track process existence by channel name
     * @dev channelName => processId => compositeKey
     */
    mapping(bytes32 => mapping(bytes32 => bytes32)) private _simpleToComposite;
    
   
    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /**
     * Constructor for ProcessRegistry
     * @param addressDiscovery_ Address of the AddressDiscovery contract
     */
    constructor(address addressDiscovery_) 
        BaseTraceContract(addressDiscovery_) 
    {
        _grantRole(PROCESS_ADMIN_ROLE, _msgSender());
    }


    // =============================================================
    //                    PROCESS MANAGEMENT
    // =============================================================

    /**
     * @inheritdoc IProcessRegistry
     */
    function createProcess(ProcessInput calldata processInput) 
        external 
        validChannelName(processInput.channelName) 
        onlyChannelMember(processInput.channelName) 
    {

        _validationIds(processInput.processId, processInput.natureId, processInput.stageId);
        _validationDescription(processInput.description);
        
        // Create a unique key for the process
        bytes32 uniqueKey = _createProcessKey(
            processInput.channelName, 
            processInput.processId, 
            processInput.natureId, 
            processInput.stageId
        );

        // Check if the process already exists
        _validateProcessKey(
            uniqueKey, 
            processInput.channelName, 
            processInput.processId, 
            processInput.natureId, 
            processInput.stageId
        );

        // Schemas validation
        uint256 schemasLength = processInput.schemas.length;

        _validateAction(processInput.action, schemasLength);

        if (schemasLength > 0) {
           _validateSchemas(processInput.channelName, processInput.schemas);
        }

        // Create the process
        Process memory newProcess = _createProcess(processInput, uniqueKey);

        // Storage
         _storageNewProcess(newProcess.channelName, newProcess.processId, uniqueKey);
     
        emit ProcessCreated(
            newProcess.processId,
            newProcess.natureId,
            newProcess.stageId,
            newProcess.owner,
            newProcess.channelName,
            newProcess.action,
            newProcess.createdAt
        );
    }

    /**
     * Change status of a process
     */
    function setProcessStatus(
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        bytes32 channelName,
        ProcessStatus newStatus
    ) 
        external 
        validChannelName(channelName)
        onlyChannelMember(channelName)
    {
        _setProcessStatus(
            processId,
            natureId,
            stageId,
            channelName,
            newStatus
        );
    }

    /**
     * @inheritdoc IProcessRegistry
     */
    function inactivateProcess(
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        bytes32 channelName
    ) external {
        _setProcessStatus(
            processId,
            natureId,
            stageId,
            channelName,
            ProcessStatus.INACTIVE
        );
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * @inheritdoc IProcessRegistry
     */
    function getProcessById(
        bytes32 processId,
        bytes32 channelName
    ) 
        external 
        view 
        validChannelName(channelName)
        returns (Process memory process) 
    {
        if (processId == bytes32(0)) revert InvalidProcessId();

        return _getProcess(channelName, processId);
    }

    /**
     * @inheritdoc IProcessRegistry
     */
    function getProcess(
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        bytes32 channelName
    ) 
        external 
        view 
        validChannelName(channelName)
        returns (Process memory process) 
    {
        _validationIds(processId, natureId, stageId);

        bytes32 compositeKey = _simpleToComposite[channelName][processId];

        if (compositeKey == bytes32(0)) {
            revert ProcessNotFound(channelName, processId);
        }

        return _processes[channelName][compositeKey];
    }

    /**
     * @inheritdoc IProcessRegistry
     */
    function getProcessStatus(
        bytes32 processId,
        bytes32 channelName
    ) 
        external 
        view 
        validChannelName(channelName)
        returns (ProcessStatus status) 
    {
        if (processId == bytes32(0)) revert InvalidProcessId();

        return _getProcess(channelName, processId).status;

    }

    // =============================================================
    //                    INTERNAL VALIDATION
    // =============================================================
    function _validationIds(bytes32 processId, bytes32 natureId, bytes32 stageId) internal pure {
        if (processId == bytes32(0)) revert InvalidProcessId();
        if (natureId == bytes32(0)) revert InvalidNatureId();
        if (stageId == bytes32(0)) revert InvalidStageId();
    }

    function _validationDescription(string calldata description) internal pure {
        if (bytes(description).length > MAX_STRING_LENGTH) revert DescriptionTooLong();
    }

    function _validateProcessKey(
        bytes32 uniqueKey, 
        bytes32 channelName, 
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    )
        internal 
        view 
    {
        if (_activeProcessKeys[uniqueKey]) {
            revert ProcessAlreadyExists(
                channelName,
                processId,
                natureId,
                stageId
            );
        }
    }

    function _validateAction(ProcessAction action, uint256 schemasLength) internal pure {
        if (action == ProcessAction.CREATE_ASSET || 
            action == ProcessAction.CREATE_DOCUMENT || 
            action == ProcessAction.UPDATE_ASSET) 
        {
            if (schemasLength == 0) {
                revert SchemasRequiredForAction(action);
            }
        }        
    }

    function _validateSchemas(
        bytes32 channelName, 
        SchemaReference[] calldata schemas
    ) internal view {
        ISchemaRegistry schemaRegistry = ISchemaRegistry(
            _getAddressDiscovery().getContractAddress(SCHEMA_REGISTRY)
        );
        
        for (uint256 i = 0; i < schemas.length; i++) {
            // Check duplicates
            for (uint256 j = i + 1; j < schemas.length; j++) {
                if (schemas[i].schemaId == schemas[j].schemaId && 
                    schemas[i].version == schemas[j].version) {
                    revert DuplicateSchemaInList(schemas[i].schemaId, schemas[i].version);
                }
            }
            
            // Validate schema exists and is active
            try schemaRegistry.getSchemaByVersion(
                channelName, schemas[i].schemaId, schemas[i].version
            ) returns (ISchemaRegistry.Schema memory schema) {
                if (schema.status == ISchemaRegistry.SchemaStatus.INACTIVE) {
                    revert SchemaNotActiveInChannel(
                        channelName, 
                        schemas[i].schemaId, 
                        schemas[i].version
                    );
                }
            } catch {
                revert SchemaNotFoundInChannel(
                    channelName, 
                    schemas[i].schemaId, 
                    schemas[i].version
                );
            }
        }
    }

    function _validateProcessStatusTransition(
        ProcessStatus current, 
        ProcessStatus newStatus
    ) internal pure {
        
        if (current == ProcessStatus.INACTIVE) {
            revert InvalidProcessStatusTransition(current, newStatus, "INACTIVE is final state");
        }
        
        if (current == ProcessStatus.ACTIVE && newStatus != ProcessStatus.INACTIVE) {
            revert InvalidProcessStatusTransition(current, newStatus, "ACTIVE can only go to INACTIVE");
        }    
    }

    // =============================================================
    //                    INTERNAL OPERATIONS
    // =============================================================

    function _createProcessKey(
        bytes32 channelName, 
        bytes32 processId, 
        bytes32 natureId, 
        bytes32 stageId
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                channelName,
                processId,
                natureId,
                stageId
            )
        );
    }

    function _createProcess(
        ProcessInput memory processInput, 
        bytes32 uniqueKey
        ) internal 
          returns (Process memory)
    {
        Process storage newProcess = _processes[processInput.channelName][uniqueKey];

        newProcess.processId = processInput.processId;
        newProcess.natureId = processInput.natureId;
        newProcess.stageId = processInput.stageId;
        newProcess.action = processInput.action;
        newProcess.description = processInput.description;
        newProcess.owner = _msgSender();
        newProcess.channelName = processInput.channelName;
        newProcess.status = ProcessStatus.ACTIVE;

        uint256 nowTimestamp = Utils.timestamp();
        newProcess.createdAt = nowTimestamp;
        newProcess.lastUpdated = nowTimestamp;

        uint256 schemasLength = processInput.schemas.length;
        if (schemasLength > 0) {
            for (uint256 i = 0; i < schemasLength;) {
                newProcess.schemas.push(processInput.schemas[i]);
                unchecked { ++i; }
            }
        }

        return newProcess;
    }

    function _setProcessStatus(
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        bytes32 channelName,
        ProcessStatus newStatus
    ) internal 
    {
        bytes32 uniqueKey = keccak256(abi.encodePacked(
            channelName, processId, natureId, stageId
        ));

        if (!_processExists[channelName][uniqueKey]) {
            revert ProcessNotFound(channelName, processId);
        }

        Process storage process = _processes[channelName][uniqueKey];

        if (process.owner != _msgSender()) {
            revert NotProcessOwner(channelName, processId,  _msgSender());
        }

        ProcessStatus oldStatus = process.status;

        _validateProcessStatusTransition(oldStatus, newStatus);

        process.status = newStatus;
        process.lastUpdated = Utils.timestamp();
        
        // Atualizar index de ativos
        _activeProcessKeys[uniqueKey] = (newStatus == ProcessStatus.ACTIVE);

        // CASCADE SCHEMA INACTIVATION
        if (newStatus == ProcessStatus.INACTIVE && oldStatus == ProcessStatus.ACTIVE) {
            _inactivateAssociatedSchemas(process, channelName);
        }

        emit ProcessStatusChanged(
            processId, 
            channelName, 
            oldStatus, 
            newStatus, 
            _msgSender(), 
            Utils.timestamp()
        );
    }

    function _inactivateAssociatedSchemas(Process storage process, bytes32 channelName) internal {
        
        // Get SchemaRegistry contract
        ISchemaRegistry schemaRegistry = ISchemaRegistry(
            _getAddressDiscovery().getContractAddress(SCHEMA_REGISTRY)
        );
        
        // Inactivate all associated schemas
        uint256 schemasLength = process.schemas.length;
        for (uint256 i = 0; i < schemasLength; i++) {
            SchemaReference storage schemaRef = process.schemas[i];
            
            try schemaRegistry.setSchemaStatus(
                schemaRef.schemaId,
                schemaRef.version,
                channelName,
                ISchemaRegistry.SchemaStatus.INACTIVE
            ) {
                // Schema successfully inactivated
                emit ProcessSchemaInactivated(
                    process.processId,
                    schemaRef.schemaId,
                    schemaRef.version,
                    channelName,
                    true,
                    "Successfully inactivated"
                );
            } catch Error(string memory reason) {
                emit ProcessSchemaInactivated(
                    process.processId,
                    schemaRef.schemaId,
                    schemaRef.version,
                    channelName,
                    false,
                    reason
                );
            } catch {
                emit ProcessSchemaInactivated(
                    process.processId,
                    schemaRef.schemaId,
                    schemaRef.version,
                    channelName,
                    false,
                    "Unknown error"
                );
            }
        }
    }

    function _storageNewProcess(
        bytes32 channelName, 
        bytes32 processId, 
        bytes32 uniqueKey
    ) internal 
    {
        _activeProcessKeys[uniqueKey] = true;
        _processExists[channelName][uniqueKey] = true;
        _simpleToComposite[channelName][processId] = uniqueKey;
    }

    function _getProcess(
        bytes32 channelName,
        bytes32 processId
    ) internal view returns (Process memory process) {
        bytes32 compositeKey = _simpleToComposite[channelName][processId];

        if (compositeKey == bytes32(0)) {
            revert ProcessNotFound(channelName, processId);
        }

        return _processes[channelName][compositeKey];
    }

    // =============================================================
    //                    ACCESS CONTROL HELPERS
    // =============================================================

    /**
     * Function to add a new process admin.
     * @param newProcessAdmin Address of the new process admin
     */
    function addProcessAdmin(address newProcessAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newProcessAdmin == address(0)) revert InvalidAddress(newProcessAdmin);
        _grantRole(PROCESS_ADMIN_ROLE, newProcessAdmin);
    }

    /**
     * Function to remove a process admin.
     * @param addressProcessAdmin Address of process admin to remove
     */
    function removeProcessAdmin(address addressProcessAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (addressProcessAdmin == address(0)) revert InvalidAddress(addressProcessAdmin);
        _revokeRole(PROCESS_ADMIN_ROLE, addressProcessAdmin);
    }


    // =============================================================
    //                    IMPLEMENTATION REQUIREMENTS
    // =============================================================

    /**
     * Set the address discovery contract
     * @param discovery Address of the discovery contract
     */
    function setAddressDiscovery(address discovery) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setAddressDiscovery(discovery);
    }

    /**
     * Get the address discovery contract
     * @return discovery Address of the discovery contract
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