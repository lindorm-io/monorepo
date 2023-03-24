export interface RedisDocument {
  id: string;
  version: number;
}

export interface RedisEntity {
  id: string;
  updated: Date;
}
