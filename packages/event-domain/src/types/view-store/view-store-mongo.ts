import { MongoIndex } from "../mongo-base";
import { HandlerIdentifier } from "../handler";

export interface MongoViewStoreAttributes {
  id: string;
  name: string;
  context: string;

  causation_list: Array<string>;
  destroyed: boolean;
  meta: Record<string, any>;
  revision: number;
  state: Record<string, any>;

  timestamp_created: Date;
  timestamp_modified: Date;
}

export interface MongoViewStoreHandlerOptions {
  collection?: string;
  causationsCap?: number;
  indices?: Array<MongoIndex>;
}

export interface MongoViewStoreCollectionOptions {
  collection?: string;
  indices?: Array<MongoIndex>;
  view: HandlerIdentifier;
}
