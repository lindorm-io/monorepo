import { IRedisConnection } from "../types";
import { Logger } from "@lindorm-io/core-logger";
import { RedisRepositoryBase } from "../infrastructure";
import { TestEntityExpires, TestEntityExpiresAttributes } from "./test-entity-expires";

export class TestRedisRepositoryExpires extends RedisRepositoryBase<
  TestEntityExpiresAttributes,
  TestEntityExpires
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "TestEntityExpires",
      indexedAttributes: ["name"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: TestEntityExpires): TestEntityExpiresAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: TestEntityExpiresAttributes): TestEntityExpires {
    return new TestEntityExpires(data);
  }

  protected validateSchema(entity: TestEntityExpires): Promise<void> {
    return entity.schemaValidation();
  }
}
