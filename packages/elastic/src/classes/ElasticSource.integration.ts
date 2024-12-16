import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { join } from "path";
import { TestEntityOne } from "../__fixtures__/entities/test-entity-one";
import { TestEntityTwo } from "../__fixtures__/entities/test-entity-two";
import { TestEntity } from "../__fixtures__/test-entity";
import { ElasticSource } from "./ElasticSource";

describe("ElasticSource", () => {
  let source: ElasticSource;

  beforeAll(async () => {
    source = new ElasticSource({
      entities: [TestEntity, join(__dirname, "..", "__fixtures__", "entities")],
      logger: createMockLogger(),
      url: "http://elastic:changeme@localhost:9200",
    });
    await source.setup();
  }, 30000);

  afterAll(async () => {
    await source.disconnect();
  });

  test("should return a functioning repository for directly registered entity", async () => {
    const repository = source.repository(TestEntity);

    expect(repository).toBeDefined();

    await expect(
      repository.find({ must: [{ match: { name: randomUUID() } }] }),
    ).resolves.not.toThrow();
  });

  test("should return a repository for directory registered entity", () => {
    expect(source.repository(TestEntityOne)).toBeDefined();
    expect(source.repository(TestEntityTwo)).toBeDefined();
  });
});
