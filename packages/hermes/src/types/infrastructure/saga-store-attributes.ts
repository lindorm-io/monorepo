import { IHermesMessage } from "../../interfaces";

export interface SagaStoreAttributes {
  id: string;
  name: string;
  context: string;
  destroyed: boolean;
  messages_to_dispatch: Array<IHermesMessage>;
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
  created_at: Date;
}
