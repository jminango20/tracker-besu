// test/utils/SupplyChainTracer.ts
import { TraceabilityCache } from './TraceabilityCache';
import { 
  LineageEvent,
  CustodyEvent,
  StateEvent,
  CompositionEvent,
  DepthEvent,
  RelationshipEvent,
  CompleteTraceabilityPath,
  AssetComposition,
  AssetOrigins,
  TraceabilityStep,
  AssetStep,
  DetailedAssetPath
} from './EvenTypes';

export class SupplyChainTracer {
  private assetRegistry: any;
  private channelName: string;
  private cache: TraceabilityCache;
  private relationshipTypeNames = ["SPLIT", "TRANSFORM", "GROUP_COMPONENT", "TRANSFER", "UPDATE"];

  constructor(assetRegistry: any, channelName: string) {
    this.assetRegistry = assetRegistry;
    this.channelName = channelName;
    this.cache = new TraceabilityCache();
  }

  // 🎯 Main API Methods
  async getCompleteTraceabilityPath(assetId: string): Promise<CompleteTraceabilityPath> {
    // Check cache first
    const cached = this.cache.getCachedTraceabilityPath(assetId);
    if (cached) {
      console.log(`          ✅ Caminho em cache para: ${assetId.substring(0, 10)}...`);
      return cached;
    }

    console.log(`          🔍 CONSTRUINDO CAMINHO COMPLETO para: ${assetId.substring(0, 10)}...`);

    // Ensure we have all events
    await this.ensureEventsLoaded();

    // Build the complete path
    const path = await this.buildCompleteTraceabilityPath(assetId);
    
    // Cache the result
    this.cache.cacheTraceabilityPath(assetId, path);
    
    return path;
  }

  async findOrigins(assetId: string): Promise<AssetOrigins> {
    // Check cache first
    const cached = this.cache.getCachedOrigins(assetId);
    if (cached) {
      return cached;
    }

    // Ensure we have lineage events
    await this.ensureEventsLoaded();

    // Build graph if needed
    const { reverseLineageMap } = await this.getOrBuildLineageMaps();

    // Find origins
    const originIds = await this.traceAssetToOrigins(assetId, reverseLineageMap);
    
    // Build detailed origins info
    const origins: AssetOrigins = {
      assetId,
      totalOrigins: originIds.length,
      origins: []
    };

    for (const originId of originIds) {
      const assetDetails = await this.getAssetDetails(originId);
      const depth = this.calculateDepthFromEvents(originId);
      
      origins.origins.push({
        assetId: originId,
        location: assetDetails.location,
        amount: assetDetails.amount,
        depth
      });
    }

    // Cache and return
    this.cache.cacheOrigins(assetId, origins);
    return origins;
  }

  async getComposition(blendAssetId: string): Promise<AssetComposition | null> {
    // Check cache first
    const cached = this.cache.getCachedComposition(blendAssetId);
    if (cached) {
      return cached;
    }

    // Find composition event
    const compositionEvent = this.cache.getCompositionEvents()
      .find(e => e.args.assetId === blendAssetId);

    if (!compositionEvent) {
      return null;
    }

    // Build detailed composition
    const composition: AssetComposition = {
      assetId: blendAssetId,
      componentCount: compositionEvent.args.componentAssets.length,
      totalAmount: compositionEvent.args.componentAmounts.reduce((sum, amount) => sum + Number(amount), 0),
      components: [],
      timestamp: compositionEvent.args.timestamp
    };

    // Build component details
    for (let i = 0; i < compositionEvent.args.componentAssets.length; i++) {
      const componentId = compositionEvent.args.componentAssets[i];
      const amount = Number(compositionEvent.args.componentAmounts[i]);
      const assetDetails = await this.getAssetDetails(componentId);
      const origins = await this.findOrigins(componentId);

      composition.components.push({
        assetId: componentId,
        amount,
        percentage: (amount / composition.totalAmount) * 100,
        location: assetDetails.location,
        origins: origins.origins.map(o => o.assetId)
      });
    }

    // Cache and return
    this.cache.cacheComposition(blendAssetId, composition);
    return composition;
  }

