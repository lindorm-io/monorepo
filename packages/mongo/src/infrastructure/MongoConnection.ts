import { Collection, Db, MongoClient } from "mongodb";
import { IMongoConnection, MongoConnectionOptions } from "../types";
import { MongoConnectionBase } from "./MongoConnectionBase";
import { CustomClientConnection } from "./CustomClientConnection";
import { MongoDbConnection } from "./MongoDbConnection";

export class MongoConnection implements IMongoConnection {
  private connection: MongoConnectionBase;

  public constructor(options: MongoConnectionOptions) {
    if (options.customClient) {
      this.connection = new CustomClientConnection(options);
    } else {
      this.connection = new MongoDbConnection(options);
    }
  }

  public client(): MongoClient {
    return this.connection.client();
  }

  public async close(): Promise<void> {
    return this.connection.close();
  }

  public async collection(collection: string): Promise<Collection> {
    return await this.connection.collection(collection);
  }

  public async connect(): Promise<void> {
    return this.connection.connect();
  }

  public database(): Db {
    return this.connection.database();
  }

  public async waitForConnection(): Promise<void> {
    return this.connection.waitForConnection();
  }
}
