import { ILogger } from "@lindorm/logger";
import { Redis } from "ioredis";
import { REDIS_ENTITY_CONFIG, RedisRepository } from "../classes";
import { TestEntity } from "./test-entity";

export class TestRepository extends RedisRepository<TestEntity> {
  public constructor(client: Redis, logger: ILogger) {
    super({
      Entity: TestEntity,
      client,
      config: REDIS_ENTITY_CONFIG,
      logger,
      namespace: "test",
    });
  }
}