  // 🔧 Event Capture Methods
  async captureAllEventsFromTransaction(receipt: any): Promise<void> {
    const eventTypes = [
      'AssetLineage',
      'AssetCustodyChanged', 
      'AssetStateChanged',
      'AssetComposition',
      'AssetDepthCalculated',
      'AssetRelationship'
    ];

    console.log(`   🔍 Capturando eventos da transação...`);
    
    let totalEventsCaptured = 0;
    for (const eventType of eventTypes) {
      const events = this.extractEventsOfType(receipt, eventType);
      if (events.length > 0) {
        this.storeEventsInCache(eventType, events);
        console.log(`      📊 ${eventType}: ${events.length} eventos`);
        totalEventsCaptured += events.length;
      }
    }
    
    if (totalEventsCaptured === 0) {
      console.log(`      ⚠️ Nenhum evento de rastreabilidade encontrado`);
    } else {
      console.log(`   ✅ Total de eventos capturados: ${totalEventsCaptured}`);
    }
  }

  async captureEventsByTransaction(receipt: any, eventType: string): Promise<any[]> {
    const events = this.extractEventsOfType(receipt, eventType);
    this.storeEventsInCache(eventType, events);
    return events;
  }

  private extractEventsOfType(receipt: any, eventType: string): any[] {
    return receipt.logs
      .filter((log: any) => {
        try {
          const parsed = this.assetRegistry.interface.parseLog(log);
          return parsed?.name === eventType;
        } catch { 
          return false; 
        }
      })
      .map((log: any) => this.assetRegistry.interface.parseLog(log));
  }

  private storeEventsInCache(eventType: string, events: any[]): void {
    switch (eventType) {
      case 'AssetLineage':
        this.cache.addLineageEvents(events as LineageEvent[]);
        break;
      case 'AssetCustodyChanged':
        this.cache.addCustodyEvents(events as CustodyEvent[]);
        break;
      case 'AssetStateChanged':
        this.cache.addStateEvents(events as StateEvent[]);
        break;
      case 'AssetComposition':
        this.cache.addCompositionEvents(events as CompositionEvent[]);
        break;
      case 'AssetDepthCalculated':
        this.cache.addDepthEvents(events as DepthEvent[]);
        break;
      case 'AssetRelationship':
        this.cache.addRelationshipEvents(events as RelationshipEvent[]);
        break;
    }
  }

  // 🔧 Internal Methods
private async buildCompleteTraceabilityPath(assetId: string): Promise<CompleteTraceabilityPath> {
  const completePath: TraceabilityStep[] = [];
  let stepCounter = 1;

  // 1. Build genealogical backbone
  const genealogyPath = await this.traceGenealogyToOrigin(assetId);
  
  // 2. For each asset in genealogy, add its lifecycle (including inherited events)
  for (let i = 0; i < genealogyPath.length; i++) {
    const currentAssetId = genealogyPath[i];
    const isOrigin = i === 0;
    const isTarget = currentAssetId === assetId;
    
    // Add genealogical step with creation state
    const genealogyState = await this.getAssetStateAtCreation(currentAssetId);
    
    completePath.push({
      step: stepCounter++,
      type: isOrigin ? 'ORIGIN' : 'GENEALOGY',
      data: {
        assetId: currentAssetId,
        location: genealogyState.location,
        amount: genealogyState.amount,
        relationshipType: !isOrigin ? this.getRelationshipType(currentAssetId, genealogyPath[i-1]) : undefined
      }
    });
    
    // Add custody/state events for this specific asset
    const assetEvents = await this.buildChronologicalEventTimeline(currentAssetId);
    
    for (const event of assetEvents) {
      if (event.type === 'CUSTODY') {
        completePath.push({
          step: stepCounter++,
          type: 'CUSTODY',
          timestamp: event.timestamp,
          data: {
            assetId: currentAssetId,
            location: event.newLocation,
            amount: genealogyState.amount,
            previousOwner: event.previousOwner,
            newOwner: event.newOwner
          }
        });
      } else if (event.type === 'STATE') {
        completePath.push({
          step: stepCounter++,
          type: 'STATE', 
          timestamp: event.timestamp,
          data: {
            assetId: currentAssetId,
            location: event.newLocation,
            amount: event.newAmount || genealogyState.amount,
            previousLocation: event.previousLocation
          }
        });
      }
    }
  }

  // Build summary
  const summary = this.buildPathSummary(completePath, genealogyPath);
  const origins = await this.findOrigins(assetId);

  return {
    assetId,
    totalSteps: completePath.length,
    origins: origins.origins.map(o => o.assetId),
    genealogyDepth: genealogyPath.length,
    path: completePath,
    summary
  };
}

