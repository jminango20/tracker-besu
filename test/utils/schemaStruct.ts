import { 
    SCHEMA_1, 
    CHANNEL_1,
    DATA_HASH_1,
    DATA_HASH_2 
} from "./constants";

export const schemaInput = {
    id: SCHEMA_1,
    name: "Test Schema",
    version: 1,
    dataHash: DATA_HASH_1,
    channelName: CHANNEL_1,
    description: "Test schema description"
  };

export const schemaUpdateInput = {
    id: SCHEMA_1,
    newVersion: 2,
    newDataHash: DATA_HASH_2,
    channelName: CHANNEL_1,
    description: "Updated schema description"
  };
