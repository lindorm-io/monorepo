export interface ViewStoreAttributes {
  id: string;
  name: string;
  context: string;
  destroyed: boolean;
  hash: string;
  meta: Record<string, any>;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ViewCausationAttributes {
  id: string;
  name: string;
  context: string;
  causation_id: string;
  timestamp: Date;
}
