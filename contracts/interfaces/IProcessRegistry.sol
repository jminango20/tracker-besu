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

    event ProcessPausedBySchemaIssue(
        bytes32 indexed channelName,
        bytes32 indexed processId,
        address indexed pausedBy,
        string reason,
        uint256 timestamp
    );
    
    event ProcessResumed(
        bytes32 indexed channelName,
        bytes32 indexed processId,
        address indexed resumedBy,
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
    error ProcessPaused(bytes32 channelName, bytes32 processId);
   
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
     * Inactivates an existing process with cascade of schemas
     * @param processId Process identifier
     * @param natureId Nature identifier
     * @param stageId Stage identifier
     * @param channelName Channel name
     * @param cascadeSchemas Boolean to indicate if schemas should be cascaded
     */
    function inactivateProcessWithCascade(
        bytes32 processId,
        bytes32 natureId,
        bytes32 stageId,
        bytes32 channelName,
        bool cascadeSchemas  
    ) external;

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================
    
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
     * Get process status quickly
     * @param processId Process identifier
     * @param channelName Channel name
     * @return status Current process status
     */
    function getProcessStatus(
        bytes32 processId,
        bytes32 channelName
    ) external view returns (ProcessStatus status);

    // =============================================================
    //                    SCHEMA DEPENDENCY MANAGEMENT
    // =============================================================

    /**
     * Pauses a process by schema issue
     * @param channelName Channel name
     * @param processId Process identifier
     * @param reason Reason for pausing the process
     */
    function pauseProcessBySchemaIssue(
        bytes32 channelName,
        bytes32 processId,
        string calldata reason
    ) external;

    /**
     * Resumes a paused process by schema issue
     * @param channelName Channel name
     * @param processId Process identifier
     */
    function resumeProcess(
        bytes32 channelName,
        bytes32 processId
    ) external; 

    /**
     * Verifies if a process is paused by schema issue
     * @param channelName Channel name
     * @param processId Process identifier
    */
    function isProcessPausedBySchemaIssue(
        bytes32 channelName,
        bytes32 processId
    ) external view returns (bool);

    // =============================================================
    // FUNCTION TO BE CALLED BY PROCESS SUBMISSION
    // =============================================================

    /**
     * Validates if a process is valid for submission
     * @param channelName Channel name
     * @param processId Process identifier
     * @return isValid Boolean indicating if the process is valid for submission
     * @return reason Reason for the process not being valid for submission
     */
    function validateProcessForSubmission(
        bytes32 channelName,
        bytes32 processId
    ) external view returns (bool isValid, string memory reason);
     
}