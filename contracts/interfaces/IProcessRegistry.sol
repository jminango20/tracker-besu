// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProcessRegistry
 * @notice Interface for managing business processes in the trace system
 */
interface IProcessRegistry {

    // =============================================================
    //                        ENUMS
    // =============================================================

    enum ProcessAction {
        CREATE_ASSET,
        UPDATE_ASSET,
        CREATE_DOCUMENT,
        TRANSFER_ASSET,
        TRANSFORM_ASSET,
        SPLIT_ASSET,
        GROUP_ASSET,
        UNGROUP_ASSET,
        INACTIVATE_ASSET
    }

    enum ProcessStatus {
        ACTIVE,
        INACTIVE
    }

    // =============================================================
    //                        STRUCTS
    // =============================================================

    struct SchemaReference {
        bytes32 schemaId;        // Schema identifier
        uint256 version;         // Specific version
    }

    struct Process {
        bytes32 processId;           // Business process identifier (bytes32)
        bytes32 natureId;            // Product nature identifier  
        bytes32 stageId;             // Operation stage identifier
        SchemaReference[] schemas;   // Associated schemas
        ProcessAction action;        // Process action (mandatory)
        string description;          // Process description
        address owner;               // Process owner
        bytes32 channelName;         // Virtual channel name
        ProcessStatus status;        // ACTIVE, PAUSED, DEPRECATED, INACTIVE
        uint256 createdAt;           // Creation timestamp
        uint256 lastUpdated;         // Last update timestamp
    }

    struct ProcessInput {
        bytes32 processId;           // Business process identifier
        bytes32 natureId;            // Product nature identifier
        bytes32 stageId;             // Operation stage identifier
        SchemaReference[] schemas;   // Associated schemas
        ProcessAction action;        // Process action (mandatory)
        string description;          // Process description
        bytes32 channelName;         // Virtual channel name
    }

    // =============================================================
    //                        EVENTS
    // =============================================================

    event ProcessCreated(
        bytes32 indexed processId,
        bytes32 indexed natureId,
        bytes32 indexed stageId,
        address owner,
        bytes32 channelName,
        ProcessAction action,
        uint256 timestamp
    );

    event ProcessStatusChanged(
        bytes32 indexed processId,
        bytes32 indexed channelName,
        ProcessStatus oldStatus,
        ProcessStatus newStatus,
        address updatedBy,
        uint256 timestamp
    );

    // =============================================================
    //                        ERRORS
    // =============================================================

    error InvalidProcessId();
    error InvalidNatureId();
    error InvalidStageId();
    error ProcessAlreadyExists(bytes32 channelName, bytes32 processId, bytes32 natureId, bytes32 stageId);
    error ProcessNotFound(bytes32 channelName, bytes32 processId);
    error ProcessAlreadyInactive(bytes32 channelName, bytes32 processId);
    error NotProcessOwner(bytes32 channelName, bytes32 processId, address caller);
    error SchemasRequiredForAction(ProcessAction action);
    error DuplicateSchemaInList(bytes32 schemaId, uint256 version);
    error SchemaNotActiveInChannel(bytes32 channelName, bytes32 schemaId, uint256 version);
    error SchemaNotFoundInChannel(bytes32 channelName, bytes32 schemaId, uint256 version);
    error DescriptionTooLong();
    error InvalidProcessStatusTransition(ProcessStatus current, ProcessStatus newStatus, string reason);
    error FunctionCallFailed();

    // =============================================================
    //                    PROCESS MANAGEMENT
    // =============================================================

    /**
     * Creates a new process
     * @param processInput Process data to create
     */
    function createProcess(ProcessInput calldata processInput) external;
    /**
     * Set process status 
     * @param channelName Channel name
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @param newStatus New status to set
     */
    function setProcessStatus(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        ProcessStatus newStatus
    ) external;

    /**
     * Inactivates an existing process
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @param channelName Channel name
     */
    function inactivateProcess(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    ) external;

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * Gets a specific process (full compatibility with Fabric)
     * @param channelName Channel name
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @return process The process data
     */
    function getProcess(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    ) external view returns (Process memory process);

    /**
     * Get process status quickly
     * @param channelName Channel name
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @return status Current process status
     */
    function getProcessStatus(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    ) external view returns (ProcessStatus status);

    /**
     * Checks if a process exists and is active
     * @param channelName Channel name
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @return active Whether the process is active
     */
    function isProcessActive(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    ) external view returns (bool active);

    /**
     * Get all processes with a specific processId in a channel
     * @dev Useful when you know processId but not nature/stage combinations
     * @param processId The process identifier
     * @param channelName The channel name
     * @return processes Array of all processes with this processId
     */
    function getProcessesByProcessId(
        bytes32 processId, 
        bytes32 channelName
    ) external view returns (Process[] memory processes);

    // =============================================================
    // FUNCTION TO BE CALLED BY PROCESS SUBMISSION
    // =============================================================

    /**
     * Validates if a process is valid for submission
     * @param channelName Channel name
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @return isValid Boolean indicating if the process is valid for submission
     * @return reason Reason for the process not being valid for submission
     */
    function validateProcessForSubmission(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId
    ) external view returns (bool isValid, string memory reason);
}