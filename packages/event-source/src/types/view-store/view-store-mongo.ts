import { MongoIndex } from "../mongo-base";
import { HandlerIdentifier } from "../handler";

export interface MongoViewStoreAttributes {
  id: string;
  name: string;
  context: string;

  processed_causation_ids: Array<string>;
  destroyed: boolean;
  meta: Record<string, any>;
  revision: number;
  state: Record<string, any>;

  created_at: Date;
  updated_at: Date;
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
