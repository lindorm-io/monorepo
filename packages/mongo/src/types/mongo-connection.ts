import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { MongoClient, MongoClientOptions } from "mongodb";

export type IMongoConnection = IConnectionBase<MongoClient>;

export interface ExtendedMongoClientOptions extends MongoClientOptions {
  custom?: typeof MongoClient;
  database?: string;
  host: string;
  port: number;
}

export type MongoConnectionOptions = ConnectionBaseOptions<MongoClientOptions> &
  ExtendedMongoClientOptions;
