import { MongoClient } from "mongodb";
import { IMongoConnection, MongoConnectionOptions } from "../types";
import { MongoConnectionBase } from "./MongoConnectionBase";

export class MongoDbConnection extends MongoConnectionBase implements IMongoConnection {
  public constructor(options: MongoConnectionOptions) {
    super({
      maxPoolSize: 5,
      minPoolSize: 1,
      ...options,
    });
  }

  public async connect(): Promise<void> {
    try {
      this.mongo = await MongoClient.connect(this.url, this.clientOptions);
      this.db = this.mongo.db(this.databaseName);

      this.logger.info("Connected to Mongo", this.clientOptions);
    } catch (err) {
      this.logger.error("Mongo encountered an error", { error: err });
    }
  }
}
