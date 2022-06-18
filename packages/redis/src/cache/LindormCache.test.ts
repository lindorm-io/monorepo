import MockDate from "mockdate";
import RedisMock from "ioredis-mock";
import { Redis } from "ioredis";
import { RedisConnection } from "../infrastructure";
import { TestCache, TestCacheExpires, TestEntityExpires } from "../mocks";
import { TestEntity } from "@lindorm-io/entity";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";

MockDate.set("2022-01-01T08:00:00.000Z");

const entityKey = (entity: any): string => `entity::test_entity::${entity.id}`;
const entityExpiresKey = (entity: any): string => `entity::test_entity_expires::${entity.id}`;

describe("LindormCache", () => {
  let cache: TestCache;
  let connection: RedisConnection;
  let entity: TestEntity;
  let redis: Redis;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new RedisConnection({
      host: "localhost",
      port: 6379,
      winston: logger,
      customClient: new RedisMock({
        host: "localhost",
        port: 6379,
      }) as unknown as Redis,
    });

    await connection.waitForConnection();

    redis = connection.client();
    cache = new TestCache({ connection, logger });
  });

  afterAll(async () => {
    await connection.quit();
  });

  beforeEach(async () => {
    entity = await cache.create(new TestEntity({ name: "test-entity-name" }));
  });

  test("should create", async () => {
    await expect(redis.get(entityKey(entity))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"test-entity-name"/),
    );
  });

  test("should create with expiry", async () => {
    const cacheExpires = new TestCacheExpires({ connection, logger });

    const entityExpires = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: new Date("2022-01-01T08:15:00.000Z") }),
    );

    await expect(redis.get(entityExpiresKey(entityExpires))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"expires"/),
    );
    await expect(redis.ttl(entityExpiresKey(entityExpires))).resolves.toBe(900);
  });

  test("should create without expiry", async () => {
    const cacheExpires = new TestCacheExpires({ connection, logger });

    const entityExpires = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: null }),
    );

    await expect(redis.get(entityExpiresKey(entityExpires))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"expires"/),
    );
    await expect(redis.ttl(entityExpiresKey(entityExpires))).resolves.toBe(-1);
  });

  test("should delete many", async () => {
    const destroy1 = await cache.create(new TestEntity({ name: "destroy" }));
    const destroy2 = await cache.create(new TestEntity({ name: "destroy" }));

    await cache.deleteMany({ name: "destroy" });

    await expect(redis.get(entityKey(destroy1))).resolves.toBe(null);
    await expect(redis.get(entityKey(destroy2))).resolves.toBe(null);
  });

  test("should destroy", async () => {
    await cache.destroy(entity);

    await expect(redis.get(entityKey(entity))).resolves.toBe(null);
  });

  test("should destroy many", async () => {
    const destroy1 = await cache.create(new TestEntity({ name: "destroy" }));
    const destroy2 = await cache.create(new TestEntity({ name: "destroy" }));

    await cache.destroyMany([destroy1, destroy2]);

    await expect(redis.get(entityKey(destroy1))).resolves.toBe(null);
    await expect(redis.get(entityKey(destroy2))).resolves.toBe(null);
  });

  test("should find using id", async () => {
    await expect(cache.find({ id: entity.id })).resolves.toStrictEqual(entity);
  });

  test("should find or create using id", async () => {
    await expect(cache.findOrCreate({ id: randomUUID() })).resolves.toStrictEqual(
      expect.any(TestEntity),
    );
  });

  test("should find using name", async () => {
    await expect(cache.find({ name: "test-entity-name" })).resolves.toStrictEqual(entity);
  });

  test("should find many", async () => {
    await expect(cache.findMany({ name: "test-entity-name" })).resolves.toStrictEqual(
      expect.arrayContaining([entity]),
    );
  });

  test("should find all", async () => {
    await expect(cache.findMany({})).resolves.toStrictEqual(expect.arrayContaining([entity]));
  });

  test("should resolve null when entity cannot be found", async () => {
    await expect(cache.tryFind({ name: "wrong" })).resolves.toBeNull();
  });

  test("should return entity ttl", async () => {
    const cacheExpires = new TestCacheExpires({ connection, logger });

    const entityExpires = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: new Date("2022-01-01T08:30:00.000Z") }),
    );

    await expect(cacheExpires.ttl(entityExpires)).resolves.toBe(1800);
  });

  test("should update", async () => {
    entity.name = "new-entity-name";

    await cache.update(entity);

    await expect(redis.get(entityKey(entity))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"new-entity-name"/),
    );
  });
});
