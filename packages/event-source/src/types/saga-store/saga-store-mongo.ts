import { Command } from "../../message";

export interface MongoSagaStoreAttributes {
  id: string;
  name: string;
  context: string;

  causation_list: Array<string>;
  destroyed: boolean;
  messages_to_dispatch: Array<Command>;
  revision: number;
  state: Record<string, any>;

  timestamp_created: Date;
  timestamp_modified: Date;
}

export interface MongoSagaStoreHandlerOptions {
  causationsCap?: number;
}
