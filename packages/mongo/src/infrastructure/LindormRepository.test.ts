import { Collection } from "mongodb";
import { MongoConnection } from "../connection";
import { TestEntity } from "@lindorm-io/entity";
import { TestRepository } from "../mocks";
import { createMockLogger } from "@lindorm-io/core-logger";
import { filter } from "lodash";
import { randomUUID } from "crypto";

const mock = require("mongo-mock");

describe("LindormRepository.ts", () => {
  let connection: MongoConnection;
  let entity: TestEntity;
  let collection: Collection;
  let repository: TestRepository;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 5008,
        auth: { username: "root", password: "example" },
        database: "default",
        custom: mock.MongoClient,
      },
      logger,
    );

    await connection.connect();

    collection = await connection.collection("TestRepository");
    repository = new TestRepository({ connection, logger });
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  beforeEach(async () => {
    entity = await repository.create(
      new TestEntity({
        name: randomUUID(),
      }),
    );
  });

  test("should count entities", async () => {
    await repository.create(
      new TestEntity({
        name: "count-entity-name",
      }),
    );
    await repository.create(
      new TestEntity({
        name: "count-entity-name",
      }),
    );
    await repository.create(
      new TestEntity({
        name: "count-entity-name",
      }),
    );

    await expect(repository.count({ name: "count-entity-name" })).resolves.toBe(3);
  });

  test("should create entity", async () => {
    await expect(collection.findOne({ id: entity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        name: entity.name,
        version: 0,
      }),
    );
  });

  test("should delete many entities", async () => {
    await repository.create(new TestEntity({ name: "destroy-many" }));
    await repository.create(new TestEntity({ name: "destroy-many" }));

    await repository.deleteMany({ name: "destroy-many" });
    const result = await repository.findMany({});

    expect(filter(result, { name: "destroy-many" })).toStrictEqual([]);
  });

  test("should destroy one entity", async () => {
    const destroy = await repository.create(new TestEntity({ name: "destroy" }));

    await repository.destroy(destroy);
    const result = await repository.findMany({});

    expect(filter(result, { id: destroy.id })).toStrictEqual([]);
  });

  test("should destroy many entities", async () => {
    const destroy1 = await repository.create(new TestEntity({ name: "destroy" }));
    const destroy2 = await repository.create(new TestEntity({ name: "destroy" }));

    await repository.destroyMany([destroy1, destroy2]);
    const result = await repository.findMany({});

    expect(filter(result, { id: destroy1.id })).toStrictEqual([]);
    expect(filter(result, { id: destroy2.id })).toStrictEqual([]);
  });

  test("should find entity", async () => {
    await expect(repository.find({ name: entity.name })).resolves.toStrictEqual(
      expect.objectContaining({
        name: entity.name,
        version: 0,
      }),
    );
  });

  test("should find many entities", async () => {
    await repository.create(
      new TestEntity({
        name: "find-many-name",
      }),
    );
    await repository.create(
      new TestEntity({
        name: "find-many-name",
      }),
    );

    await expect(repository.findMany({ name: "find-many-name" })).resolves.toStrictEqual([
      expect.objectContaining({
        name: "find-many-name",
      }),
      expect.objectContaining({
        name: "find-many-name",
      }),
    ]);
  });

  test("should find an entity and not create", async () => {
    await expect(repository.findOrCreate({ id: entity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        id: entity.id,
      }),
    );
  });

  test("should create entity when not found", async () => {
    await expect(
      repository.findOrCreate({
        id: "fb71c813-fab8-4e03-b958-1afbfd990bdf",
        name: "new-entity",
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "fb71c813-fab8-4e03-b958-1afbfd990bdf",
      }),
    );
  });

  test("should resolve undefined when entity cannot be found", async () => {
    await expect(repository.tryFind({ id: "wrong" })).resolves.toBeUndefined();
  });

  test("should update entity", async () => {
    entity.name = "new-entity-name";

    await repository.update(entity);

    await expect(collection.findOne({ id: entity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        name: "new-entity-name",
        revision: 1,
      }),
    );
  });
});
