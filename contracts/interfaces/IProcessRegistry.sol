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

    event ProcessInactivated(
        bytes32 indexed processId,
        bytes32 indexed natureId,
        bytes32 indexed stageId,
        address owner,
        bytes32 channelName,
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

    event ProcessSchemaInactivated(
        bytes32 indexed processId,
        bytes32 indexed schemaId,
        uint256 indexed version,
        bytes32 channelName,
        bool success,
        string reason
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
   
    // =============================================================
    //                    PROCESS MANAGEMENT
    // =============================================================

    /**
     * Creates a new process
     * @param processInput Process data to create
     */
    function createProcess(ProcessInput calldata processInput) external;

    /**
     * Inactivates an existing process
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @param channelName Channel name
     */
    function inactivateProcess(
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        bytes32 channelName
    ) external;

    /**
     * Set process status 
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @param channelName Channel name
     * @param newStatus New status to set
     */
    function setProcessStatus(
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        bytes32 channelName,
        ProcessStatus newStatus
    ) external;

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================
    
    /**
     * Gets a specific process (full compatibility with Fabric)
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @param channelName Channel name
     * @return process The process data
     */
    function getProcess(
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        bytes32 channelName
    ) external view returns (Process memory process);

    /**
     * Get process by simple ID
     * @param processId Process identifier
     * @param channelName Channel name
     * @return process The process data
     */
    function getProcessById(
        bytes32 processId,
        bytes32 channelName
    ) external view returns (Process memory process);

    /**
     * Get process status quickly
     * @param processId Process identifier
     * @param channelName Channel name
     * @return status Current process status
     */
    function getProcessStatus(
        bytes32 processId,
        bytes32 channelName
    ) external view returns (ProcessStatus status);

    /**
     * Generate unique key for a process (utility function)
     * @param channelName Channel name
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @return key Unique process key
     */
    /*
    function generateProcessKey(
        bytes32 channelName,
        bytes32 processId,
        bytes32 natureId, 
        bytes32 stageId
    ) external pure returns (bytes32 key);
    */

    
}