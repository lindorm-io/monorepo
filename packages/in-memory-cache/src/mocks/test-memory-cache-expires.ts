import { IMemoryDatabase } from "../types";
import { MemoryCacheBase } from "../infrastructure";
import { Logger } from "@lindorm-io/core-logger";
import { TestEntityExpires, TestEntityExpiresAttributes } from "./test-entity-expires";

export class TestMemoryCacheExpires extends MemoryCacheBase<
  TestEntityExpiresAttributes,
  TestEntityExpires
> {
  public constructor(database: IMemoryDatabase, logger: Logger) {
    super(database, logger, {
      entityName: "TestEntityExpires",
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
