import { Client } from "@elastic/elasticsearch";
import { ILogger } from "@lindorm/logger";
import {
  ELASTIC_ENTITY_CONFIG,
  ELASTIC_ENTITY_MAPPING_PROPERTIES,
  ElasticRepository,
} from "../classes";
import { TestEntity, TestEntityOptions } from "./test-entity";

export class TestRepository extends ElasticRepository<TestEntity, TestEntityOptions> {
  public constructor(client: Client, logger: ILogger) {
    super({
      Entity: TestEntity,
      client,
      config: ELASTIC_ENTITY_CONFIG,
      logger,
      namespace: "TestNamespace",
      mappings: {
        properties: {
          ...ELASTIC_ENTITY_MAPPING_PROPERTIES,
          email: { type: "text" },
          name: { type: "text" },
        },
      },
    });
  }
}
