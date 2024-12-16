import { Client } from "@elastic/elasticsearch";
import { ILogger } from "@lindorm/logger";
import { ElasticRepository } from "../classes";
import { TestEntity, TestEntityOptions } from "./test-entity";

export class TestRepository extends ElasticRepository<TestEntity, TestEntityOptions> {
  public constructor(client: Client, logger: ILogger) {
    super({
      Entity: TestEntity,
      client,
      config: {
        useExpiry: true,
        useSoftDelete: true,
      },
      logger,
      namespace: "TestNamespace",
      mappings: {
        properties: {
          email: { type: "text" },
          name: { type: "text" },
        },
      },
    });
  }
}
