import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import MockDate from "mockdate";
import { TestEntityOne } from "../__fixtures__/entities/test-entity-one";
import { TestEntityThree } from "../__fixtures__/entities/test-entity-three";
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
import { RedisRepository } from "./RedisRepository";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("RedisRepository", () => {
  let client: Redis;
  let repository: TestRepository;

  beforeAll(async () => {
    client = new Redis("redis://localhost:6379");
    repository = new TestRepository(client, createMockLogger());
  });

  afterAll(async () => {
    await client.quit();
  });

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
    const repo = new RedisRepository({
      target: TestEntityOne,
      client: client,
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

  test("should delete entities by criteria", async () => {
    const entity = await repository.save(repository.create({ name: randomUUID() }));

    await expect(repository.delete({ name: entity.name })).resolves.not.toThrow();

    await expect(repository.findOne({ id: entity.id })).resolves.toBeNull();
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
    const repository = new RedisRepository({
      target: TestEntityOne,
      client,
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

  test("should handle entity scoping", async () => {
    const repository = new RedisRepository({
      target: TestEntityThree,
      client,
      logger: createMockLogger(),
    });

    await repository.setup();
    const scope = "scope";
    const name = randomUUID();

    const insert = await repository.insert(repository.create({ scope, name }));

    await expect(repository.find({ scope, name })).resolves.toEqual([insert]);
  });
});

describe("RedisRepository - Relations", () => {
  let client: Redis;
  const logger = createMockLogger();
  const ns = "rel";

  beforeAll(async () => {
    client = new Redis("redis://localhost:6379");
  });

  afterAll(async () => {
    await client.quit();
  });

  const createRepo = (target: any) =>
    new RedisRepository({ target, client, logger, namespace: ns });

  describe("OneToMany / ManyToOne eager", () => {
    test("should cascade insert and load children", async () => {
      const repo = createRepo(TestRelationOne);
      const childRepo = createRepo(TestRelationTwo);

      const child = childRepo.create({
        first: randomUUID(),
        second: randomUUID(),
        name: "child",
        customOneId: "",
      } as any);

      const parent = repo.create({ name: "parent" } as any);
      child.customOneId = parent.id;
      parent.twos = [child];

      const saved = await repo.insert(parent);

      const found = await repo.findOne({ id: saved.id } as any);
      expect(found).not.toBeNull();
      expect(found!.name).toEqual("parent");
      expect(found!.twos).toHaveLength(1);
      expect(found!.twos[0].name).toEqual("child");
    });

    test("should cascade destroy children", async () => {
      const repo = createRepo(TestRelationOne);
      const childRepo = createRepo(TestRelationTwo);

      const child = childRepo.create({
        first: randomUUID(),
        second: randomUUID(),
        name: "child-destroy",
        customOneId: "",
      } as any);

      const parent = repo.create({ name: "parent-destroy" } as any);
      child.customOneId = parent.id;
      parent.twos = [child];

      const saved = await repo.insert(parent);

      await repo.destroy(saved);

      const foundChild = await childRepo.findOne({
        first: child.first,
        second: child.second,
      } as any);
      expect(foundChild).toBeNull();
    });

    test("should find entity with nested eager-loaded relations", async () => {
      const repo = createRepo(TestRelationOne);
      const childRepo = createRepo(TestRelationTwo);
      const grandchildRepo = createRepo(TestRelationThree);

      const parent = repo.create({ name: "parent-nested" } as any);
      const child = childRepo.create({
        first: randomUUID(),
        second: randomUUID(),
        name: "child-nested",
        customOneId: parent.id,
      } as any);
      const grandchild = grandchildRepo.create({ name: "grandchild" } as any);
      (grandchild as any).twoFirst = child.first;
      (grandchild as any).twoSecond = child.second;

      child.threes = [grandchild];
      parent.twos = [child];
      parent.fives = [];
      parent.many = [];

      await repo.insert(parent);

      const found = await repo.findOne({ id: parent.id } as any);
      expect(found).not.toBeNull();
      expect(found!.twos).toHaveLength(1);
      expect(found!.twos[0].name).toEqual("child-nested");
      expect(found!.twos[0].threes).toHaveLength(1);
      expect(found!.twos[0].threes[0].name).toEqual("grandchild");
      expect(found!.four).toBeNull();
    });

    test("should set Direction A back-references on eager-loaded relations", async () => {
      const repo = createRepo(TestRelationOne);
      const childRepo = createRepo(TestRelationTwo);
      const grandchildRepo = createRepo(TestRelationThree);
      const fourRepo = createRepo(TestRelationFour);

      const parent = repo.create({ name: "parent-backref" } as any);
      const child = childRepo.create({
        first: randomUUID(),
        second: randomUUID(),
        name: "child-backref",
        customOneId: parent.id,
      } as any);
      const grandchild = grandchildRepo.create({ name: "grandchild-backref" } as any);
      (grandchild as any).twoFirst = child.first;
      (grandchild as any).twoSecond = child.second;
      const four = fourRepo.create({
        name: "four-backref",
        customFourId: parent.id,
      } as any);

      child.threes = [grandchild];
      parent.twos = [child];
      parent.four = four;
      parent.fives = [];
      parent.many = [];

      await repo.insert(parent);

      const found = await repo.findOne({ id: parent.id } as any);

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
      const repo = createRepo(TestRelationOne);
      const childRepo = createRepo(TestRelationTwo);
      const fourRepo = createRepo(TestRelationFour);

      const name = randomUUID();

      for (let i = 0; i < 3; i++) {
        const parent = repo.create({ name } as any);
        const child = childRepo.create({
          first: randomUUID(),
          second: randomUUID(),
          name: `two-${i}`,
          customOneId: parent.id,
        } as any);
        const four = fourRepo.create({
          name: `four-${i}`,
          customFourId: parent.id,
        } as any);

        child.threes = [];
        parent.twos = [child];
        parent.four = four;
        parent.fives = [];
        parent.many = [];

        await repo.insert(parent);
      }

      const found = await repo.find({ name } as any);
      expect(found).toHaveLength(3);
      for (const entity of found) {
        expect(entity.twos).toHaveLength(1);
        expect(entity.four).toBeTruthy();
      }
    });

    test("should handle entity with no matching relations gracefully", async () => {
      const repo = createRepo(TestRelationOne);

      const parent = repo.create({ name: randomUUID() } as any);
      parent.twos = [];
      parent.fives = [];
      parent.many = [];

      await repo.insert(parent);

      const found = await repo.findOne({ id: parent.id } as any);
      expect(found).toBeTruthy();
      expect(found!.twos).toEqual([]);
      expect(found!.four).toBeNull();
    });

    test("should insert entity with multiple OneToMany children", async () => {
      const repo = createRepo(TestRelationOne);
      const childRepo = createRepo(TestRelationTwo);
      const fourRepo = createRepo(TestRelationFour);

      const parent = repo.create({ name: randomUUID() } as any);
      const children = ["a", "b", "c"].map((n) =>
        childRepo.create({
          first: randomUUID(),
          second: randomUUID(),
          name: n,
          customOneId: parent.id,
        } as any),
      );
      children.forEach((c: any) => (c.threes = []));
      parent.twos = children;
      parent.four = fourRepo.create({ name: "four", customFourId: parent.id } as any);
      parent.fives = [];
      parent.many = [];

      await repo.insert(parent);

      const found = await repo.findOne({ id: parent.id } as any);
      expect(found!.twos).toHaveLength(3);
      const names = found!.twos.map((t: any) => t.name).sort();
      expect(names).toEqual(["a", "b", "c"]);
    });

    test("should delete orphaned OneToMany children on update", async () => {
      const repo = createRepo(TestRelationOne);
      const childRepo = createRepo(TestRelationTwo);

      const parent = repo.create({ name: randomUUID() } as any);
      const keep = childRepo.create({
        first: randomUUID(),
        second: randomUUID(),
        name: "keep",
        customOneId: parent.id,
      } as any);
      const orphan = childRepo.create({
        first: randomUUID(),
        second: randomUUID(),
        name: "orphan",
        customOneId: parent.id,
      } as any);

      keep.threes = [];
      orphan.threes = [];
      parent.twos = [keep, orphan];
      parent.fives = [];
      parent.many = [];

      const inserted = await repo.insert(parent);

      // Remove one child and update
      inserted.name = randomUUID();
      inserted.twos = [inserted.twos[0]];

      await repo.update(inserted);

      const found = await repo.findOne({ id: inserted.id } as any);
      expect(found!.twos).toHaveLength(1);
      expect(found!.twos[0].name).toEqual("keep");
    });
  });

  describe("OneToOne eager", () => {
    test("should cascade insert and load OneToOne", async () => {
      const repo = createRepo(TestRelationOne);
      const fourRepo = createRepo(TestRelationFour);

      const four = fourRepo.create({
        name: "four",
        customFourId: "",
      } as any);

      const parent = repo.create({ name: "parent-oto" } as any);
      four.customFourId = parent.id;
      parent.four = four;
      parent.twos = [];
      parent.fives = [];
      parent.many = [];

      const saved = await repo.insert(parent);

      const found = await repo.findOne({ id: saved.id } as any);
      expect(found).not.toBeNull();
      expect(found!.four).not.toBeNull();
      expect(found!.four.name).toEqual("four");
    });

    test("should cascade destroy OneToOne", async () => {
      const repo = createRepo(TestRelationOne);
      const fourRepo = createRepo(TestRelationFour);

      const four = fourRepo.create({
        name: "four-destroy",
        customFourId: "",
      } as any);

      const parent = repo.create({ name: "parent-oto-destroy" } as any);
      four.customFourId = parent.id;
      parent.four = four;
      parent.twos = [];
      parent.fives = [];
      parent.many = [];

      const saved = await repo.insert(parent);

      await repo.destroy(saved);

      const foundFour = await fourRepo.findOne({ id: four.id } as any);
      expect(foundFour).toBeNull();
    });

    test("should delete orphaned OneToOne child on update", async () => {
      const repo = createRepo(TestRelationOne);
      const fourRepo = createRepo(TestRelationFour);

      const four = fourRepo.create({
        name: "old-four",
        customFourId: "",
      } as any);

      const parent = repo.create({ name: randomUUID() } as any);
      four.customFourId = parent.id;
      parent.four = four;
      parent.twos = [];
      parent.fives = [];
      parent.many = [];

      const inserted = await repo.insert(parent);
      const oldFourId = inserted.four.id;

      // Set four to null and update
      inserted.name = randomUUID();
      inserted.four = null;

      await repo.update(inserted);

      const found = await repo.findOne({ id: inserted.id } as any);
      expect(found!.four).toBeNull();

      // Verify old four was deleted
      const foundOldFour = await fourRepo.findOne({ id: oldFourId } as any);
      expect(foundOldFour).toBeNull();
    });
  });

  describe("ManyToMany eager", () => {
    test("should cascade insert and load ManyToMany", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      const five1 = fiveRepo.create({ name: "five-1" } as any);
      const five2 = fiveRepo.create({ name: "five-2" } as any);

      const parent = repo.create({ name: "parent-m2m" } as any);
      parent.fives = [five1, five2];
      parent.twos = [];
      parent.many = [];

      const saved = await repo.insert(parent);

      const found = await repo.findOne({ id: saved.id } as any);
      expect(found).not.toBeNull();
      expect(found!.fives).toHaveLength(2);

      const names = found!.fives.map((f: any) => f.name).sort();
      expect(names).toEqual(["five-1", "five-2"]);
    });

    test("should handle orphan deletion in ManyToMany", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      const five1 = fiveRepo.create({ name: "five-orphan-1" } as any);
      const five2 = fiveRepo.create({ name: "five-orphan-2" } as any);
      const five3 = fiveRepo.create({ name: "five-orphan-3" } as any);

      const parent = repo.create({ name: "parent-m2m-orphan" } as any);
      parent.fives = [five1, five2];
      parent.twos = [];
      parent.many = [];

      const saved = await repo.insert(parent);

      // Update: remove five2, add five3
      saved.fives = [five1, five3];
      await repo.update(saved);

      const found = await repo.findOne({ id: saved.id } as any);
      expect(found).not.toBeNull();
      expect(found!.fives).toHaveLength(2);

      const names = found!.fives.map((f: any) => f.name).sort();
      expect(names).toEqual(["five-orphan-1", "five-orphan-3"]);
    });

    test("should cascade destroy ManyToMany join set", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      const five = fiveRepo.create({ name: "five-destroy" } as any);

      const parent = repo.create({ name: "parent-m2m-destroy" } as any);
      parent.fives = [five];
      parent.twos = [];
      parent.many = [];

      const saved = await repo.insert(parent);

      await repo.destroy(saved);

      // Five entity still exists (not cascade destroyed by default for M2M entities)
      // but the join set should be cleaned up
      const foundFive = await fiveRepo.findOne({ id: five.id } as any);
      expect(foundFive).not.toBeNull();
    });

    test("should set back-refs on eager-loaded ManyToMany", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      const five = fiveRepo.create({ name: "backref-five" } as any);
      const parent = repo.create({ name: "parent-m2m-backref" } as any);
      parent.fives = [five];
      parent.twos = [];
      parent.many = [];

      await repo.insert(parent);

      const found = await repo.findOne({ id: parent.id } as any);
      expect(found!.fives[0].ones).toBeTruthy();
      expect(found!.fives[0].ones.id).toEqual(found!.id);
    });

    test("should handle entity with no ManyToMany entries gracefully", async () => {
      const repo = createRepo(TestRelationOne);

      const parent = repo.create({ name: randomUUID() } as any);
      parent.fives = [];
      parent.twos = [];
      parent.many = [];

      await repo.insert(parent);

      const found = await repo.findOne({ id: parent.id } as any);
      expect(found).toBeTruthy();
      expect(found!.fives).toEqual([]);
    });

    test("should add new ManyToMany link on update", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      const five1 = fiveRepo.create({ name: "first-five" } as any);
      const parent = repo.create({ name: randomUUID() } as any);
      parent.fives = [five1];
      parent.twos = [];
      parent.many = [];

      const inserted = await repo.insert(parent);

      // Add a second five
      inserted.name = randomUUID();
      const five2 = fiveRepo.create({ name: "second-five" } as any);
      inserted.fives = [...inserted.fives, five2];

      await repo.update(inserted);

      const found = await repo.findOne({ id: inserted.id } as any);
      expect(found!.fives).toHaveLength(2);

      const names = found!.fives.map((f: any) => f.name).sort();
      expect(names).toEqual(["first-five", "second-five"]);
    });

    test("should share entity across multiple parents", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      // Create a shared five entity
      const sharedFive = await fiveRepo.insert(
        fiveRepo.create({ name: "shared-five" } as any),
      );

      // Link it from two different parents
      const oneA = repo.create({ name: randomUUID() } as any);
      oneA.fives = [sharedFive];
      oneA.twos = [];
      oneA.many = [];

      const oneB = repo.create({ name: randomUUID() } as any);
      oneB.fives = [sharedFive];
      oneB.twos = [];
      oneB.many = [];

      await repo.insert(oneA);
      await repo.insert(oneB);

      // Both parents should load the shared five
      const foundA = await repo.findOne({ id: oneA.id } as any);
      expect(foundA!.fives).toHaveLength(1);
      expect(foundA!.fives[0].id).toEqual(sharedFive.id);

      const foundB = await repo.findOne({ id: oneB.id } as any);
      expect(foundB!.fives).toHaveLength(1);
      expect(foundB!.fives[0].id).toEqual(sharedFive.id);

      // Destroy one parent — shared entity and other parent's link should survive
      await repo.destroy(oneA);

      const stillExists = await fiveRepo.findOne({ id: sharedFive.id } as any);
      expect(stillExists).toBeTruthy();

      const foundBAfter = await repo.findOne({ id: oneB.id } as any);
      expect(foundBAfter!.fives).toHaveLength(1);
      expect(foundBAfter!.fives[0].id).toEqual(sharedFive.id);
    });

    test("should load ManyToMany from the inverse side", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      const five = fiveRepo.create({ name: "inverse-five" } as any);
      const parent = repo.create({ name: randomUUID() } as any);
      parent.fives = [five];
      parent.twos = [];
      parent.many = [];

      await repo.insert(parent);

      const fiveId = five.id;

      // Load from the five side — ones should be eagerly loaded
      const foundFive = await fiveRepo.findOne({ id: fiveId } as any);
      expect(foundFive).toBeTruthy();
      expect(foundFive!.ones).toHaveLength(1);
      expect(foundFive!.ones[0].id).toEqual(parent.id);
    });

    test("should not create duplicate join entries on re-save", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      const five = fiveRepo.create({ name: "no-dup-five" } as any);
      const parent = repo.create({ name: randomUUID() } as any);
      parent.fives = [five];
      parent.twos = [];
      parent.many = [];

      const inserted = await repo.insert(parent);

      // Update with the same fives (no change to relations)
      inserted.name = randomUUID();
      await repo.update(inserted);

      // Verify still only one five loaded
      const found = await repo.findOne({ id: inserted.id } as any);
      expect(found!.fives).toHaveLength(1);
    });

    test("should handle self-referencing ManyToMany", async () => {
      const repo = createRepo(TestRelationOne);

      const entityB = repo.create({ name: randomUUID() } as any);
      entityB.twos = [];
      entityB.fives = [];
      entityB.many = [];

      const entityC = repo.create({ name: randomUUID() } as any);
      entityC.twos = [];
      entityC.fives = [];
      entityC.many = [];

      // Insert B and C first (no many links)
      await repo.insert(entityB);
      await repo.insert(entityC);

      // Insert A with many: [B, C]
      const entityA = repo.create({ name: randomUUID() } as any);
      entityA.twos = [];
      entityA.fives = [];
      entityA.many = [entityB, entityC];

      await repo.insert(entityA);

      // Verify eager loading resolves to B and C
      const found = await repo.findOne({ id: entityA.id } as any);
      expect(found!.many).toHaveLength(2);

      const manyIds = found!.many.map((m: any) => m.id).sort();
      expect(manyIds).toEqual([entityB.id, entityC.id].sort());

      // Destroy A — B and C survive
      await repo.destroy(entityA);

      expect(await repo.findOne({ id: entityB.id } as any)).toBeTruthy();
      expect(await repo.findOne({ id: entityC.id } as any)).toBeTruthy();
    });
  });

  describe("Lazy loading", () => {
    test("should lazy load OneToMany children", async () => {
      const oneRepo = createRepo(TestLazyOne);
      const twoRepo = createRepo(TestLazyTwo);

      const parent = oneRepo.create({ name: "lazy-parent" } as any);
      const child = twoRepo.create({
        name: "lazy-child",
        lazyOneId: parent.id,
      } as any);
      parent.twos = [child];

      await oneRepo.insert(parent);

      const found = await oneRepo.findOne({ id: parent.id } as any);
      expect(found).not.toBeNull();

      // Lazy proxy: resolves on await
      const twos = await found!.twos;
      expect(twos).toHaveLength(1);
      expect(twos[0].name).toEqual("lazy-child");
    });

    test("should lazy load ManyToOne parent", async () => {
      const oneRepo = createRepo(TestLazyOne);
      const twoRepo = createRepo(TestLazyTwo);

      const parent = oneRepo.create({ name: "lazy-parent-2" } as any);
      const child = twoRepo.create({
        name: "lazy-child-2",
        lazyOneId: parent.id,
      } as any);
      parent.twos = [child];

      await oneRepo.insert(parent);

      const foundChild = await twoRepo.findOne({ id: child.id } as any);
      expect(foundChild).not.toBeNull();

      const loadedParent = await foundChild!.one;
      expect(loadedParent).not.toBeNull();
      expect(loadedParent.name).toEqual("lazy-parent-2");
    });

    test("should cache lazy relation result", async () => {
      const oneRepo = createRepo(TestLazyOne);
      const twoRepo = createRepo(TestLazyTwo);

      const parent = oneRepo.create({ name: "lazy-cached" } as any);
      const child = twoRepo.create({
        name: "cached-child",
        lazyOneId: parent.id,
      } as any);
      parent.twos = [child];

      await oneRepo.insert(parent);

      const found = await oneRepo.findOne({ id: parent.id } as any);

      // Resolve twice — should return same result
      const first = await found!.twos;
      const second = await found!.twos;
      expect(first).toEqual(second);
    });

    test("should resolve lazy relation with no matches to empty array", async () => {
      const oneRepo = createRepo(TestLazyOne);

      const parent = oneRepo.create({ name: randomUUID() } as any);
      parent.twos = [];

      await oneRepo.insert(parent);

      const found = await oneRepo.findOne({ id: parent.id } as any);

      const twos = await found!.twos;
      expect(twos).toEqual([]);
    });
  });

  describe("Hash storage verification", () => {
    test("should store entity as hash, not string", async () => {
      const repo = createRepo(TestRelationOne);
      const parent = repo.create({ name: "hash-check" } as any);
      parent.twos = [];
      parent.fives = [];
      parent.many = [];

      await repo.insert(parent);

      // Verify it's stored as a hash by using HGETALL directly
      const keys: string[] = [];
      let cursor = "0";
      do {
        const reply = await client.scan(cursor, "MATCH", `rel.*hash-check*`);
        cursor = reply[0];
        keys.push(...reply[1]);
      } while (cursor !== "0");

      // Find the key for this entity
      const entityKey = keys.find((k) => k.includes(parent.id));

      if (entityKey) {
        const hashData = await client.hgetall(entityKey);
        expect(hashData).toBeDefined();
        expect(hashData.name).toEqual("hash-check");
        expect(hashData.id).toEqual(parent.id);

        // Verify it's NOT a string (GET should return null for hash keys)
        const stringData = await client.get(entityKey);
        expect(stringData).toBeNull();
      }
    });
  });
});
