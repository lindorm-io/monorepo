import { Client } from "@elastic/elasticsearch";
import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { TestEntityOne, validate } from "../__fixtures__/entities/test-entity-one";
import { TestEntity } from "../__fixtures__/test-entity";
import { TestRepository } from "../__fixtures__/test-repository";
import { ElasticRepository } from "./ElasticRepository";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("ElasticRepository", () => {
  let client: Client;
  let repository: TestRepository;

  beforeAll(async () => {
    client = new Client({
      node: "http://elastic:changeme@localhost:9200",
    });

    repository = new TestRepository(client, createMockLogger());
  });

  afterAll(async () => {
    await client.close();
  });

  test("should setup", async () => {
    await expect(repository.setup()).resolves.not.toThrow();
  }, 30000);

  test("should count entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(
      repository.count({ must: [{ match: { name: entity.name } }] }),
    ).resolves.toEqual(1);
  });

  test("should create a new entity with default values", async () => {
    const entity = repository.create();

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: expect.any(String),
      primaryTerm: 0,
      rev: 0,
      seq: 0,
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: null,
      name: null,
    });
  });

  test("should create a new entity with custom values", async () => {
    const entity = repository.create({
      id: "0bc6f18f-48a7-52d4-a191-e15ed14eb087",
      primaryTerm: 3,
      rev: 9,
      seq: 8,
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      deletedAt: new Date("2021-01-01T00:00:00.000Z"),
      email: "test@lindorm.io",
      name: "Test User",
    });

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: "0bc6f18f-48a7-52d4-a191-e15ed14eb087",
      primaryTerm: 3,
      rev: 9,
      seq: 8,
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      deletedAt: new Date("2021-01-01T00:00:00.000Z"),
      expiresAt: null,
      email: "test@lindorm.io",
      name: "Test User",
    });
  });

  test("should delete entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(
      repository.delete({ must: [{ match: { name: entity.name } }] }),
    ).resolves.not.toThrow();

    await expect(repository.findOneById(entity.id)).resolves.toBeNull();
  });

  test("should delete entities by id", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.deleteById(entity.id)).resolves.not.toThrow();

    await expect(repository.findOneById(entity.id)).resolves.toBeNull();
  });

  test("should delete all expired entities", async () => {
    const entity = await repository.save(
      repository.create({
        name: randomUUID(),
        expiresAt: new Date("2024-01-01T07:00:00.000Z"),
      }),
    );

    await expect(repository.deleteExpired()).resolves.not.toThrow();

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

    await expect(
      repository.exists({ must: [{ match: { name: entity.name } }] }),
    ).resolves.toEqual(true);
  });

  test("should find entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(
      repository.find({ must: [{ match: { name: entity.name } }] }),
    ).resolves.toEqual([entity]);
  });

  test("should find one entity by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(
      repository.findOne({ must: [{ match: { name: entity.name } }] }),
    ).resolves.toEqual(entity);
  });

  test("should find one entity by criteria or throw", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(
      repository.findOneOrFail({ must: [{ match: { name: entity.name } }] }),
    ).resolves.toEqual(entity);
    await expect(
      repository.findOneOrFail({ must: [{ match: { name: randomUUID() } }] }),
    ).rejects.toThrow();
  });

  test("should find one entity by criteria or save", async () => {
    const name = randomUUID();
    await expect(
      repository.findOneOrSave({ must: [{ match: { name } }] }, { name }),
    ).resolves.toEqual(expect.any(TestEntity));

    await expect(
      repository.findOneOrFail({ must: [{ match: { name } }] }),
    ).resolves.toEqual({
      id: expect.any(String),
      primaryTerm: 1,
      rev: 1,
      seq: expect.any(Number),
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: null,
      name: name,
    });
  });

  test("should find one entity by id", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.findOneById(entity.id)).resolves.toEqual(entity);
  });

  test("should find one entity by id or throw", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.findOneByIdOrFail(entity.id)).resolves.toEqual(entity);
    await expect(repository.findOneByIdOrFail(randomUUID())).rejects.toThrow();
  });

  test("should insert an entity", async () => {
    const entity = repository.create({
      id: randomUUID(),
      email: randomUUID(),
      name: randomUUID(),
    });

    await expect(repository.insert(entity)).resolves.toEqual(expect.any(TestEntity));
    await expect(repository.findOneById(entity.id)).resolves.toEqual({
      id: expect.any(String),
      primaryTerm: 1,
      rev: 1,
      seq: expect.any(Number),
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: entity.email,
      name: entity.name,
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
    await expect(repository.findOneById(e1.id)).resolves.toEqual(
      expect.objectContaining({ id: e1.id }),
    );
    await expect(repository.findOneById(e2.id)).resolves.toEqual(
      expect.objectContaining({ id: e2.id }),
    );
  });

  test("should save an entity", async () => {
    const entity = repository.create({
      id: randomUUID(),
      email: randomUUID(),
      name: randomUUID(),
    });

    await expect(repository.save(entity)).resolves.toEqual(expect.any(TestEntity));
    await expect(repository.findOneById(entity.id)).resolves.toEqual({
      id: expect.any(String),
      primaryTerm: 1,
      rev: 1,
      seq: expect.any(Number),
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: entity.email,
      name: entity.name,
    });
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
    await expect(repository.findOneById(e1.id)).resolves.toEqual(
      expect.objectContaining({ id: e1.id }),
    );
    await expect(repository.findOneById(e2.id)).resolves.toEqual(
      expect.objectContaining({ id: e2.id }),
    );
  });

  test("should soft destroy one entity", async () => {
    const entity = repository.create({
      email: randomUUID(),
      name: randomUUID(),
    });

    await expect(repository.save(entity)).resolves.toEqual(expect.any(TestEntity));
    await expect(repository.softDestroy(entity)).resolves.toBeUndefined();
    await expect(repository.findOneById(entity.id)).resolves.toEqual(null);
  });

  test("should soft destroy entities", async () => {
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
    await expect(repository.softDestroyBulk([e1, e2])).resolves.toBeUndefined();
    await expect(repository.findOneById(e1.id)).resolves.toEqual(null);
    await expect(repository.findOneById(e2.id)).resolves.toEqual(null);
  });

  test("should soft delete entities by criteria", async () => {
    const name = randomUUID();

    const e1 = repository.create({
      id: randomUUID(),
      name,
    });

    const e2 = repository.create({
      id: randomUUID(),
      name,
    });

    await expect(repository.saveBulk([e1, e2])).resolves.toEqual([
      expect.any(TestEntity),
      expect.any(TestEntity),
    ]);

    await expect(
      repository.softDelete({ must: [{ match: { name } }] }),
    ).resolves.toBeUndefined();
    await expect(repository.findOneById(e1.id)).resolves.toEqual(null);
    await expect(repository.findOneById(e2.id)).resolves.toEqual(null);
  });

  test("should soft delete one entity by id", async () => {
    const entity = repository.create({
      email: randomUUID(),
      name: randomUUID(),
    });

    await expect(repository.save(entity)).resolves.toEqual(expect.any(TestEntity));
    await expect(repository.softDeleteById(entity.id)).resolves.toBeUndefined();
    await expect(repository.findOneById(entity.id)).resolves.toEqual(null);
  });

  test("should update an entity", async () => {
    const name1 = randomUUID();
    const name2 = randomUUID();

    const entity = repository.create({
      email: randomUUID(),
      name: name1,
    });

    const inserted = await repository.insert(entity);
    expect(inserted.rev).toEqual(1);
    expect(inserted.name).toEqual(name1);

    inserted.name = name2;

    const updated = await repository.update(inserted);
    expect(updated.rev).toEqual(2);
    expect(updated.name).toEqual(name2);

    await expect(repository.findOneById(inserted.id)).resolves.toEqual(updated);
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

    await expect(repository.findOneById(i1.id)).resolves.toEqual(u1);
    await expect(repository.findOneById(i2.id)).resolves.toEqual(u2);
  });

  test("should calculate entity ttl", async () => {
    const entity = await repository.save(
      repository.create({
        name: randomUUID(),
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      }),
    );

    await expect(
      repository.ttl({ must: [{ match: { name: entity.name } }] }),
    ).resolves.toEqual(3600);
  });

  test("should calculate entity ttl by id", async () => {
    const entity = await repository.save(
      repository.create({
        name: randomUUID(),
        expiresAt: new Date("2024-01-01T08:00:01.000Z"),
      }),
    );

    await expect(repository.ttlById(entity.id)).resolves.toEqual(1);
  });

  test("should validate an entity when it exists", async () => {
    const repo = new ElasticRepository({
      Entity: TestEntityOne,
      client: client,
      logger: createMockLogger(),
      namespace: "test",
      validate: validate,
    });

    expect(() => repo.create({})).toThrow();
  });
});
