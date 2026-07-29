import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  CreateDateField,
  DeleteDateField,
  Entity,
  Field,
  Generated,
  Hide,
  ManyToOne,
  Nullable,
  OneToMany,
  PrimaryKeyField,
  ReadOnly,
  UpdateDateField,
  VersionField,
} from "../../../../decorators/index.js";
import { ProteusSource } from "../../../../classes/ProteusSource.js";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError.js";
import { MemoryCursor } from "./MemoryCursor.js";
import type { IProteusRepository } from "../../../../interfaces/index.js";

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity({ name: "RepoTestCategory" })
class RepoTestCategory {
  @PrimaryKeyField() @Generated("uuid") id!: string;

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
  @PrimaryKeyField() @Generated("uuid") id!: string;

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
  @PrimaryKeyField() @Generated("uuid") id!: string;

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

@Entity({ name: "RepoReadonlyScoped" })
class RepoReadonlyScoped {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @ReadOnly()
  @Field("string")
  immutable!: string;

  @ReadOnly("update")
  @Field("string")
  updateReadonly!: string;

  @ReadOnly("upsert")
  @Field("string")
  upsertReadonly!: string;
}

@Entity({ name: "RepoLindormIdItem" })
class RepoLindormIdItem {
  @PrimaryKeyField("lindorm_id") @Generated() id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "RepoHideScoped" })
class RepoHideScoped {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @Hide()
  @Field("string")
  hiddenBoth!: string;

  @Hide("single")
  @Field("string")
  hiddenSingle!: string;

  @Hide("multiple")
  @Field("string")
  hiddenMultiple!: string;
}

// Multiple-hidden only, with no bare/single-hidden field. This matters because the
// base findOne pre-filters with ["single"]: when an entity HAS a single/bare-hidden
// field, that pre-filter emits an explicit `select` that short-circuits find()'s own
// hidden filter — masking find()'s scope. With ONLY a multiple-hidden field the
// pre-filter is a no-op, so findOne reaches find() with no select and find()'s scope
// (single) is what decides whether the multiple-hidden field survives. This is the
// entity that actually exercises — and guards — the find() scope fix.
@Entity({ name: "RepoHideMultipleOnly" })
class RepoHideMultipleOnly {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @Hide("multiple")
  @Field("string")
  hiddenMultiple!: string;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let source: ProteusSource;
let categoryRepo: IProteusRepository<RepoTestCategory>;
let itemRepo: IProteusRepository<RepoTestItem>;
let softRepo: IProteusRepository<RepoSoftItem>;
let readonlyRepo: IProteusRepository<RepoReadonlyScoped>;
let lindormIdRepo: IProteusRepository<RepoLindormIdItem>;
let hideRepo: IProteusRepository<RepoHideScoped>;
let multiOnlyRepo: IProteusRepository<RepoHideMultipleOnly>;

beforeAll(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [
      RepoTestCategory,
      RepoTestItem,
      RepoSoftItem,
      RepoReadonlyScoped,
      RepoLindormIdItem,
      RepoHideScoped,
      RepoHideMultipleOnly,
    ],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();

  categoryRepo = source.repository(RepoTestCategory);
  itemRepo = source.repository(RepoTestItem);
  softRepo = source.repository(RepoSoftItem);
  readonlyRepo = source.repository(RepoReadonlyScoped);
  lindormIdRepo = source.repository(RepoLindormIdItem);
  hideRepo = source.repository(RepoHideScoped);
  multiOnlyRepo = source.repository(RepoHideMultipleOnly);
});

afterAll(async () => {
  await source.disconnect();
});

