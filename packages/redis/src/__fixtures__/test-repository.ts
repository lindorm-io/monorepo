import { ILogger } from "@lindorm/logger";
import { Redis } from "ioredis";
import { RedisRepository } from "../classes";
import { TestEntity } from "./test-entity";

export class TestRepository extends RedisRepository<TestEntity> {
  public constructor(client: Redis, logger: ILogger) {
    super({
      Entity: TestEntity,
      logger,
      namespace: "test",
      client,
    });
  }
}
