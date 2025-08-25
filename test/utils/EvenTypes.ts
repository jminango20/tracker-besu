export interface LineageEvent {
  args: {
    channelName: string;
    childAssetId: string;
    parentAssetId: string;
    relationshipType: number;
    timestamp: number;
  };
}

export interface CustodyEvent {
  args: {
    channelName: string;
    assetId: string;
    previousOwner: string;
    newOwner: string;
    newLocation: string;
    timestamp: number;
  };
}

export interface StateEvent {
  args: {
    channelName: string;
    assetId: string;
    previousLocation: string;
    newLocation: string;
    previousAmount: number;
    newAmount: number;
    timestamp: number;
  };
}

export interface CompositionEvent {
  args: {
    channelName: string;
    assetId: string;
    componentAssets: string[];
    componentAmounts: number[];
    timestamp: number;
  };
}

export interface DepthEvent {
  args: {
    channelName: string;
    assetId: string;
    depth: number;
    originAssets: string[];
  };
}

export interface RelationshipEvent {
  args: {
    channelName: string;
    primaryAssetId: string;
    relatedAssets: string[];
    operationType: number;
    blockNumber: number;
  };
}

// Output Types
export interface TraceabilityStep {
  step: number;
  type: 'ORIGIN' | 'GENEALOGY' | 'CUSTODY' | 'STATE';
  timestamp?: number;
  data: {
    assetId: string;
    location: string;
    amount: number;
    previousOwner?: string;
    newOwner?: string;
    previousLocation?: string;
    relationshipType?: string;
  };
}

export interface CompleteTraceabilityPath {
  assetId: string;
  totalSteps: number;
  origins: string[];
  genealogyDepth: number;
  path: TraceabilityStep[];
  summary: {
    totalTransfers: number;
    totalStateChanges: number;
    totalTransformations: number;
    massLoss?: {
      initial: number;
      final: number;
      lossPercentage: number;
    };
  };
}

export interface AssetComposition {
  assetId: string;
  componentCount: number;
  totalAmount: number;
  components: {
    assetId: string;
    amount: number;
    percentage: number;
    location: string;
    origins: string[];
  }[];
  timestamp: number;
}

export interface AssetOrigins {
  assetId: string;
  origins: {
    assetId: string;
    location: string;
    amount: number;
    depth: number;
  }[];
  totalOrigins: number;
}

export interface AssetStep {
  stepNumber: number;
  stepType: 'ORIGIN' | 'GENEALOGY' | 'CUSTODY' | 'STATE';
  asset: {
    assetId: string;
    owner: string;
    amount: number;
    idLocal: string;
    status: number;
    operation: number;
    createdAt: number;
    lastUpdated: number;
  };
  operation: string;
  timestamp?: number;
  custodyChange?: {
    previousOwner: string;
    newOwner: string;
    location: string;
  };
  stateChange?: {
    previousLocation: string;
    newLocation: string;
    previousAmount?: number;
    newAmount?: number;
  };
}

export interface DetailedAssetPath {
  assetId: string;
  totalSteps: number;
  origins: number;
  initialAmount: number;
  finalAmount: number;
  lossPercentage: number;
  steps: AssetStep[];
}