import RedisMock from "ioredis-mock";
import { Redis } from "ioredis";
import { RedisConnection } from "../infrastructure";
import { logger, TestCache, TestEntity } from "../test";
import { randomUUID } from "crypto";

const entityKey = (entity: any): string => `entity::test_entity::${entity.id}`;

describe("LindormCache", () => {
  let cache: TestCache;
  let connection: RedisConnection;
  let entity: TestEntity;
  let redis: Redis;

  beforeAll(async () => {
    connection = new RedisConnection({
      host: "localhost",
      port: 6379,
      winston: logger,
      customClient: new RedisMock({
        host: "localhost",
        port: 6379,
      }) as Redis,
    });

    await connection.waitForConnection();

    redis = connection.client();
    cache = new TestCache({ client: connection.client(), logger });
  });

  afterAll(async () => {
    await connection.quit();
  });

  beforeEach(async () => {
    entity = await cache.create(new TestEntity());
  });

  test("should create", async () => {
    await expect(redis.get(entityKey(entity))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"test-entity-name"/),
    );
  });

  test("should create with expiry", async () => {
    entity = await cache.create(new TestEntity(), 900);

    await expect(redis.get(entityKey(entity))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"test-entity-name"/),
    );
    await expect(redis.ttl(entityKey(entity))).resolves.toBe(900);
  });

  test("should destroy", async () => {
    await cache.destroy(entity);

    await expect(redis.get(entityKey(entity))).resolves.toBe(null);
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
    entity = await cache.create(new TestEntity(), 700);

    await expect(cache.ttl(entity)).resolves.toBe(700);
  });

  test("should update", async () => {
    entity.name = "new-entity-name";

    await cache.update(entity);

    await expect(redis.get(entityKey(entity))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"new-entity-name"/),
    );
  });
});
