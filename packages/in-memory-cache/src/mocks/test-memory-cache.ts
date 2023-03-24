import { IMemoryDatabase } from "../types";
import { MemoryCacheBase } from "../infrastructure";
import { Logger } from "@lindorm-io/core-logger";
import { TestEntity, TestEntityAttributes } from "@lindorm-io/entity";

export class TestMemoryCache extends MemoryCacheBase<TestEntityAttributes, TestEntity> {
  public constructor(database: IMemoryDatabase, logger: Logger) {
    super(database, logger, { entityName: "TestEntity" });
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
