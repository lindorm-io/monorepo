import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { TestEntityOne, validate } from "../__fixtures__/entities/test-entity-one";
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

  test("should count entities by criteria", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(repository.count({ name: entity.name })).toEqual(1);
  });

  test("should create a new entity with default values", () => {
    const entity = repository.create({});

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: expect.any(String),
      rev: 0,
      seq: 0,
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: null,
      name: undefined,
    });
  });

  test("should create a new entity with custom values", () => {
    const entity = repository.create({
      id: "0bc6f18f-48a7-52d4-a191-e15ed14eb087",
      rev: 9,
      seq: 8,
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      expiresAt: new Date("2021-01-01T00:00:00.000Z"),
      email: "test@lindorm.io",
      name: "Test User",
    });

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: "0bc6f18f-48a7-52d4-a191-e15ed14eb087",
      rev: 9,
      seq: 8,
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      deletedAt: null,
      expiresAt: new Date("2021-01-01T00:00:00.000Z"),
      email: "test@lindorm.io",
      name: "Test User",
    });
  });

  test("should delete entities by criteria", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(() => repository.delete({ name: entity.name })).not.toThrow();

    expect(repository.findOneById(entity.id)).toBeNull();
  });

  test("should delete entities by id", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(() => repository.deleteById(entity.id)).not.toThrow();

    expect(repository.findOneById(entity.id)).toBeNull();
  });

  test("should destroy an entity", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(() => repository.destroy(entity)).not.toThrow();

    expect(repository.findOneById(entity.id)).toBeNull();
  });

  test("should destroy many entities", () => {
    const e1 = repository.save(repository.create({ name: randomUUID() }));
    const e2 = repository.save(repository.create({ name: randomUUID() }));

    expect(() => repository.destroyBulk([e1, e2])).not.toThrow();

    expect(repository.findOneById(e1.id)).toBeNull();
    expect(repository.findOneById(e2.id)).toBeNull();
  });

  test("should check if entity exists", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(repository.exists({ name: entity.name })).toEqual(true);
  });

  test("should find entities by criteria", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(repository.find({ name: entity.name })).toEqual([entity]);
  });

  test("should find one entity by criteria", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(repository.findOne({ name: entity.name })).toEqual(entity);
  });

  test("should find one entity by criteria or throw", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(repository.findOneOrFail({ name: entity.name })).toEqual(entity);
    expect(() => repository.findOneOrFail({ name: randomUUID() })).toThrow();
  });

  test("should find one entity by criteria or save", () => {
    const name = randomUUID();
    expect(repository.findOneOrSave({ name })).toEqual(expect.any(TestEntity));

    expect(() => repository.findOneOrFail({ name })).not.toThrow();
  });

  test("should find one entity by id", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(repository.findOneById(entity.id)).toEqual(entity);
  });

  test("should find one entity by id or throw", () => {
    const entity = repository.save(repository.create({ name: randomUUID() }));

    expect(repository.findOneByIdOrFail(entity.id)).toEqual(entity);
    expect(() => repository.findOneByIdOrFail(randomUUID())).toThrow();
  });

  test("should insert an entity", () => {
    const entity = repository.create({
      id: randomUUID(),
      email: randomUUID(),
      name: randomUUID(),
    });

    expect(repository.insert(entity)).toEqual(expect.any(TestEntity));
    expect(repository.findOneById(entity.id)).toEqual({
      id: expect.any(String),
      rev: 0,
      seq: expect.any(Number),
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: entity.email,
      name: entity.name,
    });
  });

  test("should insert many entities", () => {
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

    expect(repository.insertBulk([e1, e2])).toEqual([
      expect.any(TestEntity),
      expect.any(TestEntity),
    ]);
    expect(repository.findOneById(e1.id)).toEqual(expect.objectContaining({ id: e1.id }));
    expect(repository.findOneById(e2.id)).toEqual(expect.objectContaining({ id: e2.id }));
  });

  test("should save an entity", () => {
    expect(
      repository.save(
        repository.create({
          email: "test@lindorm.io",
          name: "Test User",
        }),
      ),
    ).toEqual({
      id: expect.any(String),
      rev: 0,
      seq: 0,
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: "test@lindorm.io",
      name: "Test User",
    });
  });

  test("should validate an entity when it exists", () => {
    const repo = new MnemosRepository({
      Entity: TestEntityOne,
      logger: createMockLogger(),
      cache: cache,
      validate: validate,
    });

    expect(() => repo.save(repo.create({}))).toThrow();
  });

  test("should save many entities", () => {
    const e1 = repository.create({
      email: randomUUID(),
      name: randomUUID(),
    });

    const e2 = repository.create({
      email: randomUUID(),
      name: randomUUID(),
    });

    expect(repository.saveBulk([e1, e2])).toEqual([
      expect.any(TestEntity),
      expect.any(TestEntity),
    ]);
    expect(repository.findOneById(e1.id)).toEqual(expect.objectContaining({ id: e1.id }));
    expect(repository.findOneById(e2.id)).toEqual(expect.objectContaining({ id: e2.id }));
  });

  test("should update an entity", () => {
    const name1 = randomUUID();
    const name2 = randomUUID();

    const entity = repository.create({
      email: randomUUID(),
      name: name1,
    });

    const inserted = repository.insert(entity);
    expect(inserted.name).toEqual(name1);

    inserted.name = name2;

    const updated = repository.update(inserted);
    expect(updated.name).toEqual(name2);

    expect(repository.findOneById(inserted.id)).toEqual(updated);
  });

  test("should update many entities", () => {
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

    const [i1, i2] = repository.insertBulk([e1, e2]);

    i1.name = name2;
    i2.name = name2;

    const [u1, u2] = repository.updateBulk([i1, i2]);

    expect(repository.findOneById(i1.id)).toEqual(u1);
    expect(repository.findOneById(i2.id)).toEqual(u2);
  });

  test("should get the time to live for an entity", () => {
    const entity = repository.save(
      repository.create({
        expiresAt: new Date("2024-01-01T10:00:00.000Z"),
      }),
    );

    expect(repository.ttl({ id: entity.id })).toEqual(7200);
  });

  test("should get the time to live for an entity by id", () => {
    const entity = repository.save(
      repository.create({
        expiresAt: new Date("2024-01-01T10:00:00.000Z"),
      }),
    );

    expect(repository.ttlById(entity.id)).toEqual(7200);
  });
});
