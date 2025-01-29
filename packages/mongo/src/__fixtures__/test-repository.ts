import { ILogger } from "@lindorm/logger";
import { MongoClient } from "mongodb";
import { MONGO_ENTITY_CONFIG, MongoRepository } from "../classes";
import { TestEntity, TestEntityOptions } from "./test-entity";

export class TestRepository extends MongoRepository<TestEntity, TestEntityOptions> {
  public constructor(client: MongoClient, logger: ILogger) {
    super({
      Entity: TestEntity,
      client,
      config: MONGO_ENTITY_CONFIG,
      database: "test",
      indexes: [],
      logger,
      namespace: "test",
    });
  }
}
