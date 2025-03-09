import { ILogger } from "@lindorm/logger";
import { Redis } from "ioredis";
import { RedisRepository } from "../classes";
import { TestEntity, TestEntityOptions } from "./test-entity";

export class TestRepository extends RedisRepository<TestEntity, TestEntityOptions> {
  public constructor(client: Redis, logger: ILogger) {
    super({
      Entity: TestEntity,
      client,
      logger,
      namespace: "ns",
    });
  }
}
