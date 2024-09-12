import { ILogger } from "@lindorm/logger";
import { MongoClient } from "mongodb";
import { MongoRepository } from "../classes";
import { TestEntity, TestEntityOptions } from "./test-entity";

export class TestRepository extends MongoRepository<TestEntity, TestEntityOptions> {
  public constructor(client: MongoClient, logger: ILogger) {
    super({
      Entity: TestEntity,
      client,
      database: "test",
      indexes: [],
      logger,
      namespace: "test",
    });
  }
}
