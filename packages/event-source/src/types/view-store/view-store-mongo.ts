import { MongoIndex } from "../mongo-base";

export interface MongoViewEventHandlerAdapterOptions {
  collection?: string;
  indices?: Array<MongoIndex>;
}
