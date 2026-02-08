import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { join } from "path";
import { TestEntityOne } from "../__fixtures__/entities/test-entity-one";
import { TestEntityTwo } from "../__fixtures__/entities/test-entity-two";
import { TestEntity } from "../__fixtures__/test-entity";
import { TestFile } from "../__fixtures__/test-file";
import { MongoSource } from "./MongoSource";

describe("MongoSource", () => {
  let source: MongoSource;

  beforeAll(async () => {
    source = new MongoSource({
      entities: [TestEntity, join(__dirname, "..", "__fixtures__", "entities")],
      files: [TestFile, join(__dirname, "..", "__fixtures__", "files")],
      logger: createMockLogger(),
      url: "mongodb://root:example@localhost/admin?authSource=admin",
      database: "test_database",
    });
    await source.setup();
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should return a functioning bucket for directly registered file", async () => {
    const bucket = source.bucket(TestFile);

    expect(bucket).toBeDefined();

    await expect(bucket.find({ name: randomUUID() })).resolves.not.toThrow();
  });

  test("should return a functioning repository for directly registered entity", async () => {
    const repository = source.repository(TestEntity);

    expect(repository).toBeDefined();

    await expect(
      repository.save(repository.create({ name: randomUUID() })),
    ).resolves.toBeInstanceOf(TestEntity);
  });

  test("should return a repository for directory registered entity", () => {
    expect(source.repository(TestEntityOne)).toBeDefined();
    expect(source.repository(TestEntityTwo)).toBeDefined();
  });

  test("should ping the database", async () => {
    await expect(source.ping()).resolves.not.toThrow();
  });
});