  // New method: Build chronological timeline for specific asset
  private async buildChronologicalEventTimeline(assetId: string): Promise<any[]> {
    const events: any[] = [];
    
    // Get custody events
    const custodyEvents = this.cache.getCustodyEvents()
      .filter(e => e.args.assetId === assetId)
      .map(e => ({
        type: 'CUSTODY',
        timestamp: Number(e.args.timestamp),
        previousOwner: e.args.previousOwner,
        newOwner: e.args.newOwner,
        newLocation: e.args.newLocation,
        assetId: e.args.assetId
      }));
    
    // Get state events  
    const stateEvents = this.cache.getStateEvents()
      .filter(e => e.args.assetId === assetId)
      .map(e => ({
        type: 'STATE',
        timestamp: Number(e.args.timestamp),
        previousLocation: e.args.previousLocation,
        newLocation: e.args.newLocation,
        previousAmount: Number(e.args.previousAmount) || undefined,
        newAmount: Number(e.args.newAmount) || undefined,
        assetId: e.args.assetId
      }));
    
    // Combine and sort chronologically
    events.push(...custodyEvents, ...stateEvents);
    events.sort((a, b) => a.timestamp - b.timestamp);
    
    return events;
  }

  // Fixed method: Get asset state at creation (not current state reversed)
  private async getAssetStateAtCreation(assetId: string): Promise<any> {
    const asset = await this.assetRegistry.getAsset(this.channelName, assetId);
    
    // For genealogy assets, find their creation state from events
    const allEvents = await this.buildChronologicalEventTimeline(assetId);
    
    if (allEvents.length === 0) {
      // No changes, return current state
      return {
        location: asset.idLocal,
        amount: Number(asset.amount),
        owner: asset.owner
      };
    }
    
    // Start with current state and work backwards to creation state
    let creationState = {
      location: asset.idLocal,
      amount: Number(asset.amount),
      owner: asset.owner
    };
    
    // Reverse events to get creation state
    for (let i = allEvents.length - 1; i >= 0; i--) {
      const event = allEvents[i];
      
      if (event.type === 'CUSTODY') {
        // If this was the last custody change, the previous owner was the creation owner
        if (i === allEvents.findIndex(e => e.type === 'CUSTODY')) {
          creationState.owner = event.previousOwner;
        }
      }
      
      if (event.type === 'STATE') {
        // If this was the last state change, use previous values
        if (i === allEvents.findIndex(e => e.type === 'STATE')) {
          creationState.location = event.previousLocation;
          if (event.previousAmount) {
            creationState.amount = event.previousAmount;
          }
        }
      }
    }
    
    return creationState;
  }


