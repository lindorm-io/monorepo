import { Command } from "../../message";

export interface MongoSagaStoreAttributes {
  id: string;
  name: string;
  context: string;

  processed_causation_ids: Array<string>;
  destroyed: boolean;
  messages_to_dispatch: Array<Command>;
  revision: number;
  state: Record<string, any>;

  created_at: Date;
  updated_at: Date;
}

export interface MongoSagaStoreHandlerOptions {
  causationsCap?: number;
}
