export interface RedisViewStoreAttributes {
  id: string;
  name: string;
  context: string;

  causation_list: Array<string>;
  destroyed: boolean;
  meta: Record<string, any>;
  revision: number;
  state: Record<string, any>;

  created_at: Date;
  updated_at: Date;
}

export interface RedisViewStoreHandlerOptions {
  causationsCap?: number;
  expiration?: number;
}
