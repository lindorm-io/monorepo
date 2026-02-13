import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { Collection, MongoClient } from "mongodb";
import { TestEntityOne } from "../__fixtures__/entities/test-entity-one";
import { TestEntityTwo } from "../__fixtures__/entities/test-entity-two";
import { TestEntity } from "../__fixtures__/test-entity";
import {
  TestLazyOne,
  TestLazyTwo,
  TestRelationFive,
  TestRelationFour,
  TestRelationOne,
  TestRelationThree,
  TestRelationTwo,
} from "../__fixtures__/test-relations";
import { TestRepository } from "../__fixtures__/test-repository";
import { MongoRepository } from "./MongoRepository";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("MongoRepository", () => {
  let client: MongoClient;
  let repository: TestRepository;
  let collection: Collection;

  beforeAll(async () => {
    client = new MongoClient("mongodb://root:example@localhost/admin?authSource=admin");
    await client.connect();
    repository = new TestRepository(client, createMockLogger());
    collection = client.db("test").collection("test_test_entity");
  });

  afterAll(async () => {
    await client.close();
  });

  test("should setup", async () => {
    await expect(repository.setup()).resolves.not.toThrow();
  }, 30000);

  test("should create a new entity with default values", async () => {
    const entity = repository.create();

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity).toEqual({
      id: expect.any(String),
      version: 0,
      seq: null,
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
      version: 9,
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
      version: 9,
      seq: 8,
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-01T00:00:00.000Z"),
      deletedAt: new Date("2021-01-01T00:00:00.000Z"),
      expiresAt: null,
      email: "test@lindorm.io",
      name: "Test User",
    });
  });

  test("should validate an entity", async () => {
    const repo = new MongoRepository({
      target: TestEntityOne,
      client: client,
      database: "test",
      logger: createMockLogger(),
      namespace: "ns",
    });

    expect(() => repo.validate(repo.create({ name: "aa" }))).toThrow();
  });

  test("should clone an entity", async () => {
    const entity = await repository.insert(repository.create({ name: randomUUID() }));
    entity.email = "cunije@gozevguk.io";

    const updated = await repository.update(entity);
    const clone = await repository.clone(updated);

    expect(clone.id).not.toEqual(entity.id);
    expect(clone.version).not.toEqual(updated.version);
    expect(clone.email).toEqual(updated.email);
    expect(clone.name).toEqual(updated.name);
  });

  test("should clone many entities", async () => {
    const e1 = await repository.insert(repository.create({ name: randomUUID() }));
    const e2 = await repository.insert(repository.create({ name: randomUUID() }));

    const cloned = await repository.cloneBulk([e1, e2]);

    expect(cloned[0].id).not.toEqual(e1.id);
    expect(cloned[0].name).toEqual(e1.name);

    expect(cloned[1].id).not.toEqual(e2.id);
    expect(cloned[1].name).toEqual(e2.name);
  });

  test("should count entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.count({ name: entity.name })).resolves.toEqual(1);
  });

  test("should return a cursor for entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    const c1 = repository.cursor({ name: entity.name });
    await expect(c1.hasNext()).resolves.toEqual(true);
    await expect(c1.next()).resolves.toEqual(entity);
    await expect(c1.close()).resolves.toBeUndefined();

    const c2 = repository.cursor({ name: entity.name });
    await expect(c2.toArray()).resolves.toEqual([entity]);
  });

  test("should delete entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.delete({ name: entity.name })).resolves.not.toThrow();

    await expect(repository.findOne({ id: entity.id })).resolves.toBeNull();
  });

  test("should delete all expired entities", async () => {
    const entity = await repository.save(
      repository.create({
        name: randomUUID(),
        expiresAt: new Date("2024-01-01T07:00:00.000Z"),
      }),
    );

    await expect(repository.deleteExpired()).resolves.not.toThrow();

    await expect(repository.findOne({ id: entity.id })).resolves.toBeNull();
    await expect(collection.findOne({ id: entity.id })).resolves.toEqual(null);
  });

  test("should destroy an entity", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.destroy(entity)).resolves.not.toThrow();

    await expect(repository.findOne({ id: entity.id })).resolves.toBeNull();
  });

  test("should destroy many entities", async () => {
    const e1 = await repository.save(repository.create({ name: randomUUID() }));
    const e2 = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.destroyBulk([e1, e2])).resolves.not.toThrow();

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

    await expect(repository.findOneOrFail({ name })).resolves.toEqual({
      id: expect.any(String),
      version: 1,
      seq: expect.any(Number),
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: null,
      name: name,
    });
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
      version: 1,
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
    await expect(repository.findOne({ id: e1.id })).resolves.toEqual(
      expect.objectContaining({ id: e1.id }),
    );
    await expect(repository.findOne({ id: e2.id })).resolves.toEqual(
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
    await expect(repository.findOne({ id: entity.id })).resolves.toEqual({
      id: expect.any(String),
      version: 1,
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
    await expect(repository.findOne({ id: e1.id })).resolves.toEqual(
      expect.objectContaining({ id: e1.id }),
    );
    await expect(repository.findOne({ id: e2.id })).resolves.toEqual(
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
    await expect(repository.findOne({ id: entity.id })).resolves.toEqual(null);
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
    await expect(repository.findOne({ id: e1.id })).resolves.toEqual(null);
    await expect(repository.findOne({ id: e2.id })).resolves.toEqual(null);
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

    await expect(repository.softDelete({ name })).resolves.toBeUndefined();
    await expect(repository.findOne({ id: e1.id })).resolves.toEqual(null);
    await expect(repository.findOne({ id: e2.id })).resolves.toEqual(null);
  });

  test("should update an entity", async () => {
    const name1 = randomUUID();
    const name2 = randomUUID();

    const entity = repository.create({
      email: randomUUID(),
      name: name1,
    });

    const inserted = await repository.insert(entity);
    expect(inserted.version).toEqual(1);
    expect(inserted.name).toEqual(name1);

    inserted.name = name2;

    const updated = await repository.update(inserted);
    expect(updated.version).toEqual(2);
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

  test("should calculate entity ttl", async () => {
    const entity = await repository.save(
      repository.create({
        name: randomUUID(),
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      }),
    );

    await expect(repository.ttl({ name: entity.name })).resolves.toEqual(3600);
  });

  test("should not automatically update entity from another source", async () => {
    const repository = new MongoRepository({
      target: TestEntityOne,
      client,
      database: "test",
      logger: createMockLogger(),
    });

    await repository.setup();

    const name = randomUUID();
    const nameAfter = randomUUID();

    const insert = await repository.insert(repository.create({ name }));

    MockDate.set(new Date("2024-01-02T08:00:00.000Z"));

    insert.name = nameAfter;

    const update = await repository.update(insert);

    expect(update).toEqual(
      expect.objectContaining({
        name: nameAfter,
        version: 0,
        updatedAt: new Date("2024-01-01T08:00:00.000Z"),
      }),
    );

    MockDate.set(MockedDate);
  });

  test("should update versioned entity", async () => {
    const repository = new MongoRepository({
      target: TestEntityTwo,
      client,
      database: "test",
      logger: createMockLogger(),
    });

    await repository.setup();

    const name1 = randomUUID();
    const name2 = randomUUID();

    const insert = await repository.insert(repository.create({ name: name1 }));

    MockDate.set(new Date("2024-01-02T08:00:00.000Z"));

    insert.name = name2;

    const update = await repository.update(insert);

    await expect(
      repository.findOne(
        { id: insert.id },
        { versionTimestamp: new Date("2024-01-01T10:00:00.000Z") },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: insert.id,
        name: name1,
        version: 1,
        versionId: insert.versionId,
        versionEndAt: new Date("2024-01-02T08:00:00.000Z"),
      }),
    );

    expect(update).toEqual(
      expect.objectContaining({
        id: insert.id,
        name: name2,
        version: 2,
        versionStartAt: new Date("2024-01-02T08:00:00.000Z"),
        versionEndAt: null,
      }),
    );

    expect(update.versionId).not.toEqual(insert.versionId);

    MockDate.set(MockedDate);
  });

  test("should get all versions of an entity", async () => {
    const repository = new MongoRepository({
      target: TestEntityTwo,
      client,
      database: "test",
      logger: createMockLogger(),
    });

    await repository.setup();

    const name1 = randomUUID();
    const name2 = randomUUID();

    const insert = await repository.insert(repository.create({ name: name1 }));

    insert.name = name2;
    insert.versionEndAt = new Date("2024-01-02T08:00:00.000Z");

    await repository.update(insert);

    await expect(repository.versions({ id: insert.id })).resolves.toEqual([
      expect.objectContaining({ id: insert.id, version: 1, name: name1 }),
      expect.objectContaining({ id: insert.id, version: 2, name: name2 }),
    ]);
  });

  describe("with relations", () => {
    let oneRepo: MongoRepository<TestRelationOne>;

    beforeAll(async () => {
      oneRepo = new MongoRepository({
        target: TestRelationOne,
        client,
        database: "test",
        logger: createMockLogger(),
      });

      await oneRepo.setup();

      for (const Target of [
        TestRelationTwo,
        TestRelationThree,
        TestRelationFour,
        TestRelationFive,
      ] as any[]) {
        await new MongoRepository({
          target: Target,
          client,
          database: "test",
          logger: createMockLogger(),
        }).setup();
      }
    });

    test("should insert entity with cascade relations", async () => {
      const first = randomUUID();
      const second = randomUUID();

      const entity = oneRepo.create({
        name: "one",
        twos: [{ first, second, name: "two", threes: [{ name: "three" }] }],
        four: { name: "four" },
      });

      const inserted = await oneRepo.insert(entity);

      expect(inserted.id).toEqual(entity.id);
      expect(inserted.name).toEqual("one");

      // Verify child was cascade-inserted
      const twoCollection = client.db("test").collection("entity.test_relation_two");
      const twoDoc = await twoCollection.findOne({ first, second });
      expect(twoDoc).toBeTruthy();
      expect(twoDoc!.name).toEqual("two");
      expect(twoDoc!.customOneId).toEqual(inserted.id);

      // Verify grandchild was cascade-inserted (auto-inferred FK columns)
      const threeCollection = client.db("test").collection("entity.test_relation_three");
      const threeDoc = await threeCollection.findOne({
        twoFirst: first,
        twoSecond: second,
      });
      expect(threeDoc).toBeTruthy();
      expect(threeDoc!.name).toEqual("three");

      // Verify OneToOne was cascade-inserted
      const fourCollection = client.db("test").collection("entity.test_relation_four");
      const fourDoc = await fourCollection.findOne({ customFourId: inserted.id });
      expect(fourDoc).toBeTruthy();
      expect(fourDoc!.name).toEqual("four");
    });

    test("should find entity with eager-loaded relations", async () => {
      const first = randomUUID();
      const second = randomUUID();

      const entity = oneRepo.create({
        name: randomUUID(),
        twos: [{ first, second, name: "two", threes: [{ name: "three" }] }],
        four: { name: "four" },
      });

      await oneRepo.insert(entity);

      const found = await oneRepo.findOne({ id: entity.id });

      expect(found).toBeTruthy();
      expect(found!.name).toEqual(entity.name);

      // OneToMany eager loaded
      expect(found!.twos).toHaveLength(1);
      expect(found!.twos[0].name).toEqual("two");
      expect(found!.twos[0].first).toEqual(first);
      expect(found!.twos[0].second).toEqual(second);

      // Nested OneToMany eager loaded
      expect(found!.twos[0].threes).toHaveLength(1);
      expect(found!.twos[0].threes[0].name).toEqual("three");

      // Inverse OneToOne eager loaded
      expect(found!.four).toBeTruthy();
      expect(found!.four.name).toEqual("four");
    });

    test("should set Direction A back-references on eager-loaded relations", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        twos: [
          {
            first: randomUUID(),
            second: randomUUID(),
            name: "two",
            threes: [{ name: "three" }],
          },
        ],
        four: { name: "four" },
      });

      await oneRepo.insert(entity);

      const found = await oneRepo.findOne({ id: entity.id });

      // OneToMany: child.one should reference parent
      expect(found!.twos[0].one).toBeTruthy();
      expect(found!.twos[0].one.id).toEqual(found!.id);

      // Nested: grandchild.two should reference child
      expect(found!.twos[0].threes[0].two).toBeTruthy();
      expect(found!.twos[0].threes[0].two.first).toEqual(found!.twos[0].first);
      expect(found!.twos[0].threes[0].two.second).toEqual(found!.twos[0].second);

      // Inverse OneToOne: four.one should reference parent
      expect(found!.four.one).toBeTruthy();
      expect(found!.four.one.id).toEqual(found!.id);
    });

    test("should find multiple entities with relations", async () => {
      const name = randomUUID();

      for (let i = 0; i < 3; i++) {
        const entity = oneRepo.create({
          name,
          twos: [
            {
              first: randomUUID(),
              second: randomUUID(),
              name: `two-${i}`,
              threes: [],
            },
          ],
          four: { name: `four-${i}` },
        });
        await oneRepo.insert(entity);
      }

      const found = await oneRepo.find({ name });

      expect(found).toHaveLength(3);
      for (const entity of found) {
        expect(entity.twos).toHaveLength(1);
        expect(entity.four).toBeTruthy();
      }
    });

    test("should handle entity with no matching relations gracefully", async () => {
      const entity = oneRepo.create({ name: randomUUID() });

      await oneRepo.insert(entity);

      const found = await oneRepo.findOne({ id: entity.id });

      expect(found).toBeTruthy();
      expect(found!.twos).toEqual([]);
      expect(found!.four).toBeNull();
    });

    test("should insert entity with multiple OneToMany children", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        twos: [
          { first: randomUUID(), second: randomUUID(), name: "a", threes: [] },
          { first: randomUUID(), second: randomUUID(), name: "b", threes: [] },
          { first: randomUUID(), second: randomUUID(), name: "c", threes: [] },
        ],
        four: { name: "four" },
      });

      await oneRepo.insert(entity);

      const found = await oneRepo.findOne({ id: entity.id });

      expect(found!.twos).toHaveLength(3);
      const names = found!.twos.map((t: any) => t.name).sort();
      expect(names).toEqual(["a", "b", "c"]);
    });

    test("should delete orphaned OneToMany children on update", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        twos: [
          { first: randomUUID(), second: randomUUID(), name: "keep", threes: [] },
          { first: randomUUID(), second: randomUUID(), name: "orphan", threes: [] },
        ],
        four: { name: "four" },
      });

      const inserted = await oneRepo.insert(entity);

      // Remove one child and update a field to trigger document change
      inserted.name = randomUUID();
      inserted.twos = [inserted.twos[0]];

      const updated = await oneRepo.update(inserted);

      const found = await oneRepo.findOne({ id: updated.id });
      expect(found!.twos).toHaveLength(1);
      expect(found!.twos[0].name).toEqual("keep");
    });

    test("should delete orphaned OneToOne child on update", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        twos: [],
        four: { name: "old-four" },
      });

      const inserted = await oneRepo.insert(entity);
      const oldFourId = inserted.four.id;

      // Set four to null and update a field to trigger document change
      inserted.name = randomUUID();
      inserted.four = null;

      await oneRepo.update(inserted);

      const found = await oneRepo.findOne({ id: inserted.id });
      expect(found!.four).toBeNull();

      // Verify old four was deleted from DB
      const fourCollection = client.db("test").collection("entity.test_relation_four");
      const oldFour = await fourCollection.findOne({ id: oldFourId });
      expect(oldFour).toBeNull();
    });

    test("should cascade destroy OneToMany children", async () => {
      const first = randomUUID();
      const second = randomUUID();

      const entity = oneRepo.create({
        name: randomUUID(),
        twos: [{ first, second, name: "child", threes: [] }],
        four: { name: "four" },
      });

      await oneRepo.insert(entity);

      await oneRepo.destroy(entity);

      // Parent gone
      await expect(oneRepo.findOne({ id: entity.id })).resolves.toBeNull();

      // Child cascade-destroyed
      const twoCollection = client.db("test").collection("entity.test_relation_two");
      const twoDoc = await twoCollection.findOne({ first, second });
      expect(twoDoc).toBeNull();
    });

    test("should cascade destroy OneToOne child", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        twos: [],
        four: { name: "four" },
      });

      await oneRepo.insert(entity);
      const fourId = entity.four.id;

      await oneRepo.destroy(entity);

      // Child cascade-destroyed
      const fourCollection = client.db("test").collection("entity.test_relation_four");
      const fourDoc = await fourCollection.findOne({ id: fourId });
      expect(fourDoc).toBeNull();
    });
  });

  describe("with many-to-many relations", () => {
    let oneRepo: MongoRepository<TestRelationOne>;
    let fiveRepo: MongoRepository<TestRelationFive>;

    beforeAll(async () => {
      oneRepo = new MongoRepository({
        target: TestRelationOne,
        client,
        database: "test",
        logger: createMockLogger(),
      });

      fiveRepo = new MongoRepository({
        target: TestRelationFive,
        client,
        database: "test",
        logger: createMockLogger(),
      });

      await oneRepo.setup();
      await fiveRepo.setup();

      for (const Target of [
        TestRelationTwo,
        TestRelationThree,
        TestRelationFour,
      ] as any[]) {
        await new MongoRepository({
          target: Target,
          client,
          database: "test",
          logger: createMockLogger(),
        }).setup();
      }
    });

    test("should cascade insert entity with ManyToMany relations", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        fives: [{ name: "five-a" }, { name: "five-b" }],
      });

      const inserted = await oneRepo.insert(entity);

      // Verify related entities were cascade-saved
      const fiveA = await fiveRepo.findOne({ name: "five-a" });
      expect(fiveA).toBeTruthy();

      const fiveB = await fiveRepo.findOne({ name: "five-b" });
      expect(fiveB).toBeTruthy();

      // Verify join collection entries were created
      const joinCollection = client
        .db("test")
        .collection("join.test_relation_one_x_test_relation_five");
      const joinDocs = await joinCollection
        .find({ testRelationOneId: inserted.id })
        .toArray();

      expect(joinDocs).toHaveLength(2);
    });

    test("should eager-load ManyToMany relations", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        fives: [{ name: "eager-five-a" }, { name: "eager-five-b" }],
      });

      await oneRepo.insert(entity);

      const found = await oneRepo.findOne({ id: entity.id });

      expect(found).toBeTruthy();
      expect(found!.fives).toHaveLength(2);

      const names = found!.fives.map((f: any) => f.name).sort();
      expect(names).toEqual(["eager-five-a", "eager-five-b"]);
    });

    test("should set back-refs on eager-loaded ManyToMany relations", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        fives: [{ name: "backref-five" }],
      });

      await oneRepo.insert(entity);

      const found = await oneRepo.findOne({ id: entity.id });

      expect(found!.fives[0].ones).toBeTruthy();
      expect(found!.fives[0].ones.id).toEqual(found!.id);
    });

    test("should remove orphaned join entries on update", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        fives: [{ name: "keep-five" }, { name: "orphan-five" }],
      });

      const inserted = await oneRepo.insert(entity);

      // Remove one five and update
      inserted.name = randomUUID();
      inserted.fives = [inserted.fives[0]];

      await oneRepo.update(inserted);

      const joinCollection = client
        .db("test")
        .collection("join.test_relation_one_x_test_relation_five");
      const joinDocs = await joinCollection
        .find({ testRelationOneId: inserted.id })
        .toArray();

      expect(joinDocs).toHaveLength(1);

      // The orphaned entity should still exist (not deleted, only link removed)
      const orphanedFive = await fiveRepo.findOne({ name: "orphan-five" });
      expect(orphanedFive).toBeTruthy();
    });

    test("should remove join entries on cascade destroy but keep related entities", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        fives: [{ name: "destroy-five" }],
      });

      await oneRepo.insert(entity);

      const fiveId = entity.fives[0].id;

      await oneRepo.destroy(entity);

      // Parent gone
      await expect(oneRepo.findOne({ id: entity.id })).resolves.toBeNull();

      // Join entries removed
      const joinCollection = client
        .db("test")
        .collection("join.test_relation_one_x_test_relation_five");
      const joinDocs = await joinCollection
        .find({ testRelationOneId: entity.id })
        .toArray();
      expect(joinDocs).toHaveLength(0);

      // Related entity still exists (shared, not cascade-deleted)
      const five = await fiveRepo.findOne({ id: fiveId });
      expect(five).toBeTruthy();
    });

    test("should handle entity with no ManyToMany entries gracefully", async () => {
      const entity = oneRepo.create({ name: randomUUID() });

      await oneRepo.insert(entity);

      const found = await oneRepo.findOne({ id: entity.id });

      expect(found).toBeTruthy();
      expect(found!.fives).toEqual([]);
    });

    test("should add new ManyToMany link on update", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        fives: [{ name: "first-five" }],
      });

      const inserted = await oneRepo.insert(entity);

      // Add a second five
      inserted.name = randomUUID();
      inserted.fives = [...inserted.fives, fiveRepo.create({ name: "second-five" })];

      await oneRepo.update(inserted);

      const joinCollection = client
        .db("test")
        .collection("join.test_relation_one_x_test_relation_five");
      const joinDocs = await joinCollection
        .find({ testRelationOneId: inserted.id })
        .toArray();

      expect(joinDocs).toHaveLength(2);

      // Verify both load correctly
      const found = await oneRepo.findOne({ id: inserted.id });
      expect(found!.fives).toHaveLength(2);

      const names = found!.fives.map((f: any) => f.name).sort();
      expect(names).toEqual(["first-five", "second-five"]);
    });

    test("should share entity across multiple parents", async () => {
      // Create a shared five entity
      const sharedFive = await fiveRepo.insert(fiveRepo.create({ name: "shared-five" }));

      // Link it from two different parents
      const oneA = oneRepo.create({
        name: randomUUID(),
        fives: [sharedFive],
      });
      const oneB = oneRepo.create({
        name: randomUUID(),
        fives: [sharedFive],
      });

      await oneRepo.insert(oneA);
      await oneRepo.insert(oneB);

      // Both parents should load the shared five
      const foundA = await oneRepo.findOne({ id: oneA.id });
      expect(foundA!.fives).toHaveLength(1);
      expect(foundA!.fives[0].id).toEqual(sharedFive.id);

      const foundB = await oneRepo.findOne({ id: oneB.id });
      expect(foundB!.fives).toHaveLength(1);
      expect(foundB!.fives[0].id).toEqual(sharedFive.id);

      // Destroy one parent — shared entity and other parent's link should survive
      await oneRepo.destroy(oneA);

      const stillExists = await fiveRepo.findOne({ id: sharedFive.id });
      expect(stillExists).toBeTruthy();

      const foundBAfter = await oneRepo.findOne({ id: oneB.id });
      expect(foundBAfter!.fives).toHaveLength(1);
      expect(foundBAfter!.fives[0].id).toEqual(sharedFive.id);
    });

    test("should load ManyToMany from the inverse side", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        fives: [{ name: "inverse-five" }],
      });

      await oneRepo.insert(entity);

      const fiveId = entity.fives[0].id;

      // Load from the five side — ones should be eagerly loaded
      const five = await fiveRepo.findOne({ id: fiveId });

      expect(five).toBeTruthy();
      expect(five!.ones).toHaveLength(1);
      expect(five!.ones[0].id).toEqual(entity.id);
    });

    test("should not create duplicate join entries on re-save", async () => {
      const entity = oneRepo.create({
        name: randomUUID(),
        fives: [{ name: "no-dup-five" }],
      });

      const inserted = await oneRepo.insert(entity);

      // Update with the same fives (no change)
      inserted.name = randomUUID();
      await oneRepo.update(inserted);

      const joinCollection = client
        .db("test")
        .collection("join.test_relation_one_x_test_relation_five");
      const joinDocs = await joinCollection
        .find({ testRelationOneId: inserted.id })
        .toArray();

      expect(joinDocs).toHaveLength(1);
    });

    test("should handle self-referencing ManyToMany", async () => {
      const entityB = oneRepo.create({ name: randomUUID() });
      const entityC = oneRepo.create({ name: randomUUID() });

      // Insert B and C first (no many links)
      await oneRepo.insert(entityB);
      await oneRepo.insert(entityC);

      // Insert A with many: [B, C]
      const entityA = oneRepo.create({
        name: randomUUID(),
        many: [entityB, entityC],
      });

      await oneRepo.insert(entityA);

      // Verify join entries
      const joinCollection = client
        .db("test")
        .collection("join.test_relation_one_x_test_relation_one");
      const joinDocs = await joinCollection
        .find({ sourceTestRelationOneId: entityA.id })
        .toArray();

      expect(joinDocs).toHaveLength(2);

      const targetIds = joinDocs.map((d: any) => d.targetTestRelationOneId).sort();
      expect(targetIds).toEqual([entityB.id, entityC.id].sort());

      // Verify eager loading resolves to B and C
      const found = await oneRepo.findOne({ id: entityA.id });
      expect(found!.many).toHaveLength(2);

      const manyIds = found!.many.map((m: any) => m.id).sort();
      expect(manyIds).toEqual([entityB.id, entityC.id].sort());

      // Destroy A — join entries removed, B and C survive
      await oneRepo.destroy(entityA);

      const selfJoinDocs = await joinCollection
        .find({ sourceTestRelationOneId: entityA.id })
        .toArray();
      expect(selfJoinDocs).toHaveLength(0);

      expect(await oneRepo.findOne({ id: entityB.id })).toBeTruthy();
      expect(await oneRepo.findOne({ id: entityC.id })).toBeTruthy();
    });
  });

  describe("with lazy relations", () => {
    let lazyRepo: MongoRepository<TestLazyOne>;

    beforeAll(async () => {
      lazyRepo = new MongoRepository({
        target: TestLazyOne,
        client,
        database: "test",
        logger: createMockLogger(),
      });

      await lazyRepo.setup();

      await new MongoRepository({
        target: TestLazyTwo,
        client,
        database: "test",
        logger: createMockLogger(),
      }).setup();
    });

    test("should resolve lazy OneToMany relation when awaited", async () => {
      const entity = lazyRepo.create({
        name: randomUUID(),
        twos: [{ name: "lazy-a" }, { name: "lazy-b" }],
      });

      await lazyRepo.insert(entity);

      const found = await lazyRepo.findOne({ id: entity.id });

      // twos is a lazy proxy — resolve it
      const twos = await found!.twos;
      expect(twos).toHaveLength(2);

      const names = twos.map((t: any) => t.name).sort();
      expect(names).toEqual(["lazy-a", "lazy-b"]);
    });

    test("should cache lazy relation result", async () => {
      const entity = lazyRepo.create({
        name: randomUUID(),
        twos: [{ name: "cached" }],
      });

      await lazyRepo.insert(entity);

      const found = await lazyRepo.findOne({ id: entity.id });

      // Resolve twice — should return same result
      const first = await found!.twos;
      const second = await found!.twos;
      expect(first).toEqual(second);
    });

    test("should resolve lazy relation with no matches to empty array", async () => {
      const entity = lazyRepo.create({ name: randomUUID() });

      await lazyRepo.insert(entity);

      const found = await lazyRepo.findOne({ id: entity.id });

      const twos = await found!.twos;
      expect(twos).toEqual([]);
    });
  });
});
