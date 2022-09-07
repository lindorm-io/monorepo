import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import {
  Collection,
  CollectionOptions,
  Db,
  DbOptions,
  MongoClient,
  MongoClientOptions,
} from "mongodb";

export interface HostData {
  host: string;
  port: number;
}

export interface ExtendedMongoClientOptions extends MongoClientOptions {
  authSource?: string;
  custom?: typeof MongoClient;
  database?: string;
  databaseOptions?: DbOptions;
  host?: string;
  port?: number;
  replicas?: Array<HostData>;
}

export type MongoConnectionOptions = ConnectionBaseOptions<MongoClientOptions> &
  ExtendedMongoClientOptions;

export interface IMongoConnection extends IConnectionBase<MongoClient> {
  collection(collection: string, options?: CollectionOptions): Collection;

  database: Db;
}
