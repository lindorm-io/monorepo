import { IMongoConnection, MongoConnectionOptions } from "../types";
import { MongoClient } from "mongodb";
import { MongoConnectionBase } from "./MongoConnectionBase";

export class CustomClientConnection extends MongoConnectionBase implements IMongoConnection {
  private readonly customClient: typeof MongoClient;

  public constructor(options: MongoConnectionOptions) {
    super(options);

    this.customClient = options.customClient as typeof MongoClient;
  }

  public async connect(): Promise<void> {
    try {
      this.mongo = await this.customClient.connect(this.url, this.clientOptions);
      this.db = this.mongo.db(this.databaseName);

      this.logger.info("Connected to Mongo", this.clientOptions);
    } catch (err) {
      this.logger.error("Mongo encountered an error", { error: err });
    }
  }
}
