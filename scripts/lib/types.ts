export interface DeploymentInfo {
  contractName: string;
  address: string;
  deployer: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  deploymentArgs: any[];
  timestamp: number;
}

export interface NetworkDeployments {
  [contractName: string]: DeploymentInfo;
}