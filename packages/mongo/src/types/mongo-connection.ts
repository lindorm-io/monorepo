import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { MongoClient, MongoClientOptions } from "mongodb";

export type IMongoConnection = IConnectionBase<MongoClient>;

export interface ExtendedMongoClientOptions extends MongoClientOptions {
  host: string;
  port: number;
  database?: string;
}

export type MongoConnectionOptions = ConnectionBaseOptions<MongoClientOptions> &
  ExtendedMongoClientOptions;
