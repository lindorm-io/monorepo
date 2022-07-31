export interface RedisViewStoreAttributes {
  id: string;
  name: string;
  context: string;

  causation_list: Array<string>;
  destroyed: boolean;
  meta: Record<string, any>;
  revision: number;
  state: Record<string, any>;

  timestamp_created: Date;
  timestamp_modified: Date;
}

export interface RedisViewStoreHandlerOptions {
  causationsCap?: number;
  expiration?: number;
}
