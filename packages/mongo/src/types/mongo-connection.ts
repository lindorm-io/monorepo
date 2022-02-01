import { Collection, Db, MongoClient, MongoClientOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";

export interface IMongoConnection {
  client(): MongoClient;
  close(): Promise<void>;
  collection(collection: string): Promise<Collection>;
  connect(): Promise<void>;
  database(): Db;
  waitForConnection(): Promise<void>;
}

export interface MongoOptions extends MongoClientOptions {
  host: string;
  port: number;
}

export interface MongoConnectionOptions extends MongoOptions {
  customClient?: typeof MongoClient;
  database: string;
  winston: Logger;
}
