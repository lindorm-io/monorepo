import MockDate from "mockdate";
import { MemoryDatabase } from "../classes";
import { TestEntity } from "@lindorm-io/entity";
import { TestEntityExpires, TestMemoryCache, TestMemoryCacheExpires } from "../mocks";
import { createMockLogger } from "@lindorm-io/core-logger";
import { randomUUID } from "crypto";

MockDate.set("2022-01-01T08:00:00.000Z");

describe("LindormCache", () => {
  let database: MemoryDatabase;
  let cache: TestMemoryCache;
  let cacheExpires: TestMemoryCacheExpires;

  const logger = createMockLogger();

  beforeEach(async () => {
    database = new MemoryDatabase();
    cache = new TestMemoryCache(database, logger);
    cacheExpires = new TestMemoryCacheExpires(database, logger);
  });

  test("should create", async () => {
    await cache.create(new TestEntity({ name: "test-entity-name" }));

    expect(database.collection("TestEntity").filter()).toStrictEqual([
      expect.objectContaining({ name: "test-entity-name" }),
    ]);
  });

  test("should create with expiry", async () => {
    await cacheExpires.create(
      new TestEntityExpires({
        name: "test-entity-expires",
        expires: new Date("2022-01-01T08:15:00.000Z"),
      }),
    );

    expect(database.collection("TestEntityExpires").filter()).toStrictEqual([
      expect.objectContaining({ name: "test-entity-expires" }),
    ]);
  });

  test("should delete many", async () => {
    await cache.create(new TestEntity({ name: "destroy" }));
    await cache.create(new TestEntity({ name: "destroy" }));

    await cache.deleteMany({ name: "destroy" });

    expect(database.collection("TestEntity").filter()).toStrictEqual([]);
  });

  test("should destroy", async () => {
    const entity = await cache.create(new TestEntity({ name: "destroy" }));

    await cache.destroy(entity);

    expect(database.collection("TestEntity").filter()).toStrictEqual([]);
  });

  test("should destroy many", async () => {
    const destroy1 = await cache.create(new TestEntity({ name: "destroy" }));
    const destroy2 = await cache.create(new TestEntity({ name: "destroy" }));

    await cache.destroyMany([destroy1, destroy2]);

    expect(database.collection("TestEntity").filter()).toStrictEqual([]);
  });

  test("should find using id", async () => {
    const entity = await cache.create(new TestEntity({ name: "test-entity-name" }));

    await expect(cache.find({ id: entity.id })).resolves.toStrictEqual(entity);
  });

  test("should find or create using id", async () => {
    await cache.create(new TestEntity({ name: "test-entity-name" }));

    await expect(cache.findOrCreate({ id: randomUUID() })).resolves.toStrictEqual(
      expect.any(TestEntity),
    );
  });

  test("should find using name", async () => {
    const entity = await cache.create(new TestEntity({ name: "test-entity-name" }));

    await expect(cache.find({ name: "test-entity-name" })).resolves.toStrictEqual(entity);
  });

  test("should find many", async () => {
    const entity = await cache.create(new TestEntity({ name: "test-entity-name" }));

    await expect(cache.findMany({ name: "test-entity-name" })).resolves.toStrictEqual(
      expect.arrayContaining([entity]),
    );
  });

  test("should find all", async () => {
    const entity = await cache.create(new TestEntity({ name: "test-entity-name" }));

    await expect(cache.findMany({})).resolves.toStrictEqual(expect.arrayContaining([entity]));
  });

  test("should clear expired before resolving", async () => {
    const entity = await cacheExpires.create(
      new TestEntityExpires({ name: "not-expired", expires: new Date("2022-01-01T08:30:00.000Z") }),
    );

    await cacheExpires.create(
      new TestEntityExpires({ name: "expired", expires: new Date("2022-01-01T07:30:00.000Z") }),
    );

    await expect(cacheExpires.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([entity]),
    );

    expect(database.collection("TestEntityExpires").filter()).toStrictEqual([
      expect.objectContaining({ name: "not-expired" }),
    ]);
  });

  test("should resolve undefined when entity cannot be found", async () => {
    await cache.create(new TestEntity({ name: "test-entity-name" }));

    await expect(cache.tryFind({ name: "wrong" })).resolves.toBeUndefined();
  });

  test("should return entity ttl", async () => {
    const entity = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: new Date("2022-01-01T08:30:00.000Z") }),
    );

    await expect(cacheExpires.ttl(entity)).resolves.toBe(1800);
  });

  test("should update", async () => {
    const entity = await cache.create(new TestEntity({ name: "test-entity-name" }));

    entity.name = "new-entity-name";

    await cache.update(entity);

    expect(database.collection("TestEntity").filter()).toStrictEqual([
      expect.objectContaining({ name: "new-entity-name" }),
    ]);
  });

  test("should update and set new expiry", async () => {
    const entity = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: new Date("2022-01-01T08:30:00.000Z") }),
    );

    entity.name = "new-entity-expires-name";
    entity.expires = new Date("2022-01-01T08:20:00.000Z");

    await cacheExpires.update(entity);

    expect(database.collection("TestEntityExpires").filter()).toStrictEqual([
      expect.objectContaining({
        name: "new-entity-expires-name",
        expires: new Date("2022-01-01T08:20:00.000Z"),
      }),
    ]);
  });

  test("should update and keep expiry", async () => {
    const entity = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: new Date("2022-01-01T08:30:00.000Z") }),
    );

    entity.name = "new-entity-expires-name";

    await cacheExpires.update(entity);

    expect(database.collection("TestEntityExpires").filter()).toStrictEqual([
      expect.objectContaining({
        name: "new-entity-expires-name",
        expires: new Date("2022-01-01T08:30:00.000Z"),
      }),
    ]);
  });
});
