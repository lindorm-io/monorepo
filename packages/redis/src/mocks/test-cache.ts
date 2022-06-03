import { CacheOptions } from "../types";
import { LindormCache } from "../cache";
import { TestEntity, TestEntityAttributes } from "@lindorm-io/entity";

export class TestCache extends LindormCache<TestEntityAttributes, TestEntity> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "TestEntity",
      indexedAttributes: ["name"],
    });
  }

  protected createEntity(data: TestEntityAttributes): TestEntity {
    return new TestEntity(data);
  }
}
