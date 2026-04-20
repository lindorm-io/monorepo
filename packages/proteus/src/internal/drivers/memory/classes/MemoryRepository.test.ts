import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  CreateDateField,
  DeleteDateField,
  Entity,
  Field,
  ManyToOne,
  Nullable,
  OneToMany,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "../../../../decorators";
import { ProteusSource } from "../../../../classes/ProteusSource";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError";
import { MemoryCursor } from "./MemoryCursor";
import type { IProteusRepository } from "../../../../interfaces";

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity({ name: "RepoTestCategory" })
class RepoTestCategory {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @OneToMany(() => RepoTestItem, "category")
  items!: RepoTestItem[];
}

@Entity({ name: "RepoTestItem" })
class RepoTestItem {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  label!: string;

  @Nullable()
  @Field("integer")
  quantity!: number | null;

  @ManyToOne(() => RepoTestCategory, "items")
  category!: RepoTestCategory | null;
}

@Entity({ name: "RepoSoftItem" })
class RepoSoftItem {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @DeleteDateField()
  deletedAt!: Date | null;

  @Field("string")
  name!: string;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let source: ProteusSource;
let categoryRepo: IProteusRepository<RepoTestCategory>;
let itemRepo: IProteusRepository<RepoTestItem>;
let softRepo: IProteusRepository<RepoSoftItem>;

beforeAll(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [RepoTestCategory, RepoTestItem, RepoSoftItem],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();

  categoryRepo = source.repository(RepoTestCategory);
  itemRepo = source.repository(RepoTestItem);
  softRepo = source.repository(RepoSoftItem);
});

afterAll(async () => {
  await source.disconnect();
});

