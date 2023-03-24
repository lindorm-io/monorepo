import { MongoRepositoryBase } from "../infrastructure";
import { TestEntity, TestEntityAttributes } from "@lindorm-io/entity";
import { IMongoConnection } from "../types";
import { Logger } from "@lindorm-io/core-logger";

export class TestMongoRepository extends MongoRepositoryBase<TestEntityAttributes, TestEntity> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "TestEntity",
      database: "TestDatabase",
      indices: [{ index: { name: 1 }, options: { unique: false } }],
    });
  }

  protected createDocument(entity: TestEntity): TestEntityAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: TestEntityAttributes): TestEntity {
    return new TestEntity(data);
  }

  protected async validateSchema(entity: TestEntity): Promise<void> {
    return entity.schemaValidation();
  }
}
