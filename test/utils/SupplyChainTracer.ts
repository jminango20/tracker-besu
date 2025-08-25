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
    
    // 2. For each asset in genealogy, find custody/state changes
    for (let i = 0; i < genealogyPath.length; i++) {
      const currentAssetId = genealogyPath[i];
      const assetDetails = await this.getAssetDetails(currentAssetId);
      
      // Add the genealogical asset to path
      completePath.push({
        step: stepCounter++,
        type: i === 0 ? 'ORIGIN' : 'GENEALOGY',
        data: {
          assetId: currentAssetId,
          location: assetDetails.location,
          amount: assetDetails.amount,
          relationshipType: i > 0 ? this.getRelationshipType(currentAssetId, genealogyPath[i-1]) : undefined
        }
      });
      
      // Find custody changes for this asset
      const assetCustodyChanges = this.cache.getCustodyEvents()
        .filter(e => e.args.assetId === currentAssetId)
        .sort((a, b) => Number(a.args.timestamp) - Number(b.args.timestamp));
        
      for (const custodyEvent of assetCustodyChanges) {
        completePath.push({
          step: stepCounter++,
          type: 'CUSTODY',
          timestamp: custodyEvent.args.timestamp,
          data: {
            assetId: currentAssetId,
            location: custodyEvent.args.newLocation,
            amount: assetDetails.amount,
            previousOwner: custodyEvent.args.previousOwner,
            newOwner: custodyEvent.args.newOwner
          }
        });
      }
      
      // Find state changes for this asset
      const assetStateChanges = this.cache.getStateEvents()
        .filter(e => e.args.assetId === currentAssetId)
        .sort((a, b) => Number(a.args.timestamp) - Number(b.args.timestamp));
        
      for (const stateEvent of assetStateChanges) {
        completePath.push({
          step: stepCounter++,
          type: 'STATE',
          timestamp: stateEvent.args.timestamp,
          data: {
            assetId: currentAssetId,
            location: stateEvent.args.newLocation,
            amount: Number(stateEvent.args.newAmount),
            previousLocation: stateEvent.args.previousLocation
          }
        });
      }
    }

    // 3. Build summary
    const summary = this.buildPathSummary(completePath, genealogyPath);
    const origins = await this.findOrigins(assetId);

    console.log(`          🎯 Caminho completo construído com ${completePath.length} etapas`);

    return {
      assetId,
      totalSteps: completePath.length,
      origins: origins.origins.map(o => o.assetId),
      genealogyDepth: genealogyPath.length,
      path: completePath,
      summary
    };
  }

  private buildPathSummary(path: TraceabilityStep[], genealogyPath: string[]): any {
    const transfers = path.filter(s => s.type === 'CUSTODY').length;
    const stateChanges = path.filter(s => s.type === 'STATE').length;
    const transformations = genealogyPath.length - 1; // genealogy steps minus origin

    const summary = {
      totalTransfers: transfers,
      totalStateChanges: stateChanges,
      totalTransformations: transformations
    };

    // Calculate mass loss if possible
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
          lossPercentage: ((initial - final) / initial) * 100
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
    
    for (const step of path.path) {
        const asset = await this.assetRegistry.getAsset(this.channelName, step.data.assetId);
        
        const assetStep: AssetStep = {
            stepNumber: step.step,
            stepType: step.type,
            asset: {
                assetId: asset.assetId,
                owner: asset.owner,
                amount: Number(asset.amount),
                idLocal: asset.idLocal,
                status: Number(asset.status),
                operation: Number(asset.operation),
                createdAt: Number(asset.createdAt),
                lastUpdated: Number(asset.lastUpdated)
            },
            operation: this.getStepOperation(step.type, step.data, Number(asset.operation)),
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
                //previousAmount: step.data.previousAmount,
                //newAmount: step.data.newAmount
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
}