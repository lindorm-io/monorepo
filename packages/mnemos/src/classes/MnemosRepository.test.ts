import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { TestEntityOne } from "../__fixtures__/entities/test-entity-one";
import { TestEntity } from "../__fixtures__/test-entity";
import { TestRepository } from "../__fixtures__/test-repository";
import { IMnemosCache } from "../interfaces";
import { MnemosCache } from "./MnemosCache";
import { MnemosRepository } from "./MnemosRepository";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("MnemosRepository", () => {
  let cache: IMnemosCache;
  let repository: TestRepository;

  beforeAll(() => {
    cache = new MnemosCache();
    repository = new TestRepository(cache, createMockLogger());
  });

  test("should count entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.count({ name: entity.name })).resolves.toEqual(1);
  });

  test("should create a new entity with default values", async () => {
    const entity = repository.create({});

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: expect.any(String),
      createdAt: MockedDate,
      deletedAt: null,
      email: null,
      expiresAt: null,
      name: null,
      sequence: null,
      updatedAt: MockedDate,
      version: 0,
    });
  });

  test("should create a new entity with custom values", async () => {
    const entity = repository.create({
      id: "0bc6f18f-48a7-52d4-a191-e15ed14eb087",
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      deletedAt: null,
      email: "test@lindorm.io",
      expiresAt: new Date("2021-01-01T00:00:00.000Z"),
      name: "Test User",
      sequence: 123,
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      version: 2,
    });

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: "0bc6f18f-48a7-52d4-a191-e15ed14eb087",
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      deletedAt: null,
      email: "test@lindorm.io",
      expiresAt: new Date("2021-01-01T00:00:00.000Z"),
      name: "Test User",
      sequence: 123,
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      version: 2,
    });
  });

  test("should delete entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.delete({ name: entity.name })).resolves.toBeUndefined();
    await expect(repository.findOne({ id: entity.id })).resolves.toBeNull();
  });

  test("should destroy an entity", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.destroy(entity)).resolves.toBeUndefined();
    await expect(repository.findOne({ id: entity.id })).resolves.toBeNull();
  });

  test("should destroy many entities", async () => {
    const e1 = await repository.save(repository.create({ name: randomUUID() }));
    const e2 = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.destroyBulk([e1, e2])).resolves.toBeUndefined();

    await expect(repository.findOne({ id: e1.id })).resolves.toBeNull();
    await expect(repository.findOne({ id: e2.id })).resolves.toBeNull();
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
    await expect(repository.findOneOrFail({ name: randomUUID() })).rejects.toThrow();
  });

  test("should find one entity by criteria or save", async () => {
    const name = randomUUID();

    await expect(repository.findOneOrSave({ name })).resolves.toEqual(
      expect.any(TestEntity),
    );
    await expect(repository.findOneOrFail({ name })).resolves.toEqual(
      expect.any(TestEntity),
    );
  });

  test("should insert an entity", async () => {
    const entity = repository.create({
      id: randomUUID(),
      email: randomUUID(),
      name: randomUUID(),
    });

    await expect(repository.insert(entity)).resolves.toEqual(expect.any(TestEntity));
    await expect(repository.findOne({ id: entity.id })).resolves.toEqual({
      id: expect.any(String),
      createdAt: MockedDate,
      deletedAt: null,
      email: entity.email,
      expiresAt: null,
      name: entity.name,
      sequence: expect.any(Number),
      updatedAt: MockedDate,
      version: expect.any(Number),
    });
  });

  test("should insert many entities", async () => {
    const e1 = repository.create({
      id: randomUUID(),
      email: randomUUID(),
      name: randomUUID(),
    });

    const e2 = repository.create({
      id: randomUUID(),
      email: randomUUID(),
      name: randomUUID(),
    });

    await expect(repository.insertBulk([e1, e2])).resolves.toEqual([
      expect.any(TestEntity),
      expect.any(TestEntity),
    ]);
    await expect(repository.findOne({ id: e1.id })).resolves.toEqual(
      expect.objectContaining({ id: e1.id }),
    );
    await expect(repository.findOne({ id: e2.id })).resolves.toEqual(
      expect.objectContaining({ id: e2.id }),
    );
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
      deletedAt: null,
      email: "test@lindorm.io",
      expiresAt: null,
      name: "Test User",
      sequence: expect.any(Number),
      updatedAt: MockedDate,
      version: expect.any(Number),
    });
  });

  test("should validate an entity when it exists", async () => {
    const repo = new MnemosRepository({
      Entity: TestEntityOne,
      logger: createMockLogger(),
      cache: cache,
    });

    await expect(repo.save(repo.create({}))).rejects.toThrow();
  });

  test("should save many entities", async () => {
    const e1 = repository.create({
      email: randomUUID(),
      name: randomUUID(),
    });

    const e2 = repository.create({
      email: randomUUID(),
      name: randomUUID(),
    });

    await expect(repository.saveBulk([e1, e2])).resolves.toEqual([
      expect.any(TestEntity),
      expect.any(TestEntity),
    ]);
    await expect(repository.findOne({ id: e1.id })).resolves.toEqual(
      expect.objectContaining({ id: e1.id }),
    );
    await expect(repository.findOne({ id: e2.id })).resolves.toEqual(
      expect.objectContaining({ id: e2.id }),
    );
  });

  test("should update an entity", async () => {
    const name1 = randomUUID();
    const name2 = randomUUID();

    const entity = repository.create({
      email: randomUUID(),
      name: name1,
    });

    const inserted = await repository.insert(entity);
    expect(inserted.name).toEqual(name1);

    inserted.name = name2;

    const updated = await repository.update(inserted);
    expect(updated.name).toEqual(name2);

    await expect(repository.findOne({ id: inserted.id })).resolves.toEqual(updated);
  });

  test("should update many entities", async () => {
    const name1 = randomUUID();
    const name2 = randomUUID();

    const e1 = repository.create({
      email: randomUUID(),
      name: name1,
    });

    const e2 = repository.create({
      email: randomUUID(),
      name: name1,
    });

    const [i1, i2] = await repository.insertBulk([e1, e2]);

    i1.name = name2;
    i2.name = name2;

    const [u1, u2] = await repository.updateBulk([i1, i2]);

    await expect(repository.findOne({ id: i1.id })).resolves.toEqual(u1);
    await expect(repository.findOne({ id: i2.id })).resolves.toEqual(u2);
  });

  test("should get the time to live for an entity", async () => {
    const entity = await repository.save(
      repository.create({
        expiresAt: new Date("2024-01-01T10:00:00.000Z"),
      }),
    );

    await expect(repository.ttl({ id: entity.id })).resolves.toEqual(7200);
  });
});
