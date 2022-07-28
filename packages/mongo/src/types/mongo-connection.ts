import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { Logger } from "@lindorm-io/winston";
import {
  ClientSession,
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
  custom?: typeof MongoClient;
  database?: string;
  databaseOptions?: DbOptions;
  host?: string;
  port?: number;
  replicas?: Array<HostData>;
}

export type MongoConnectionOptions = ConnectionBaseOptions<MongoClientOptions> &
  ExtendedMongoClientOptions;

export interface WithTransactionContext<Options = any> {
  database: Db;
  logger: Logger;
  options: Options;
  session: ClientSession;

  collection(collection: string, options: CollectionOptions): Collection;
}

export type WithTransactionCallback<Result = any, Options = any> = (
  context: WithTransactionContext<Options>,
) => Promise<Result>;

export interface IMongoConnection extends IConnectionBase<MongoClient> {
  collection(collection: string, options?: CollectionOptions): Collection;
  withTransaction<Result = any, Options = any>(
    callback: WithTransactionCallback<Result, Options>,
    options?: Options,
  ): Promise<Result>;
}