beforeEach(async () => {
  await categoryRepo.clear();
  await itemRepo.clear();
  await softRepo.clear();
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("MemoryRepository.create", () => {
  test("creates an entity instance with defaults applied", () => {
    const item = itemRepo.create({ label: "Widget", quantity: 3 });

    expect(item).toBeInstanceOf(RepoTestItem);
    expect(item.label).toBe("Widget");
    expect(item.quantity).toBe(3);
    expect(item.id).toBeDefined();
  });
});

// ─── insert ───────────────────────────────────────────────────────────────────

describe("MemoryRepository.insert", () => {
  test("inserts a new entity and returns hydrated result", async () => {
    const item = itemRepo.create({ label: "New Item", quantity: 5 });
    const inserted = await itemRepo.insert(item);

    expect(inserted).toMatchSnapshot({
      id: expect.any(String),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  test("persists the entity so it is findable", async () => {
    const item = itemRepo.create({ label: "Findable", quantity: 1 });
    const inserted = await itemRepo.insert(item);
    const found = await itemRepo.findOne({ id: inserted.id });

    expect(found).not.toBeNull();
    expect(found!.label).toBe("Findable");
  });

  test("throws MemoryDuplicateKeyError when inserting duplicate primary key", async () => {
    const item = itemRepo.create({ label: "Original" });
    const inserted = await itemRepo.insert(item);

    // Create a second entity with the same primary key
    const duplicate = itemRepo.create({ label: "Duplicate" });
    (duplicate as any).id = inserted.id;

    await expect(itemRepo.insert(duplicate)).rejects.toThrow(MemoryDuplicateKeyError);
  });
});

// ─── find ─────────────────────────────────────────────────────────────────────

describe("MemoryRepository.find", () => {
  beforeEach(async () => {
    await itemRepo.insert(itemRepo.create({ label: "Alpha", quantity: 10 }));
    await itemRepo.insert(itemRepo.create({ label: "Beta", quantity: 20 }));
    await itemRepo.insert(itemRepo.create({ label: "Gamma", quantity: 30 }));
  });

  test("returns all entities without criteria", async () => {
    const results = await itemRepo.find();
    expect(results).toHaveLength(3);
  });

  test("filters by predicate", async () => {
    const results = await itemRepo.find({ label: "Beta" });
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("Beta");
  });

  test("returns empty array when no match", async () => {
    const results = await itemRepo.find({ label: "NotExist" });
    expect(results).toEqual([]);
  });

  test("supports order option", async () => {
    const results = await itemRepo.find(undefined, { order: { quantity: "DESC" } });
    const quantities = results.map((r) => r.quantity);
    expect(quantities).toEqual([30, 20, 10]);
  });

  test("supports limit option", async () => {
    const results = await itemRepo.find(undefined, { limit: 2 });
    expect(results).toHaveLength(2);
  });
});

// ─── findOne ──────────────────────────────────────────────────────────────────

describe("MemoryRepository.findOne", () => {
  test("returns the first matching entity", async () => {
    const inserted = await itemRepo.insert(itemRepo.create({ label: "Only" }));
    const found = await itemRepo.findOne({ id: inserted.id });

    expect(found).not.toBeNull();
    expect(found!.label).toBe("Only");
  });

  test("returns null when not found", async () => {
    const found = await itemRepo.findOne({ id: "non-existent" });
    expect(found).toBeNull();
  });
});

// ─── findOneOrFail ────────────────────────────────────────────────────────────

describe("MemoryRepository.findOneOrFail", () => {
  test("returns entity when found", async () => {
    const inserted = await itemRepo.insert(itemRepo.create({ label: "Found" }));
    const result = await itemRepo.findOneOrFail({ id: inserted.id });

    expect(result.label).toBe("Found");
  });

  test("throws when not found", async () => {
    await expect(itemRepo.findOneOrFail({ id: "gone" })).rejects.toThrow();
  });
});

// ─── save ─────────────────────────────────────────────────────────────────────

describe("MemoryRepository.save", () => {
  test("inserts when entity does not exist", async () => {
    const item = itemRepo.create({ label: "SaveNew" });
    const saved = await itemRepo.save(item);

    expect(saved.id).toBeDefined();

    const found = await itemRepo.findOne({ id: saved.id });
    expect(found).not.toBeNull();
  });

  test("updates when entity exists", async () => {
    const item = await itemRepo.insert(itemRepo.create({ label: "Original" }));
    item.label = "Updated";

    const saved = await itemRepo.save(item);
    expect(saved.label).toBe("Updated");

    const found = await itemRepo.findOne({ id: saved.id });
    expect(found!.label).toBe("Updated");
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("MemoryRepository.update", () => {
  test("updates an existing entity", async () => {
    const item = await itemRepo.insert(itemRepo.create({ label: "Before", quantity: 1 }));
    item.label = "After";

    const updated = await itemRepo.update(item);
    expect(updated.label).toBe("After");
  });

  test("version is incremented on update", async () => {
    const item = await itemRepo.insert(itemRepo.create({ label: "Versioned" }));
    const originalVersion = item.version;

    item.label = "Versioned Updated";
    const updated = await itemRepo.update(item);

    expect(updated.version).toBe(originalVersion + 1);
  });
});

// ─── destroy ──────────────────────────────────────────────────────────────────

describe("MemoryRepository.destroy", () => {
  test("removes the entity from storage", async () => {
    const item = await itemRepo.insert(itemRepo.create({ label: "ToDestroy" }));

    await itemRepo.destroy(item);

    const found = await itemRepo.findOne({ id: item.id });
    expect(found).toBeNull();
  });
});

// ─── softDestroy / restore ────────────────────────────────────────────────────

describe("MemoryRepository.softDestroy / restore", () => {
  test("softDestroy sets deletedAt", async () => {
    const item = await softRepo.insert(softRepo.create({ name: "SoftTarget" }));
    await softRepo.softDestroy(item);

    const withDeleted = await softRepo.find(undefined, { withDeleted: true });
    const found = withDeleted.find((i) => i.id === item.id);

    expect(found).not.toBeUndefined();
    expect(found!.deletedAt).toBeInstanceOf(Date);
  });

  test("soft-deleted entity excluded from normal find", async () => {
    const item = await softRepo.insert(softRepo.create({ name: "GoneButNotForgotten" }));
    await softRepo.softDestroy(item);

    const results = await softRepo.find();
    expect(results.some((r) => r.id === item.id)).toBe(false);
  });

  test("restore clears deletedAt using criteria", async () => {
    const item = await softRepo.insert(softRepo.create({ name: "Restorable" }));
    await softRepo.softDestroy(item);

    // Restore by criteria predicate
    await softRepo.restore({ id: item.id });

    const restored = await softRepo.find();
    expect(restored.some((r) => r.id === item.id)).toBe(true);
  });
});

// ─── upsert ───────────────────────────────────────────────────────────────────

describe("MemoryRepository.upsert", () => {
  test("inserts when entity does not exist", async () => {
    const item = itemRepo.create({ label: "UpsertNew" });
    const result = await itemRepo.upsert(item);

    const found = await itemRepo.findOne({ id: result.id });
    expect(found).not.toBeNull();
    expect(found!.label).toBe("UpsertNew");
  });

  test("updates when entity already exists", async () => {
    const item = await itemRepo.insert(itemRepo.create({ label: "UpsertExisting" }));
    item.label = "UpsertUpdated";

    const result = await itemRepo.upsert(item);
    expect(result.label).toBe("UpsertUpdated");

    const all = await itemRepo.find({ id: item.id });
    expect(all).toHaveLength(1);
  });
});

// ─── count ────────────────────────────────────────────────────────────────────

describe("MemoryRepository.count", () => {
  test("returns 0 when table is empty", async () => {
    const count = await itemRepo.count();
    expect(count).toBe(0);
  });

  test("returns correct count", async () => {
    await itemRepo.insert(itemRepo.create({ label: "A" }));
    await itemRepo.insert(itemRepo.create({ label: "B" }));

    const count = await itemRepo.count();
    expect(count).toBe(2);
  });

  test("filters by predicate", async () => {
    await itemRepo.insert(itemRepo.create({ label: "X" }));
    await itemRepo.insert(itemRepo.create({ label: "Y" }));

    const count = await itemRepo.count({ label: "X" });
    expect(count).toBe(1);
  });
});

// ─── exists ───────────────────────────────────────────────────────────────────

describe("MemoryRepository.exists", () => {
  test("returns false when no entities match an open predicate", async () => {
    const result = await itemRepo.exists({});
    expect(result).toBe(false);
  });

  test("returns true when at least one entity exists", async () => {
    await itemRepo.insert(itemRepo.create({ label: "Exists" }));

    const result = await itemRepo.exists({});
    expect(result).toBe(true);
  });

  test("returns false when predicate has no match", async () => {
    await itemRepo.insert(itemRepo.create({ label: "NoMatch" }));

    const result = await itemRepo.exists({ label: "Gone" });
    expect(result).toBe(false);
  });
});

// ─── cursor ───────────────────────────────────────────────────────────────────

describe("MemoryRepository.cursor", () => {
  test("returns a MemoryCursor instance", async () => {
    const cursor = await itemRepo.cursor();
    expect(cursor).toBeInstanceOf(MemoryCursor);
    await cursor.close();
  });

  test("cursor iterates over all entities", async () => {
    await itemRepo.insert(itemRepo.create({ label: "C1" }));
    await itemRepo.insert(itemRepo.create({ label: "C2" }));

    const cursor = await itemRepo.cursor();
    const items: RepoTestItem[] = [];

    for await (const item of cursor) {
      items.push(item);
    }

    expect(items).toHaveLength(2);
  });

  test("cursor respects where option", async () => {
    await itemRepo.insert(itemRepo.create({ label: "CursorA" }));
    await itemRepo.insert(itemRepo.create({ label: "CursorB" }));

    const cursor = await itemRepo.cursor({ where: { label: "CursorA" } });
    const items: RepoTestItem[] = [];

    for await (const item of cursor) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("CursorA");
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe("MemoryRepository.clear", () => {
  test("removes all entities from the table", async () => {
    await itemRepo.insert(itemRepo.create({ label: "P1" }));
    await itemRepo.insert(itemRepo.create({ label: "P2" }));

    await itemRepo.clear();

    const results = await itemRepo.find();
    expect(results).toHaveLength(0);
  });

  test("no-op when table is already empty", async () => {
    await expect(itemRepo.clear()).resolves.toBeUndefined();
  });
});

// ─── insert (bulk via array overload) ────────────────────────────────────────

describe("MemoryRepository.insert (bulk array)", () => {
  test("inserts multiple entities at once using the array overload", async () => {
    const items = [
      itemRepo.create({ label: "Bulk1" }),
      itemRepo.create({ label: "Bulk2" }),
      itemRepo.create({ label: "Bulk3" }),
    ];

    const results = await itemRepo.insert(items);

    expect(results).toHaveLength(3);

    const all = await itemRepo.find();
    expect(all).toHaveLength(3);
  });

  test("returns empty array for empty input", async () => {
    const results = await itemRepo.insert([]);
    expect(results).toEqual([]);
  });
});

// ─── duplicate key detection ──────────────────────────────────────────────────

describe("MemoryRepository duplicate key handling", () => {
  test("inserting a duplicate primary key throws MemoryDuplicateKeyError", async () => {
    const item = await itemRepo.insert(itemRepo.create({ label: "Dup" }));

    const dup = itemRepo.create({ label: "AlsoDup" });
    (dup as any).id = item.id;

    let caughtError: unknown;
    try {
      await itemRepo.insert(dup);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(MemoryDuplicateKeyError);
  });
});
