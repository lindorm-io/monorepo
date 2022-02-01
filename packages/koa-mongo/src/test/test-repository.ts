import { LindormRepository, RepositoryOptions } from "@lindorm-io/mongo";
import { TestEntity, TestEntityAttributes } from "./test-entity";

export class TestRepository extends LindormRepository<TestEntityAttributes, TestEntity> {
  public constructor(options: RepositoryOptions) {
    super({
      collectionName: "TestRepository",
      db: options.db,
      logger: options.logger,
      indices: [{ index: { name: 1 }, options: { unique: true } }],
    });
  }

  protected createEntity(data: TestEntityAttributes): TestEntity {
    return new TestEntity(data);
  }
}
