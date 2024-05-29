import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import MockDate from "mockdate";
import { TestEntityOne } from "../__fixtures__/entities/test-entity-one";
import { TestEntityTwo } from "../__fixtures__/entities/test-entity-two";
import { TestEntity } from "../__fixtures__/test-entity";
import { TestRepository } from "../__fixtures__/test-repository";
import { RedisError } from "../errors";
import { RedisRepository } from "./RedisRepository";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("RedisRepository", () => {
  let redis: Redis;
  let repository: TestRepository;

  beforeAll(async () => {
    redis = new Redis("redis://localhost:6379");
    repository = new TestRepository(redis, createMockLogger());
  });

  afterAll(async () => {
    await redis.quit();
  });

  test("should count entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.count({ name: entity.name })).resolves.toEqual(1);
  });

  test("should create a new entity with default values", async () => {
    const entity = repository.create();

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: expect.any(String),
      createdAt: undefined,
      email: undefined,
      expiresAt: undefined,
      name: undefined,
      updatedAt: undefined,
    });
  });

  test("should create a new entity with custom values", async () => {
    const entity = repository.create({
      id: "0bc6f18f-48a7-52d4-a191-e15ed14eb087",
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      expiresAt: new Date("2021-01-01T00:00:00.000Z"),
      email: "test@lindorm.io",
      name: "Test User",
    });

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: "0bc6f18f-48a7-52d4-a191-e15ed14eb087",
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      expiresAt: new Date("2021-01-01T00:00:00.000Z"),
      email: "test@lindorm.io",
      name: "Test User",
    });
  });

  test("should delete entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.delete({ name: entity.name })).resolves.not.toThrow();

    await expect(repository.findOneById(entity.id)).resolves.toBeNull();
  });

  test("should delete entities by id", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.deleteById(entity.id)).resolves.not.toThrow();

    await expect(repository.findOneById(entity.id)).resolves.toBeNull();
  });

  test("should destroy an entity", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.destroy(entity)).resolves.not.toThrow();

    await expect(repository.findOneById(entity.id)).resolves.toBeNull();
  });

  test("should destroy many entities", async () => {
    const e1 = await repository.save(repository.create({ name: randomUUID() }));
    const e2 = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.destroyBulk([e1, e2])).resolves.not.toThrow();

    await expect(repository.findOneById(e1.id)).resolves.toBeNull();
    await expect(repository.findOneById(e2.id)).resolves.toBeNull();
  });

  test("should check if entity exists", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.exists({ name: entity.name })).resolves.toEqual(true);
  });

  test("should find entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.find({ name: entity.name })).resolves.toEqual([entity]);
  });

  test("should find one entity by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.findOne({ name: entity.name })).resolves.toEqual(entity);
  });

  test("should find one entity by criteria or throw", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.findOneOrFail({ name: entity.name })).resolves.toEqual(
      entity,
    );
    await expect(repository.findOneOrFail({ name: randomUUID() })).rejects.toThrow(
      RedisError,
    );
  });

  test("should find one entity by criteria or save", async () => {
    const name = randomUUID();
    await expect(repository.findOneOrSave({ name })).resolves.toEqual(
      expect.any(TestEntity),
    );

    await expect(repository.findOneOrFail({ name })).resolves.toEqual({
      createdAt: MockedDate,
      email: undefined,
      expiresAt: undefined,
      id: expect.any(String),
      name: name,
      updatedAt: MockedDate,
    });
  });

  test("should find one entity by id", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.findOneById(entity.id)).resolves.toEqual(entity);
  });

  test("should find one entity by id or throw", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.findOneByIdOrFail(entity.id)).resolves.toEqual(entity);
    await expect(repository.findOneByIdOrFail(randomUUID())).rejects.toThrow(RedisError);
  });

  test("should save an entity", async () => {
    await expect(
      repository.save(
        repository.create({
          email: "test@lindorm.io",
          name: "Test User",
        }),
      ),
    ).resolves.toEqual({
      id: expect.any(String),
      createdAt: MockedDate,
      email: "test@lindorm.io",
      expiresAt: undefined,
      name: "Test User",
      updatedAt: MockedDate,
    });
  });

  test("should use toJSON when it exists", async () => {
    const repo = new RedisRepository({
      Entity: TestEntityTwo,
      logger: createMockLogger(),
      redis,
    });

    const entity = await repo.save(repo.create({ _test: "any" }));

    await expect(repo.findOneById(entity.id)).resolves.toEqual(
      expect.objectContaining({ _test: undefined }),
    );
  });

  test("should validate an entity when it exists", async () => {
    const repo = new RedisRepository({
      Entity: TestEntityOne,
      logger: createMockLogger(),
      redis,
    });

    await expect(repo.save(repo.create({}))).rejects.toThrow("Missing email");
  });

  test("should save many entities", async () => {
    const e1 = repository.create({
      email: "test@lindorm.io",
      name: "Test User",
    });

    const e2 = repository.create({
      email: "test2@lindorm.io",
      name: "Test User 2",
    });

    await expect(repository.saveBulk([e1, e2])).resolves.toEqual([e1, e2]);
  });

  test("should get the time to live for an entity", async () => {
    const entity = await repository.save(
      repository.create({
        expiresAt: new Date("2024-01-01T10:00:00.000Z"),
      }),
    );

    await expect(repository.ttl(entity)).resolves.toEqual(7200);
  });

  test("should get the time to live for an entity by id", async () => {
    const entity = await repository.save(
      repository.create({
        expiresAt: new Date("2024-01-01T10:00:00.000Z"),
      }),
    );

    await expect(repository.ttlById(entity.id)).resolves.toEqual(7200);
  });
});
