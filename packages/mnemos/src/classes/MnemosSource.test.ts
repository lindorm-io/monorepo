import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { join } from "path";
import { TestEntityOne } from "../__fixtures__/entities/test-entity-one";
import { TestEntityTwo } from "../__fixtures__/entities/test-entity-two";
import { TestEntity } from "../__fixtures__/test-entity";
import { MnemosSource } from "./MnemosSource";

describe("MnemosSource", () => {
  let source: MnemosSource;

  beforeAll(() => {
    source = new MnemosSource({
      entities: [TestEntity, join(__dirname, "..", "__fixtures__", "entities")],
      logger: createMockLogger(),
    });
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
});
