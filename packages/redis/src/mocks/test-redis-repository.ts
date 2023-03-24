import { IRedisConnection } from "../types";
import { Logger } from "@lindorm-io/core-logger";
import { RedisRepositoryBase } from "../infrastructure";
import { TestEntity, TestEntityAttributes } from "@lindorm-io/entity";

export class TestRedisRepository extends RedisRepositoryBase<TestEntityAttributes, TestEntity> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "TestEntity",
      indexedAttributes: ["name"],
    });
  }

  protected createDocument(entity: TestEntity): TestEntityAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: TestEntityAttributes): TestEntity {
    return new TestEntity(data);
  }

  protected validateSchema(entity: TestEntity): Promise<void> {
    return entity.schemaValidation();
  }
}