  // Enhanced summary building that accounts for inherited operations
private buildPathSummary(path: TraceabilityStep[], genealogyPath: string[]): any {
  const transfers = path.filter(s => s.type === 'CUSTODY').length;
  const stateChanges = path.filter(s => s.type === 'STATE').length;
  const transformations = genealogyPath.length - 1; // genealogy steps minus origin
  
  // Count operations by asset to show inheritance clearly
  const assetOperations = new Map<string, number>();
  path.forEach(step => {
    const count = assetOperations.get(step.data.assetId) || 0;
    assetOperations.set(step.data.assetId, count + 1);
  });

  const summary = {
    totalTransfers: transfers,
    totalStateChanges: stateChanges,
    totalTransformations: transformations,
    assetsInChain: genealogyPath.length,
    operationsByAsset: Object.fromEntries(assetOperations)
  };

  // Calculate mass loss across entire chain
  const originStep = path.find(s => s.type === 'ORIGIN');
  const lastStep = path[path.length - 1];
  
  if (originStep && lastStep && originStep.data.amount !== lastStep.data.amount) {
    const initial = originStep.data.amount;
    const final = lastStep.data.amount;
    
    return {
      ...summary,
      massLoss: {
        initial,
        final,
        lossPercentage: ((initial - final) / initial) * 100,
        totalLoss: initial - final
      }
    };
  }

  return summary;
}

  private async getOrBuildLineageMaps(): Promise<{ lineageMap: Map<string, any[]>, reverseLineageMap: Map<string, any[]> }> {
    // Check cache first
    const cached = this.cache.getLineageMaps();
    if (cached) {
      return cached;
    }

    // Build maps
    const lineageMap = new Map<string, any[]>();
    const reverseLineageMap = new Map<string, any[]>();
    
    this.cache.getLineageEvents().forEach(event => {
      const parent = event.args.parentAssetId;
      const child = event.args.childAssetId;
      const relType = Number(event.args.relationshipType);
      const timestamp = Number(event.args.timestamp);
      
      // Forward lineage (parent -> children)
      if (!lineageMap.has(parent)) {
        lineageMap.set(parent, []);
      }
      lineageMap.get(parent)!.push({ child, relType, timestamp });
      
      // Reverse lineage (child -> parents)
      if (!reverseLineageMap.has(child)) {
        reverseLineageMap.set(child, []);
      }
      reverseLineageMap.get(child)!.push({ parent, relType, timestamp });
    });

    // Cache and return
    this.cache.setLineageMaps(lineageMap, reverseLineageMap);
    return { lineageMap, reverseLineageMap };
  }

  private async traceAssetToOrigins(assetId: string, reverseLineageMap: Map<string, any[]>): Promise<string[]> {
    const visited = new Set<string>();
    const origins: string[] = [];
    
    const dfs = (currentId: string, depth: number = 0): void => {
      if (visited.has(currentId) || depth > 10) {
        return;
      }
      visited.add(currentId);
      
      const parents = reverseLineageMap.get(currentId) || [];
      
      if (parents.length === 0) {
        origins.push(currentId);
        return;
      }
      
      for (const parentInfo of parents) {
        dfs(parentInfo.parent, depth + 1);
      }
    };
    
    dfs(assetId);
    return origins;
  }

  private async traceGenealogyToOrigin(assetId: string): Promise<string[]> {
    const { reverseLineageMap } = await this.getOrBuildLineageMaps();
    const path: string[] = [];
    const visited = new Set<string>();
    
    const tracePath = (currentId: string): void => {
      if (visited.has(currentId) || path.length > 10) return;
      visited.add(currentId);
      path.unshift(currentId);
      
      const parents = reverseLineageMap.get(currentId) || [];
      
      // Only follow genealogical parents (exclude TRANSFER/UPDATE)
      const genealogicalParents = parents.filter(p => p.relType !== 3 && p.relType !== 4);
      
      if (genealogicalParents.length > 0) {
        tracePath(genealogicalParents[0].parent);
      }
    };
    
    tracePath(assetId);
    return path;
  }

  private async getAssetDetails(assetId: string): Promise<any> {
    const asset = await this.assetRegistry.getAsset(this.channelName, assetId);
    return {
      id: assetId,
      owner: asset.owner,
      amount: Number(asset.amount),
      location: asset.idLocal,
      status: Number(asset.status),
      operation: Number(asset.operation)
    };
  }

