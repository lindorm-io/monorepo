import { Dict } from "@lindorm/types";

export interface ViewStoreAttributes {
  id: string;
  name: string;
  namespace: string;
  destroyed: boolean;
  meta: Dict;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Dict;
  created_at: Date;
  updated_at: Date;
}

export interface ViewCausationAttributes {
  id: string;
  name: string;
  namespace: string;
  causation_id: string;
  created_at: Date;
}
