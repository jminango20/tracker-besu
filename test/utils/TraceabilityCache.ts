import { 
  LineageEvent, 
  CustodyEvent, 
  StateEvent, 
  CompositionEvent, 
  DepthEvent,
  RelationshipEvent,
  CompleteTraceabilityPath,
  AssetComposition,
  AssetOrigins
} from './EvenTypes';

export class TraceabilityCache {
  private lineageEvents: LineageEvent[] = [];
  private custodyEvents: CustodyEvent[] = [];
  private stateEvents: StateEvent[] = [];
  private compositionEvents: CompositionEvent[] = [];
  private depthEvents: DepthEvent[] = [];
  private relationshipEvents: RelationshipEvent[] = [];
  
  // Caches for computed results
  private pathCache = new Map<string, CompleteTraceabilityPath>();
  private originsCache = new Map<string, AssetOrigins>();
  private compositionCache = new Map<string, AssetComposition>();
  
  // Graph caches
  private lineageMapCache: Map<string, any[]> | null = null;
  private reverseLineageMapCache: Map<string, any[]> | null = null;

  // Event storage methods
  addLineageEvents(events: LineageEvent[]): void {
    this.lineageEvents.push(...events);
    this.invalidateGraphCaches();
  }

  addCustodyEvents(events: CustodyEvent[]): void {
    this.custodyEvents.push(...events);
    this.invalidatePathCaches();
  }

  addStateEvents(events: StateEvent[]): void {
    this.stateEvents.push(...events);
    this.invalidatePathCaches();
  }

  addCompositionEvents(events: CompositionEvent[]): void {
    this.compositionEvents.push(...events);
    this.invalidateCompositionCaches();
  }

  addDepthEvents(events: DepthEvent[]): void {
    this.depthEvents.push(...events);
  }

  addRelationshipEvents(events: RelationshipEvent[]): void {
    this.relationshipEvents.push(...events);
  }

  // Getters
  getLineageEvents(): LineageEvent[] {
    return this.lineageEvents;
  }

  getCustodyEvents(): CustodyEvent[] {
    return this.custodyEvents;
  }

  getStateEvents(): StateEvent[] {
    return this.stateEvents;
  }

  getCompositionEvents(): CompositionEvent[] {
    return this.compositionEvents;
  }

  getDepthEvents(): DepthEvent[] {
    return this.depthEvents;
  }

  getRelationshipEvents(): RelationshipEvent[] {
    return this.relationshipEvents;
  }

  // Cache management
  private invalidateGraphCaches(): void {
    this.lineageMapCache = null;
    this.reverseLineageMapCache = null;
    this.pathCache.clear();
    this.originsCache.clear();
  }

  private invalidatePathCaches(): void {
    this.pathCache.clear();
  }

  private invalidateCompositionCaches(): void {
    this.compositionCache.clear();
  }

  // Graph cache methods
  setLineageMaps(lineageMap: Map<string, any[]>, reverseLineageMap: Map<string, any[]>): void {
    this.lineageMapCache = lineageMap;
    this.reverseLineageMapCache = reverseLineageMap;
  }

  getLineageMaps(): { lineageMap: Map<string, any[]>, reverseLineageMap: Map<string, any[]> } | null {
    if (this.lineageMapCache && this.reverseLineageMapCache) {
      return {
        lineageMap: this.lineageMapCache,
        reverseLineageMap: this.reverseLineageMapCache
      };
    }
    return null;
  }

  // Result cache methods
  cacheTraceabilityPath(assetId: string, path: CompleteTraceabilityPath): void {
    this.pathCache.set(assetId, path);
  }

  getCachedTraceabilityPath(assetId: string): CompleteTraceabilityPath | undefined {
    return this.pathCache.get(assetId);
  }

  cacheOrigins(assetId: string, origins: AssetOrigins): void {
    this.originsCache.set(assetId, origins);
  }

  getCachedOrigins(assetId: string): AssetOrigins | undefined {
    return this.originsCache.get(assetId);
  }

  cacheComposition(assetId: string, composition: AssetComposition): void {
    this.compositionCache.set(assetId, composition);
  }

  getCachedComposition(assetId: string): AssetComposition | undefined {
    return this.compositionCache.get(assetId);
  }

  // Utility methods
  clear(): void {
    this.lineageEvents = [];
    this.custodyEvents = [];
    this.stateEvents = [];
    this.compositionEvents = [];
    this.depthEvents = [];
    this.relationshipEvents = [];
    this.pathCache.clear();
    this.originsCache.clear();
    this.compositionCache.clear();
    this.lineageMapCache = null;
    this.reverseLineageMapCache = null;
  }

  getStats(): {
    events: {
      lineage: number;
      custody: number;
      state: number;
      composition: number;
      depth: number;
      relationship: number;
    };
    cache: {
      paths: number;
      origins: number;
      compositions: number;
    };
  } {
    return {
      events: {
        lineage: this.lineageEvents.length,
        custody: this.custodyEvents.length,
        state: this.stateEvents.length,
        composition: this.compositionEvents.length,
        depth: this.depthEvents.length,
        relationship: this.relationshipEvents.length
      },
      cache: {
        paths: this.pathCache.size,
        origins: this.originsCache.size,
        compositions: this.compositionCache.size
      }
    };
  }
}