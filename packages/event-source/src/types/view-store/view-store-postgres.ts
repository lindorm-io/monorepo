import { MongoIndex } from "../mongo-base";

export interface PostgresViewEventHandlerAdapterOptions {
  indices?: Array<MongoIndex>;
}
