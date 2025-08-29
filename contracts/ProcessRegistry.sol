// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTraceContract} from "./BaseTraceContract.sol";
import {IProcessRegistry} from "./interfaces/IProcessRegistry.sol";
import {ISchemaRegistry} from "./interfaces/ISchemaRegistry.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {
    PROCESS_ADMIN_ROLE,
    MAX_STRING_LENGTH,
    SCHEMA_REGISTRY,
    MAX_SCHEMAS_PER_PROCESS
    } from "./lib/Constants.sol";
import {Utils} from "./lib/Utils.sol";
import {ChannelAccess} from "./lib/ChannelAccess.sol";

/**
 * @title ProcessRegistry
 * @notice Contract for managing business processes in the trace system
 */
contract ProcessRegistry is Context, BaseTraceContract, IProcessRegistry {
    // =============================================================
    //                        STORAGE 
    // =============================================================

    /**
     * Main storage for processes by channel and composite key
     * @dev channelName => processId => natureId => stageId => Process
     */
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => Process)))) private _processes;

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

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

        _validateIds(processInput.processId, processInput.natureId, processInput.stageId);
        _validateDescription(processInput.description);
        _validateProcessNotExists(processInput.channelName, processInput.processId, processInput.natureId, processInput.stageId);
        
        uint256 schemasLength = processInput.schemas.length;
        _validateActionRequiresSchemas(processInput.action, schemasLength);

        if (schemasLength > 0 && schemasLength <= MAX_SCHEMAS_PER_PROCESS) {
           _validateSchemas(processInput.channelName, processInput.schemas);
        }

        _createProcessInStorage(processInput);
             
        emit ProcessCreated(
            processInput.processId,
            processInput.natureId,
            processInput.stageId,
            _msgSender(),
            processInput.channelName,
            processInput.action,
            Utils.timestamp()
        );
    }

    /**
     * @inheritdoc IProcessRegistry
     */
    function setProcessStatus(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        ProcessStatus newStatus
    ) 
        external 
        validChannelName(channelName)
        onlyChannelMember(channelName) 
    {

        _setProcessStatus(
            channelName,
            processId,
            natureId,
            stageId,
            newStatus
        );        
    }

    /**
     * @inheritdoc IProcessRegistry
     */
    function inactivateProcess(
     bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    ) 
        external
        validChannelName(channelName)
        onlyChannelMember(channelName) 
    {

        _setProcessStatus(
            channelName,
            processId,
            natureId,
            stageId,
            ProcessStatus.INACTIVE
        );   
    }

    // =============================================================
    //                    VIEW FUNCTIONS 
    // =============================================================

    /**
     * @inheritdoc IProcessRegistry
     */
    function getProcess(
     bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    ) 
        external 
        view 
        validChannelName(channelName)
        returns (Process memory) 
    {
        _validateIds(processId, natureId, stageId);
        
        Process storage process = _getExistingProcess(channelName, processId, natureId, stageId);
        return process;
    }

    /**
     * @inheritdoc IProcessRegistry
     * @dev Validate process for submission (useful for TransactionOrchestrator)
     */
    function validateProcessForSubmission(
     bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    ) 
        external 
        validChannelName(channelName)
        view 
        returns (bool isValid, string memory reason) 
    {

        _validateChannel(channelName);
        _validateIds(processId, natureId, stageId);

        Process storage process = _getExistingProcess(channelName, processId, natureId, stageId);

        // Check se processo está ativo
        if (process.status != ProcessStatus.ACTIVE) {
            return (false, "Process not active");
        }

        // Validar schemas ainda ativos
        return _validateSchemasForSubmission(channelName, process.schemas);
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS 
    // =============================================================

    function _createProcessInStorage(
        ProcessInput calldata processInput
    ) internal {
        Process storage newProcess = _processes[processInput.channelName][processInput.processId][processInput.natureId][processInput.stageId];

        newProcess.processId = processInput.processId;
        newProcess.natureId = processInput.natureId;
        newProcess.stageId = processInput.stageId;
        newProcess.action = processInput.action;
        newProcess.description = processInput.description;
        newProcess.owner = _msgSender();
        newProcess.channelName = processInput.channelName;
        newProcess.status = ProcessStatus.ACTIVE;
        newProcess.createdAt = Utils.timestamp();
        newProcess.lastUpdated = Utils.timestamp();

        // Adicionar schemas
        for (uint256 i = 0; i < processInput.schemas.length; i++) {
            newProcess.schemas.push(processInput.schemas[i]);
        }
    }

    function _setProcessStatus(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        ProcessStatus newStatus
    ) internal {
        _validateIds(processId, natureId, stageId);

        Process storage process = _getExistingProcess(channelName, processId, natureId, stageId);
        _validateProcessOwnership(process);

        ProcessStatus oldStatus = process.status;        
        _validateProcessStatusTransition(oldStatus, newStatus);

        // Atualizar status
        process.status = newStatus;
        process.lastUpdated = Utils.timestamp();
        
        emit ProcessStatusChanged(
            processId, 
            channelName, 
            oldStatus, 
            newStatus, 
            _msgSender(), 
            Utils.timestamp()
        );
    }

    function _getExistingProcess(
        bytes32 channelName, 
        bytes32 processId, 
        bytes32 natureId, 
        bytes32 stageId
    ) internal view returns (Process storage) {
        Process storage process = _processes[channelName][processId][natureId][stageId];
        
        // Check if process exists by checking if owner is set
        if (process.owner == address(0)) {
            revert ProcessNotFound(channelName, processId);
        }
        
        return process;
    }

    function _validateSchemasForSubmission(
        bytes32 channelName,
        SchemaReference[] memory schemas
    ) internal view returns (bool isValid, string memory errorMessage) {
        ISchemaRegistry schemaRegistry = ISchemaRegistry(
            _getAddressDiscovery().getContractAddress(SCHEMA_REGISTRY)
        );
        
        for (uint256 i = 0; i < schemas.length; i++) {
            try schemaRegistry.getSchemaByVersion(
                channelName, schemas[i].schemaId, schemas[i].version
            ) returns (ISchemaRegistry.Schema memory schema) {
                if (schema.status == ISchemaRegistry.SchemaStatus.INACTIVE) {
                    return (false, "Schema not active");
                }
            } catch {
                 return (false, "Schema not found");
            }
        }
        return (true, "Process valid for submission");
    }

    // =============================================================
    //                    INTERNAL VALIDATION FUNCTIONS
    // =============================================================
    function _validateIds(bytes32 processId, bytes32 natureId, bytes32 stageId) internal pure {
        if (processId == bytes32(0)) revert InvalidProcessId();
        if (natureId == bytes32(0)) revert InvalidNatureId();
        if (stageId == bytes32(0)) revert InvalidStageId();
    }

    function _validateDescription(string calldata description) internal pure {
        if (bytes(description).length > MAX_STRING_LENGTH) revert DescriptionTooLong();
    }

    function _validateProcessNotExists(
        bytes32 channelName, 
        bytes32 processId, 
        bytes32 natureId, 
        bytes32 stageId
    ) internal view {
        Process storage process = _processes[channelName][processId][natureId][stageId];
        if (process.owner != address(0)) {
            revert ProcessAlreadyExists(channelName, processId, natureId, stageId);
        }
    }

    function _validateProcessOwnership(Process storage process) internal view {
        if (process.owner != _msgSender()) {
            revert NotProcessOwner(process.channelName, process.processId, _msgSender());
        }
    }

    function _validateActionRequiresSchemas(ProcessAction action, uint256 schemasLength) internal pure {
        if (action == ProcessAction.CREATE_ASSET || 
            action == ProcessAction.CREATE_DOCUMENT || 
            action == ProcessAction.UPDATE_ASSET) {
            if (schemasLength == 0) {
                revert SchemasRequiredForAction(action);
            }
        }        
    }

    function _validateProcessStatusTransition(
        ProcessStatus current, 
        ProcessStatus newStatus
    ) internal pure {
        if (current == newStatus) {
            revert InvalidProcessStatusTransition(current, newStatus, "Status unchanged");
        }
        
        // INACTIVE é final state
        if (current == ProcessStatus.INACTIVE) {
            revert InvalidProcessStatusTransition(current, newStatus, "INACTIVE is final state");
        }     

        if (current == ProcessStatus.ACTIVE && newStatus != ProcessStatus.INACTIVE) {
            revert InvalidProcessStatusTransition(current, newStatus, "ACTIVE can only go to INACTIVE");
        }   
    }

    function _validateChannel(bytes32 channelName) internal view returns (bool status, string memory error) {

        (bool channelExists, bool channelIsActive, , , ) = ChannelAccess.getChannelInfo(_getAddressDiscovery(), channelName);

        if (!channelExists) {
            return (false, "Channel does not exist");
        }
        if (!channelIsActive) {
            return (false, "Channel is not active");
        }
                
    }

    function _validateSchemas(bytes32 channelName, SchemaReference[] calldata schemas) internal view {
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
                if (schema.status != ISchemaRegistry.SchemaStatus.ACTIVE) {
                    revert SchemaNotActiveInChannel(channelName, schemas[i].schemaId, schemas[i].version);
                }
            } catch {
                revert SchemaNotFoundInChannel(channelName, schemas[i].schemaId, schemas[i].version);
            }
        }
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