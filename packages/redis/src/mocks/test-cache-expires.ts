import { CacheOptions } from "../types";
import { LindormCache } from "../infrastructure";
import { TestEntityExpires, TestEntityExpiresAttributes } from "./test-entity-expires";

export class TestCacheExpires extends LindormCache<TestEntityExpiresAttributes, TestEntityExpires> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "TestEntityExpires",
      indexedAttributes: ["name"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: TestEntityExpiresAttributes): TestEntityExpires {
    return new TestEntityExpires(data);
  }
}
