import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { ClientSession, MongoClient, MongoClientOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";

export interface ExtendedMongoClientOptions extends MongoClientOptions {
  custom?: typeof MongoClient;
  database?: string;
  host: string;
  port: number;
}

export type MongoConnectionOptions = ConnectionBaseOptions<MongoClientOptions> &
  ExtendedMongoClientOptions;

export interface WithTransactionContext<Options = any> {
  client: MongoClient;
  logger: Logger;
  options: Options;
  session: ClientSession;
}

export type WithTransactionCallback<Result = any, Options = any> = (
  context: WithTransactionContext<Options>,
) => Promise<Result>;

export interface IMongoConnection extends IConnectionBase<MongoClient> {
  withTransaction<Result = any, Options = any>(
    callback: WithTransactionCallback<Result, Options>,
    options?: Options,
  ): Promise<Result>;
}
