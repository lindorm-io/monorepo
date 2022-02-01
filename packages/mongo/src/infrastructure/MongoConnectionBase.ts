import { Collection, Db, MongoClient, MongoClientOptions } from "mongodb";
import { IMongoConnection, MongoConnectionOptions } from "../types";
import { Logger } from "@lindorm-io/winston";
import { INTERVAL, TIMEOUT } from "../constant";

export abstract class MongoConnectionBase implements IMongoConnection {
  protected readonly clientOptions: MongoClientOptions;
  protected readonly databaseName: string;
  protected readonly logger: Logger;
  protected readonly url: string;

  protected db: Db | undefined;
  protected mongo: MongoClient | undefined;

  protected constructor(options: MongoConnectionOptions) {
    const { host, port, database, winston, ...clientOptions } = options;

    this.clientOptions = clientOptions;
    this.databaseName = database;
    this.logger = winston.createChildLogger("MongoConnection");
    this.url = `mongodb://${host}:${port}/`;
  }

  public client(): MongoClient {
    if (!this.mongo) {
      throw new Error("Client could not be found. Call waitForConnection() first.");
    }

    return this.mongo;
  }

  public async close(): Promise<void> {
    if (!this.mongo) return;

    await this.mongo.close();
  }

  public async collection(collection: string): Promise<Collection> {
    if (!this.db) {
      throw new Error("Collection could not be found. Call waitForConnection() first.");
    }

    return await this.db.collection(collection);
  }

  public abstract connect(): Promise<void>;

  public database(): Db {
    if (!this.db) {
      throw new Error("Database could not be found. Call waitForConnection() first.");
    }

    return this.db;
  }

  public async waitForConnection(): Promise<void> {
    if (this.mongo && this.db) return;

    if (!this.mongo) {
      await this.connect();
    }

    const timeout = TIMEOUT;
    let interval: NodeJS.Timer;
    let time = 0;

    return new Promise((resolve, reject) => {
      interval = setInterval(() => {
        if (this.mongo && this.db) {
          clearInterval(interval);
          resolve();
        }

        if (time >= timeout) {
          clearInterval(interval);
          reject(new Error("Unable to establish connection"));
        }

        time += INTERVAL;
      }, INTERVAL);
    });
  }
}
