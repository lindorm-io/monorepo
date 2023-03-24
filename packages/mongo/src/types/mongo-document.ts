export interface MongoDocument {
  id: string;
  version: number;
}

export interface MongoEntity {
  id: string;
  updated: Date;
  revision: number;
}
