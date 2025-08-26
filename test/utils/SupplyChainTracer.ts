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

  // Build complete traceability path for an asset
  async getCompleteTraceabilityPath(assetId: string): Promise<CompleteTraceabilityPath> {
    const cached = this.cache.getCachedTraceabilityPath(assetId);
    if (cached) {
      console.log(`          ✅ Caminho em cache para: ${assetId.substring(0, 10)}...`);
      return cached;
    }

    console.log(`          🔍 CONSTRUINDO CAMINHO COMPLETO para: ${assetId.substring(0, 10)}...`);

    await this.ensureEventsLoaded();
    const path = await this.buildCompleteTraceabilityPath(assetId);
    
    this.cache.cacheTraceabilityPath(assetId, path);    
    return path;
  }

  // Find all origin assets for given asset
  async findOrigins(assetId: string): Promise<AssetOrigins> {
    const cached = this.cache.getCachedOrigins(assetId);
    if (cached) {
      return cached;
    }

    await this.ensureEventsLoaded();

    const { reverseLineageMap } = await this.getOrBuildLineageMaps();
    const originIds = await this.traceAssetToOrigins(assetId, reverseLineageMap);
    
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

    this.cache.cacheOrigins(assetId, origins);
    return origins;
  }

  // Get composition details for blend assets
  async getComposition(blendAssetId: string): Promise<AssetComposition | null> {
    // Check cache first
    const cached = this.cache.getCachedComposition(blendAssetId);
    if (cached) {
      return cached;
    }

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

    this.cache.cacheComposition(blendAssetId, composition);
    return composition;
  }

  // Capture all traceability events from transaction receipt
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

  // Get detailed asset path with historical state reconstruction
  async getDetailedAssetPath(assetId: string): Promise<DetailedAssetPath> {
    console.log(`\n   Construindo caminho detalhado para: ${assetId.substring(0, 10)}...`);
    
    const path = await this.buildCompleteTraceabilityPath(assetId);
    const origins = await this.findOrigins(assetId);
    
    const steps: AssetStep[] = [];
    
    // Build asset state timeline to get correct state for each step
    const assetTimeline = await this.buildAssetStateTimeline(assetId);
    
    for (const step of path.path) {
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

  // Build complete traceability path with historical state tracking
  private async buildCompleteTraceabilityPath(assetId: string): Promise<CompleteTraceabilityPath> {
    const completePath: TraceabilityStep[] = [];
    let stepCounter = 1;

    // 1. Build genealogical backbone
    const genealogyPath = await this.traceGenealogyToOrigin(assetId);
    
    // 2. For each asset in genealogy, add its lifecycle
    for (let i = 0; i < genealogyPath.length; i++) {
      const currentAssetId = genealogyPath[i];
      const isOrigin = i === 0;
      
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

  // Build chronological event timeline for specific asset
  private async buildChronologicalEventTimeline(assetId: string): Promise<any[]> {
    const events: any[] = [];
    
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

  // Get asset state at creation time
  private async getAssetStateAtCreation(assetId: string): Promise<any> {
    const asset = await this.assetRegistry.getAsset(this.channelName, assetId);
    
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

  // Build asset state timeline considering inheritance
  private async buildAssetStateTimeline(assetId: string): Promise<any[]> {
    const timeline: any[] = [];    
    const genealogyPath = await this.traceGenealogyToOrigin(assetId);
    
    // Build timeline for each asset in genealogy
    for (let i = 0; i < genealogyPath.length; i++) {
      const pathAssetId = genealogyPath[i];
      const asset = await this.assetRegistry.getAsset(this.channelName, pathAssetId);
      const events = await this.buildChronologicalEventTimeline(pathAssetId);
      
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
    
    timeline.sort((a, b) => a.timestamp - b.timestamp);
    
    return timeline;
  }

  // Find asset state for specific step in timeline
  private findAssetStateForStep(step: TraceabilityStep, timeline: any[]): any {
    if (!step.timestamp) {
      const assetStates = timeline.filter(state => state.assetId === step.data.assetId);
      return assetStates[0] || timeline[0];
    }
    
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

  // Build path summary with operation metrics
  private buildPathSummary(path: TraceabilityStep[], genealogyPath: string[]): any {
    const transfers = path.filter(s => s.type === 'CUSTODY').length;
    const stateChanges = path.filter(s => s.type === 'STATE').length;
    const transformations = genealogyPath.length - 1; // genealogy steps minus origin
    
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

  // Build and cache lineage maps for graph traversal
  private async getOrBuildLineageMaps(): Promise<{ lineageMap: Map<string, any[]>, reverseLineageMap: Map<string, any[]> }> {
    const cached = this.cache.getLineageMaps();
    if (cached) {
      return cached;
    }

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

    this.cache.setLineageMaps(lineageMap, reverseLineageMap);
    return { lineageMap, reverseLineageMap };
  }

  // Trace asset genealogy to origin using DFS
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

  // Trace genealogical path to origin
  private async traceGenealogyToOrigin(assetId: string): Promise<string[]> {
    const { reverseLineageMap } = await this.getOrBuildLineageMaps();
    const path: string[] = [];
    const visited = new Set<string>();
    
    const tracePath = (currentId: string): void => {
      if (visited.has(currentId) || path.length > 10) return;
      visited.add(currentId);
      path.unshift(currentId);
      
      const parents = reverseLineageMap.get(currentId) || [];
      
      // Follow only genealogical parents (exclude transfers/updates)
      const genealogicalParents = parents.filter(p => p.relType !== 3 && p.relType !== 4);
      
      if (genealogicalParents.length > 0) {
        tracePath(genealogicalParents[0].parent);
      }
    };
    
    tracePath(assetId);
    return path;
  }

  // Display detailed path as JSON
  displayDetailedPathJSON(detailedPath: DetailedAssetPath): void {
    console.log('\n   Complete JSON Output:');
    const serializable = this.convertBigIntsToNumbers(detailedPath);
    console.log(JSON.stringify(serializable, null, 2));
  }

  // isplay detailed path in table format
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

  // Event handling methods
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

  // Utility and helper methods
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

  private calculateLossPercentage(initial: number, final: number): number {
    if (initial === 0) return 0;
    return ((initial - final) / initial) * 100;
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
}