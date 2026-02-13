import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import {
  TestLazyOne,
  TestLazyTwo,
  TestRelationFive,
  TestRelationFour,
  TestRelationOne,
  TestRelationThree,
  TestRelationTwo,
} from "../__fixtures__/test-relations";
import { IMnemosCache } from "../interfaces";
import { MnemosCache } from "./MnemosCache";
import { MnemosRepository } from "./MnemosRepository";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("MnemosRepository - Relations", () => {
  let cache: IMnemosCache;
  const logger = createMockLogger();

  beforeEach(() => {
    cache = new MnemosCache();
  });

  const createRepo = (target: any) => new MnemosRepository({ target, cache, logger });

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

      await repo.insert(parent);

      // Re-load to get properly versioned children
      const loaded = await repo.findOneOrFail({ id: parent.id } as any);

      // Remove one child and update
      loaded.name = randomUUID();
      loaded.twos = [loaded.twos[0]];

      await repo.update(loaded);

      const found = await repo.findOne({ id: loaded.id } as any);
      expect(found!.twos).toHaveLength(1);
      expect(found!.twos[0].name).toEqual("keep");
    });

    test("should cascade delete via delete()", async () => {
      const repo = createRepo(TestRelationOne);
      const childRepo = createRepo(TestRelationTwo);

      const child = childRepo.create({
        first: randomUUID(),
        second: randomUUID(),
        name: "cascade-delete-child",
        customOneId: "",
      } as any);

      const parent = repo.create({ name: "cascade-delete-parent" } as any);
      child.customOneId = parent.id;
      parent.twos = [child];
      parent.fives = [];
      parent.many = [];

      await repo.insert(parent);

      await repo.delete({ id: parent.id } as any);

      const foundChild = await childRepo.findOne({
        first: child.first,
        second: child.second,
      } as any);
      expect(foundChild).toBeNull();
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

    test("should cascade destroy ManyToMany join entries", async () => {
      const repo = createRepo(TestRelationOne);
      const fiveRepo = createRepo(TestRelationFive);

      const five = fiveRepo.create({ name: "five-destroy" } as any);

      const parent = repo.create({ name: "parent-m2m-destroy" } as any);
      parent.fives = [five];
      parent.twos = [];
      parent.many = [];

      const saved = await repo.insert(parent);

      await repo.destroy(saved);

      // Five entity still exists (M2M doesn't cascade to the related entity itself)
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
  });
});
