import { Command } from "../../message";

export interface SagaStoreAttributes {
  id: string;
  name: string;
  context: string;
  destroyed: boolean;
  hash: string;
  messages_to_dispatch: Array<Command>;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SagaCausationAttributes {
  id: string;
  name: string;
  context: string;
  causation_id: string;
  timestamp: Date;
}
