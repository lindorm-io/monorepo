import { Client } from "@elastic/elasticsearch";
import { ILogger } from "@lindorm/logger";
import { ElasticRepository } from "../classes";
import { TestEntity, TestEntityOptions } from "./test-entity";

export class TestRepository extends ElasticRepository<TestEntity, TestEntityOptions> {
  public constructor(client: Client, logger: ILogger) {
    super({
      Entity: TestEntity,
      client,
      logger,
      namespace: "ns",
    });
  }
}
