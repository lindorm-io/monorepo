import { createMockLogger } from "@lindorm-io/core-logger";
import { TestEntity } from "@lindorm-io/entity";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import MockDate from "mockdate";
import { RedisConnection } from "../connections";
import { TestEntityExpires, TestRedisRepository, TestRedisRepositoryExpires } from "../mocks";
import { RedisIndex } from "./RedisIndex";

MockDate.set("2022-01-01T08:00:00.000Z");

const entityKey = (entity: any): string => `ns/entity/test_entity/${entity.id}`;
const entityExpiresKey = (entity: any): string => `ns/entity/test_entity_expires/${entity.id}`;

describe("LindormCache", () => {
  let cache: TestRedisRepository;
  let connection: RedisConnection;
  let index: RedisIndex<any>;
  let entity: TestEntity;
  let redis: Redis;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new RedisConnection(
      {
        host: "localhost",
        port: 5011,
        namespace: "ns",
      },
      logger,
    );

    await connection.connect();

    redis = connection.client;
    cache = new TestRedisRepository(connection, logger);
    index = new RedisIndex<any>(connection, logger, { indexKey: "name", prefix: "TestEntity" });
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
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
    const cacheExpires = new TestRedisRepositoryExpires(connection, logger);

    const entityExpires = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: new Date("2022-01-01T08:15:00.000Z") }),
    );

    await expect(redis.get(entityExpiresKey(entityExpires))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"expires"/),
    );
    await expect(redis.ttl(entityExpiresKey(entityExpires))).resolves.toBe(900);
  });

  test("should create without expiry", async () => {
    const cacheExpires = new TestRedisRepositoryExpires(connection, logger);

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

  test("should find using indexed name", async () => {
    await expect(cache.find({ name: "test-entity-name" })).resolves.toStrictEqual(entity);
  });

  test("should cleanup unused indices", async () => {
    const uuid = randomUUID();
    await index.add("test-entity-name", uuid);

    await expect(cache.find({ name: "test-entity-name" })).resolves.toStrictEqual(entity);

    await expect(index.get("test-entity-name")).resolves.not.toStrictEqual(
      expect.arrayContaining([uuid]),
    );
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
    const cacheExpires = new TestRedisRepositoryExpires(connection, logger);

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

  test("should update and set new expiry", async () => {
    const cacheExpires = new TestRedisRepositoryExpires(connection, logger);

    const entityExpires = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: new Date("2022-01-01T08:15:00.000Z") }),
    );

    entityExpires.name = "new-entity-expires-name";
    entityExpires.expires = new Date("2022-01-01T08:20:00.000Z");

    await cacheExpires.update(entityExpires);

    await expect(redis.get(entityExpiresKey(entityExpires))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"new-entity-expires-name"/),
    );
    await expect(redis.ttl(entityExpiresKey(entityExpires))).resolves.toBe(1200);
  });

  test("should update and keep expiry", async () => {
    const cacheExpires = new TestRedisRepositoryExpires(connection, logger);

    const entityExpires = await cacheExpires.create(
      new TestEntityExpires({ name: "expires", expires: new Date("2022-01-01T08:15:00.000Z") }),
    );

    entityExpires.name = "new-entity-expires-name";

    await cacheExpires.update(entityExpires);

    await expect(redis.get(entityExpiresKey(entityExpires))).resolves.toStrictEqual(
      expect.stringMatching(/"name":"new-entity-expires-name"/),
    );
    await expect(redis.ttl(entityExpiresKey(entityExpires))).resolves.toBe(900);
  });
});