  private getRelationshipType(childId: string, parentId: string): string {
    const lineageEvent = this.cache.getLineageEvents()
      .find(e => e.args.childAssetId === childId && e.args.parentAssetId === parentId);
    
    if (lineageEvent) {
      const relType = Number(lineageEvent.args.relationshipType);
      return this.relationshipTypeNames[relType] || `UNKNOWN(${relType})`;
    }
    
    return 'UNKNOWN';
  }

  private calculateDepthFromEvents(assetId: string): number {
    const depthEvent = this.cache.getDepthEvents()
      .find(e => e.args.assetId === assetId);
    
    return depthEvent ? Number(depthEvent.args.depth) : 0;
  }

  private async ensureEventsLoaded(): Promise<void> {
    // In a real implementation, this could load events from blockchain
    // For tests, events are loaded via captureEventsByTransaction
    // This is a placeholder for future enhancements
  }

  // 🔧 Utility Methods
  getCacheStats(): any {
    return this.cache.getStats();
  }

  clearCache(): void {
    this.cache.clear();
  }

  async getDetailedAssetPath(assetId: string): Promise<DetailedAssetPath> {
    console.log(`\n   Construindo caminho detalhado para: ${assetId.substring(0, 10)}...`);
    
    const path = await this.buildCompleteTraceabilityPath(assetId);
    const origins = await this.findOrigins(assetId);
    
    const steps: AssetStep[] = [];
    
    // Build asset state timeline to get correct state for each step
    const assetTimeline = await this.buildAssetStateTimeline(assetId);
    
    for (const step of path.path) {
      // Find the correct asset state for this step
      const stepState = this.findAssetStateForStep(step, assetTimeline);
      
      const assetStep: AssetStep = {
        stepNumber: step.step,
        stepType: step.type,
        asset: {
          assetId: step.data.assetId,
          owner: stepState.owner,
          amount: step.data.amount,
          idLocal: step.data.location,
          status: stepState.status,
          operation: stepState.operation,
          createdAt: stepState.createdAt || 0,
          lastUpdated: stepState.lastUpdated || 0
        },
        operation: this.getStepOperation(step.type, step.data, stepState.operation),
        timestamp: step.timestamp
      };

      // Add context based on step type
      if (step.type === 'CUSTODY' && step.data.previousOwner) {
        assetStep.custodyChange = {
          previousOwner: step.data.previousOwner,
          newOwner: step.data.newOwner ?? '',
          location: step.data.location
        };
      }

      if (step.type === 'STATE' && step.data.previousLocation) {
        assetStep.stateChange = {
          previousLocation: step.data.previousLocation,
          newLocation: step.data.location,
        };
      }

      steps.push(assetStep);
  }
  
  const result: DetailedAssetPath = {
    assetId,
    totalSteps: steps.length,
    origins: origins.origins.length,
    initialAmount: steps[0]?.asset.amount || 0,
    finalAmount: steps[steps.length - 1]?.asset.amount || 0,
    lossPercentage: this.calculateLossPercentage(
      steps[0]?.asset.amount || 0, 
      steps[steps.length - 1]?.asset.amount || 0
    ),
    steps
  };

  return result;
  }

// Enhanced method to build asset state timeline that considers parent inheritance
private async buildAssetStateTimeline(assetId: string): Promise<any[]> {
  const timeline: any[] = [];
  const currentAsset = await this.assetRegistry.getAsset(this.channelName, assetId);
  
  // Get genealogical path to understand inheritance
  const genealogyPath = await this.traceGenealogyToOrigin(assetId);
  
  // Build timeline for each asset in genealogy
  for (let i = 0; i < genealogyPath.length; i++) {
    const pathAssetId = genealogyPath[i];
    const asset = await this.assetRegistry.getAsset(this.channelName, pathAssetId);
    const events = await this.buildChronologicalEventTimeline(pathAssetId);
    
    // Start with creation state for this asset
    let currentState = await this.getAssetStateAtCreation(pathAssetId);
    const baseAssetInfo = {
      status: Number(asset.status),
      operation: i === 0 ? 0 : this.detectOriginalOperation(pathAssetId), // CREATE for origin, detect for others
      createdAt: Number(asset.createdAt),
      lastUpdated: Number(asset.createdAt)
    };
    
    timeline.push({
      timestamp: Number(asset.createdAt),
      assetId: pathAssetId,
      ...currentState,
      ...baseAssetInfo
    });
    
    // Apply events chronologically for this asset
    for (const event of events) {
      if (event.type === 'CUSTODY') {
        currentState = {
          ...currentState,
          owner: event.newOwner
        };
      } else if (event.type === 'STATE') {
        currentState = {
          ...currentState,
          location: event.newLocation,
          amount: event.newAmount || currentState.amount
        };
      }
      
      timeline.push({
        timestamp: event.timestamp,
        assetId: pathAssetId,
        ...currentState,
        status: Number(asset.status),
        operation: 2, // TRANSFER for events
        createdAt: Number(asset.createdAt),
        lastUpdated: event.timestamp
      });
    }
  }
  
  // Sort timeline by timestamp to maintain chronological order across assets
  timeline.sort((a, b) => a.timestamp - b.timestamp);
  
  return timeline;
}

// Enhanced findAssetStateForStep to handle cross-asset inheritance
private findAssetStateForStep(step: TraceabilityStep, timeline: any[]): any {
  if (!step.timestamp) {
    // For genealogy/origin steps, find the state for that specific asset
    const assetStates = timeline.filter(state => state.assetId === step.data.assetId);
    return assetStates[0] || timeline[0];
  }
  
  // Find the state at or before this step's timestamp for the correct asset
  const assetStates = timeline.filter(state => 
    state.assetId === step.data.assetId && 
    state.timestamp <= (step?.timestamp ?? 0) 
  );
  
  if (assetStates.length > 0) {
    return assetStates[assetStates.length - 1]; // Latest state before timestamp
  }
  
  // Fallback: find any state for this asset
  const anyAssetState = timeline.find(state => state.assetId === step.data.assetId);
  return anyAssetState || timeline[0];
}


  
  // Display methods
  displayDetailedPathJSON(detailedPath: DetailedAssetPath): void {
    console.log('\n   JSON COMPLETO:');
    // Converter BigInts para numbers antes de serializar
    const serializable = this.convertBigIntsToNumbers(detailedPath);
    console.log(JSON.stringify(serializable, null, 2));
  }