beforeEach(async () => {
  await categoryRepo.clear();
  await itemRepo.clear();
  await softRepo.clear();
  await readonlyRepo.clear();
  await lindormIdRepo.clear();
  await hideRepo.clear();
  await multiOnlyRepo.clear();
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

// ─── @ReadOnly operation scopes ─────────────────────────────────────────────────

describe("MemoryRepository @ReadOnly operation scopes", () => {
  test("@ReadOnly('upsert') is preserved on upsert conflict but writable via update()", async () => {
    const inserted = await readonlyRepo.insert(
      readonlyRepo.create({
        name: "n1",
        immutable: "imm",
        updateReadonly: "u1",
        upsertReadonly: "keep",
      }),
    );

    // Upsert conflict must NOT overwrite an upsert-readonly field.
    inserted.name = "n2";
    inserted.upsertReadonly = "changed";
    const upserted = await readonlyRepo.upsert(inserted);
    expect(upserted.name).toBe("n2");
    expect(upserted.upsertReadonly).toBe("keep");

    // update() may still write it.
    const found = await readonlyRepo.findOneOrFail({ id: inserted.id });
    found.upsertReadonly = "viaUpdate";
    await readonlyRepo.update(found);
    const refetched = await readonlyRepo.findOneOrFail({ id: inserted.id });
    expect(refetched.upsertReadonly).toBe("viaUpdate");
  });

  test("@ReadOnly() is immutable on both update and upsert", async () => {
    const inserted = await readonlyRepo.insert(
      readonlyRepo.create({
        name: "n1",
        immutable: "locked",
        updateReadonly: "u1",
        upsertReadonly: "p1",
      }),
    );

    // upsert conflict keeps the stored value
    inserted.name = "n2";
    inserted.immutable = "hacked";
    const upserted = await readonlyRepo.upsert(inserted);
    expect(upserted.immutable).toBe("locked");
    expect(upserted.name).toBe("n2");

    // update() ignores the change to the readonly field
    const found = await readonlyRepo.findOneOrFail({ id: inserted.id });
    found.immutable = "hacked-again";
    found.name = "n3";
    await readonlyRepo.update(found);
    const refetched = await readonlyRepo.findOneOrFail({ id: inserted.id });
    expect(refetched.immutable).toBe("locked");
    expect(refetched.name).toBe("n3");
  });

  test("@ReadOnly('update') is writable by upsert but ignored by update()", async () => {
    const inserted = await readonlyRepo.insert(
      readonlyRepo.create({
        name: "n1",
        immutable: "i",
        updateReadonly: "orig",
        upsertReadonly: "p",
      }),
    );

    // upsert conflict writes the update-only readonly field
    inserted.updateReadonly = "viaUpsert";
    const upserted = await readonlyRepo.upsert(inserted);
    expect(upserted.updateReadonly).toBe("viaUpsert");

    // update() leaves it untouched
    const found = await readonlyRepo.findOneOrFail({ id: inserted.id });
    found.updateReadonly = "viaUpdate";
    found.name = "n2";
    await readonlyRepo.update(found);
    const refetched = await readonlyRepo.findOneOrFail({ id: inserted.id });
    expect(refetched.updateReadonly).toBe("viaUpsert");
    expect(refetched.name).toBe("n2");
  });
});

// ─── @Hide scope matrix ─────────────────────────────────────────────────────────

describe("MemoryRepository @Hide query-scope matrix", () => {
  const seed = () =>
    hideRepo.insert(
      hideRepo.create({
        name: "visible",
        hiddenBoth: "both",
        hiddenSingle: "single",
        hiddenMultiple: "multiple",
      }),
    );

  test("findOne resolves multiple-hidden fields but strips single/both-hidden", async () => {
    const inserted = await seed();

    const found = await hideRepo.findOne({ id: inserted.id });

    expect(found).not.toBeNull();
    expect(found!.name).toBe("visible");
    expect(found!.hiddenBoth).toBeUndefined();
    expect(found!.hiddenSingle).toBeUndefined();
    // The bug: @Hide("multiple") was wrongly stripped on findOne too.
    expect(found!.hiddenMultiple).toBe("multiple");
  });

  test("find resolves single-hidden fields but strips multiple/both-hidden", async () => {
    const inserted = await seed();

    const [found] = await hideRepo.find({ id: inserted.id });

    expect(found).toBeDefined();
    expect(found.name).toBe("visible");
    expect(found.hiddenBoth).toBeUndefined();
    expect(found.hiddenSingle).toBe("single");
    expect(found.hiddenMultiple).toBeUndefined();
  });

  test("explicit select overrides the hidden filter on findOne", async () => {
    const inserted = await seed();

    const found = await hideRepo.findOne(
      { id: inserted.id },
      { select: ["id", "hiddenBoth", "hiddenSingle", "hiddenMultiple"] },
    );

    expect(found).not.toBeNull();
    expect(found!.hiddenBoth).toBe("both");
    expect(found!.hiddenSingle).toBe("single");
    expect(found!.hiddenMultiple).toBe("multiple");
  });

  test("explicit select overrides the hidden filter on find", async () => {
    const inserted = await seed();

    const [found] = await hideRepo.find(
      { id: inserted.id },
      { select: ["id", "hiddenBoth", "hiddenSingle", "hiddenMultiple"] },
    );

    expect(found).toBeDefined();
    expect(found.hiddenBoth).toBe("both");
    expect(found.hiddenSingle).toBe("single");
    expect(found.hiddenMultiple).toBe("multiple");
  });

  // Genuine guard for the find() scope fix. On RepoHideMultipleOnly the base
  // findOne pre-filter is a no-op (no single/bare-hidden field), so findOne reaches
  // find() with no explicit select and find()'s own scope decides the projection.
  // With the buggy hardcoded ["multiple"] this multiple-hidden field is wrongly
  // stripped on findOne; with the fixed [scope]="single" it is resolved.
  test("findOne resolves a multiple-hidden field even when no pre-filter select is emitted", async () => {
    const inserted = await multiOnlyRepo.insert(
      multiOnlyRepo.create({ name: "visible", hiddenMultiple: "multiple" }),
    );

    const found = await multiOnlyRepo.findOne({ id: inserted.id });

    expect(found).not.toBeNull();
    expect(found!.name).toBe("visible");
    expect(found!.hiddenMultiple).toBe("multiple");
  });

  test("find still strips a multiple-hidden field on the multiple-only entity", async () => {
    const inserted = await multiOnlyRepo.insert(
      multiOnlyRepo.create({ name: "visible", hiddenMultiple: "multiple" }),
    );

    const [found] = await multiOnlyRepo.find({ id: inserted.id });

    expect(found).toBeDefined();
    expect(found.name).toBe("visible");
    expect(found.hiddenMultiple).toBeUndefined();
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

// ─── lindorm_id write path ────────────────────────────────────────────────────

describe("MemoryRepository lindorm_id field type", () => {
  test("insert with a generated id passes validation", async () => {
    const item = await lindormIdRepo.insert(lindormIdRepo.create({ name: "ok" }));

    expect(item.id).toMatch(/^[A-Za-z0-9]{24}$/);
  });

  test("insert with an explicit valid id passes validation", async () => {
    const entity = lindormIdRepo.create({ name: "ok" });
    entity.id = "A1b2C3d4E5f6G7h8I9j0K1l2";

    await expect(lindormIdRepo.insert(entity)).resolves.toMatchObject({
      id: "A1b2C3d4E5f6G7h8I9j0K1l2",
    });
  });

  test("insert with a format-valid id wider than the column throws validation", async () => {
    // The bare @Generated() PK resolves max 24 — a namespaced 31-char id is
    // format-valid but must be rejected here, not by the SQL driver at insert.
    const entity = lindormIdRepo.create({ name: "too-wide" });
    entity.id = "client_A1b2C3d4E5f6G7h8I9j0K1l2";

    await expect(lindormIdRepo.insert(entity)).rejects.toThrow();
  });

  test("insert with a malformed id throws validation", async () => {
    const entity = lindormIdRepo.create({ name: "bad" });
    entity.id = "not-a-lindorm-id!";

    await expect(lindormIdRepo.insert(entity)).rejects.toThrow();
  });
});
