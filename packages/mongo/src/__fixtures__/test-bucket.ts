import { ILogger } from "@lindorm/logger";
import { MongoClient } from "mongodb";
import { MongoBucket } from "../classes";
import { TestFile } from "./test-file";

export class TestBucket extends MongoBucket<TestFile> {
  public constructor(client: MongoClient, logger: ILogger) {
    super({
      File: TestFile,
      client,
      database: "test",
      indexes: [{ index: { name: 1 } }],
      logger,
      namespace: "test",
    });
  }
}