  private convertBigIntsToNumbers(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'bigint') {
      return Number(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertBigIntsToNumbers(item));
    }
    
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = this.convertBigIntsToNumbers(value);
      }
      return converted;
    }
    
    return obj;
  }

  displayDetailedPathTable(detailedPath: DetailedAssetPath): void {
    console.log('\n   TABELA RESUMIDA:');
    console.log('   Step | Type      | Amount | Location                     | Owner        | Operation   | Timestamp');
    console.log('   -----|-----------|--------|------------------------------|--------------|-------------|----------');
    
    detailedPath.steps.forEach(step => {
        const stepNum = step.stepNumber.toString().padEnd(4);
        const type = step.stepType.padEnd(9);
        const amount = `${step.asset.amount}kg`.padEnd(6);
        const location = step.asset.idLocal.length > 28 
        ? step.asset.idLocal.substring(0, 25) + '...' 
        : step.asset.idLocal.padEnd(28);
        const owner = `${step.asset.owner.substring(0, 6)}...${step.asset.owner.substring(38)}`.padEnd(12);
        const operation = step.operation.padEnd(11);
        const timestamp = step.timestamp 
        ? new Date(Number(step.timestamp) * 1000).toISOString().substring(11, 19)
        : '-'.padEnd(8);

        console.log(`   ${stepNum} | ${type} | ${amount} | ${location} | ${owner} | ${operation} | ${timestamp}`);
        
        // Add sub-details for custody/state changes
        if (step.custodyChange) {
        const prevOwner = `${step.custodyChange.previousOwner.substring(0, 6)}...`;
        const newOwner = `${step.custodyChange.newOwner.substring(0, 6)}...`;
        console.log(`        └─ Custody: ${prevOwner} → ${newOwner}`);
        }
        
        if (step.stateChange) {
        console.log(`        └─ Location: "${step.stateChange.previousLocation}" → "${step.stateChange.newLocation}"`);
        }
    });
    
    console.log('\n   RESUMO:');
    console.log(`   Total Steps: ${detailedPath.totalSteps}`);
    console.log(`   Origins: ${detailedPath.origins}`);
    console.log(`   Mass Flow: ${detailedPath.initialAmount}kg → ${detailedPath.finalAmount}kg`);
    console.log(`   Loss: ${detailedPath.lossPercentage.toFixed(1)}%`);
  }

  // Helper methods
  private getStepOperation(stepType: string, stepData: any, assetOperation: number): string {
    // Para ORIGIN, sempre é CREATE independente da operação final do asset
    if (stepType === 'ORIGIN') {
      return 'CREATE';
    }
    
    // Para GENEALOGY, detectar pela transição
    if (stepType === 'GENEALOGY') {
      // Usar os eventos de lineage para detectar a operação correta
      const lineageEvents = this.cache.getLineageEvents();
      const relatedEvent = lineageEvents.find(e => 
        e.args.childAssetId === stepData.assetId
      );
      
      if (relatedEvent) {
        const relType = Number(relatedEvent.args.relationshipType);
        if (relType === 0) return 'SPLIT';
        if (relType === 1) return 'TRANSFORM';
        if (relType === 2) return 'GROUP_COMPONENT';
      }
    }
    
    // Para CUSTODY e STATE, sempre são transferências/updates
    if (stepType === 'CUSTODY') return 'TRANSFER';
    if (stepType === 'STATE') return 'UPDATE';
    
    return this.getOperationName(assetOperation);
  }

  private getOperationName(operation: number): string {
    const operations = [
        'CREATE',      // 0
        'UPDATE',      // 1
        'TRANSFER',    // 2
        'TRANSFERIN',  // 3
        'SPLIT',       // 4
        'GROUP',       // 5
        'UNGROUP',     // 6
        'TRANSFORM',   // 7
        'INACTIVATE'   // 8
    ];
    return operations[operation] || 'UNKNOWN';
  }

  private calculateLossPercentage(initial: number, final: number): number {
    if (initial === 0) return 0;
    return ((initial - final) / initial) * 100;
  }

  //Get asset state at creation time
  private async getAssetCreationState(assetId: string): Promise<any> {
    const asset = await this.assetRegistry.getAsset(this.channelName, assetId);
    
    // For origin assets, try to reconstruct the original state
    // by reversing any custody/state changes
    const custodyChanges = this.cache.getCustodyEvents()
      .filter(e => e.args.assetId === assetId)
      .sort((a, b) => Number(a.args.timestamp) - Number(b.args.timestamp));
    
    const stateChanges = this.cache.getStateEvents()
      .filter(e => e.args.assetId === assetId)
      .sort((a, b) => Number(a.args.timestamp) - Number(b.args.timestamp));
    
    // Start with current state and reverse changes
    let historicalOwner = asset.owner;
    let historicalLocation = asset.idLocal;
    let historicalAmount = Number(asset.amount);
    
    // Reverse custody changes to get original owner
    if (custodyChanges.length > 0) {
      historicalOwner = custodyChanges[0].args.previousOwner;
    }
    
    // Reverse state changes to get original location
    if (stateChanges.length > 0) {
      historicalLocation = stateChanges[0].args.previousLocation;
      if (stateChanges[0].args.previousAmount && Number(stateChanges[0].args.previousAmount) > 0) {
        historicalAmount = Number(stateChanges[0].args.previousAmount);
      }
    }
    
    return {
      id: assetId,
      owner: historicalOwner,
      amount: historicalAmount,
      location: historicalLocation,
      status: Number(asset.status),
      operation: Number(asset.operation)
    };
  }

  //Get asset state at creation time for genealogy assets
  private async getAssetAtCreationTime(assetId: string): Promise<any> {
    const asset = await this.assetRegistry.getAsset(this.channelName, assetId);
    
    // For genealogy assets, get the state at creation by looking at lineage events
    const lineageEvent = this.cache.getLineageEvents()
      .find(e => e.args.childAssetId === assetId);
    
    if (lineageEvent) {
      // Find the first custody/state change after creation
      const custodyChanges = this.cache.getCustodyEvents()
        .filter(e => e.args.assetId === assetId)
        .sort((a, b) => Number(a.args.timestamp) - Number(b.args.timestamp));
      
      const stateChanges = this.cache.getStateEvents()
        .filter(e => e.args.assetId === assetId)
        .sort((a, b) => Number(a.args.timestamp) - Number(b.args.timestamp));
      
      // If there are changes, get the "before" state from first change
      if (custodyChanges.length > 0 || stateChanges.length > 0) {
        const originalOwner = custodyChanges.length > 0 
          ? custodyChanges[0].args.previousOwner 
          : asset.owner;
        
        const originalLocation = stateChanges.length > 0 
          ? stateChanges[0].args.previousLocation 
          : asset.idLocal;
        
        const originalAmount = stateChanges.length > 0 && stateChanges[0].args.previousAmount
          ? Number(stateChanges[0].args.previousAmount)
          : Number(asset.amount);
        
        return {
          id: assetId,
          owner: originalOwner,
          amount: originalAmount,
          location: originalLocation,
          status: Number(asset.status),
          operation: Number(asset.operation)
        };
      }
    }
    
    // If no changes found, return current state
    return await this.getAssetDetails(assetId);
  }

  private async getStepAssetDetails(step: TraceabilityStep): Promise<any> {
    // For genealogy steps, try to get historical state
    if (step.type === 'GENEALOGY') {
      // Try to get asset state before any transfers/updates
      const custodyChanges = this.cache.getCustodyEvents()
        .filter(e => e.args.assetId === step.data.assetId)
        .sort((a, b) => Number(a.args.timestamp) - Number(b.args.timestamp));
      
      if (custodyChanges.length > 0) {
        // Return state before first custody change
        const asset = await this.assetRegistry.getAsset(this.channelName, step.data.assetId);
        return {
          owner: custodyChanges[0].args.previousOwner,
          status: Number(asset.status),
          operation: this.detectOriginalOperation(step.data.assetId),
          createdAt: Number(asset.createdAt),
          lastUpdated: Number(asset.createdAt) // Use creation time for genealogy
        };
      }
    }
    
    // For other steps or if no historical data, get current asset state
    const asset = await this.assetRegistry.getAsset(this.channelName, step.data.assetId);
    return {
      owner: asset.owner,
      status: Number(asset.status),
      operation: Number(asset.operation),
      createdAt: Number(asset.createdAt),
      lastUpdated: Number(asset.lastUpdated)
    };
  }

  //Detect original operation for genealogy assets
  private detectOriginalOperation(assetId: string): number {
    const lineageEvent = this.cache.getLineageEvents()
      .find(e => e.args.childAssetId === assetId);
    
    if (lineageEvent) {
      const relType = Number(lineageEvent.args.relationshipType);
      if (relType === 0) return 4; // SPLIT
      if (relType === 1) return 7; // TRANSFORM
      if (relType === 2) return 5; // GROUP
    }
    
    return 0; // CREATE (fallback)
  }

  private async getHistoricalAssetState(assetId: string, stepIndex: number, genealogyPath: string[]): Promise<any> {
    if (stepIndex === 0) {
      // For origin assets, always get the creation state
      return await this.getAssetCreationState(assetId);
    }
    
    // For genealogy assets, get state at the time of their creation (before any transfers/updates)
    return await this.getAssetAtCreationTime(assetId);
  }
}