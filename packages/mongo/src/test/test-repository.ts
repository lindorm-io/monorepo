import { LindormRepository } from "../repository";
import { RepositoryOptions } from "../types";
import { TestEntity, TestEntityAttributes } from "@lindorm-io/entity";

export class TestRepository extends LindormRepository<TestEntityAttributes, TestEntity> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "TestRepository",
      indices: [{ index: { name: 1 }, options: { unique: false } }],
    });
  }

  protected createEntity(data: TestEntityAttributes): TestEntity {
    return new TestEntity(data);
  }
}
