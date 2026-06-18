import { describe, expect, test } from "vitest";
import {
  Cascade,
  CreateDateField,
  Entity,
  Field,
  Generated,
  ManyToOne,
  Nullable,
  OneToMany,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "../../../../decorators/index.js";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import type { MemoryStore } from "../types/memory-store.js";
import {
  applyDeleteReferentialActions,
  assertForeignKeysExist,
  resolveTableKey,
} from "./memory-referential-integrity.js";

// ─── Entities ───────────────────────────────────────────────────────────────

@Entity({ name: "RiParent" })
class RiParent {
  @PrimaryKeyField() @Generated("uuid") id!: string;
  @VersionField() version!: number;
  @CreateDateField() createdAt!: Date;
  @UpdateDateField() updatedAt!: Date;
  @Field("string") name!: string;

  @OneToMany(() => RiCascadeChild, "parent") cascadeChildren!: RiCascadeChild[];
  @OneToMany(() => RiRestrictChild, "parent") restrictChildren!: RiRestrictChild[];
  @OneToMany(() => RiNullifyChild, "parent") nullifyChildren!: RiNullifyChild[];
}

@Entity({ name: "RiCascadeChild" })
class RiCascadeChild {
  @PrimaryKeyField() @Generated("uuid") id!: string;
  @VersionField() version!: number;
  @CreateDateField() createdAt!: Date;
  @UpdateDateField() updatedAt!: Date;
  @Field("string") value!: string;

  @Cascade({ onDestroy: "cascade" })
  @ManyToOne(() => RiParent, "cascadeChildren")
  parent!: RiParent;
  parentId!: string;
}

@Entity({ name: "RiRestrictChild" })
class RiRestrictChild {
  @PrimaryKeyField() @Generated("uuid") id!: string;
  @VersionField() version!: number;
  @CreateDateField() createdAt!: Date;
  @UpdateDateField() updatedAt!: Date;
  @Field("string") value!: string;

  @Cascade({ onDestroy: "restrict" })
  @ManyToOne(() => RiParent, "restrictChildren")
  parent!: RiParent;
  parentId!: string;
}

@Entity({ name: "RiNullifyChild" })
class RiNullifyChild {
  @PrimaryKeyField() @Generated("uuid") id!: string;
  @VersionField() version!: number;
  @CreateDateField() createdAt!: Date;
  @UpdateDateField() updatedAt!: Date;
  @Field("string") value!: string;

  @Cascade({ onDestroy: "set_null" })
  @ManyToOne(() => RiParent, "nullifyChildren")
  parent!: RiParent | null;

  @Nullable() @Field("uuid") parentId!: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createStore = (): MemoryStore => ({
  tables: new Map(),
  joinTables: new Map(),
  collectionTables: new Map(),
  incrementCounters: new Map(),
});

const seedParent = (store: MemoryStore, id: string): void => {
  const key = resolveTableKey(RiParent, null);
  const table = store.tables.get(key) ?? new Map();
  table.set(JSON.stringify([id]), { id, name: `parent-${id}` });
  store.tables.set(key, table);
};

const seedChild = (
  store: MemoryStore,
  target: Function,
  id: string,
  parentId: string | null,
): void => {
  const key = resolveTableKey(target, null);
  const table = store.tables.get(key) ?? new Map();
  table.set(JSON.stringify([id]), { id, value: `child-${id}`, parentId });
  store.tables.set(key, table);
};

const childTable = (store: MemoryStore, target: Function) =>
  store.tables.get(resolveTableKey(target, null))!;

// ─── assertForeignKeysExist ──────────────────────────────────────────────────

describe("assertForeignKeysExist", () => {
  test("passes when FK references an existing parent", () => {
    const store = createStore();
    seedParent(store, "p1");

    expect(() =>
      assertForeignKeysExist(
        { id: "c1", parentId: "p1" },
        getEntityMetadata(RiCascadeChild),
        store,
        null,
      ),
    ).not.toThrow();
  });

  test("skips validation when FK value is null", () => {
    const store = createStore();

    expect(() =>
      assertForeignKeysExist(
        { id: "c1", parentId: null },
        getEntityMetadata(RiNullifyChild),
        store,
        null,
      ),
    ).not.toThrow();
  });

  test("throws ForeignKeyViolationError when parent does not exist", () => {
    const store = createStore();

    expect(() =>
      assertForeignKeysExist(
        { id: "c1", parentId: "missing" },
        getEntityMetadata(RiCascadeChild),
        store,
        null,
      ),
    ).toThrow(ForeignKeyViolationError);
  });

  test("throws when the parent table has not been created", () => {
    const store = createStore();

    expect(() =>
      assertForeignKeysExist(
        { id: "c1", parentId: "p1" },
        getEntityMetadata(RiCascadeChild),
        store,
        null,
      ),
    ).toThrow(ForeignKeyViolationError);
  });
});

// ─── applyDeleteReferentialActions ──────────────────────────────────────────

describe("applyDeleteReferentialActions", () => {
  test("cascade deletes dependent child rows", () => {
    const store = createStore();
    seedParent(store, "p1");
    seedChild(store, RiCascadeChild, "c1", "p1");
    seedChild(store, RiCascadeChild, "c2", "p1");

    applyDeleteReferentialActions(
      [{ id: "p1", name: "parent-p1" }],
      getEntityMetadata(RiParent),
      store,
      null,
    );

    expect(childTable(store, RiCascadeChild).size).toBe(0);
  });

  test("restrict throws when dependent child rows exist", () => {
    const store = createStore();
    seedParent(store, "p1");
    seedChild(store, RiRestrictChild, "c1", "p1");

    expect(() =>
      applyDeleteReferentialActions(
        [{ id: "p1", name: "parent-p1" }],
        getEntityMetadata(RiParent),
        store,
        null,
      ),
    ).toThrow(ForeignKeyViolationError);
  });

  test("set_null nullifies the FK column on dependent child rows", () => {
    const store = createStore();
    seedParent(store, "p1");
    seedChild(store, RiNullifyChild, "c1", "p1");
    seedChild(store, RiNullifyChild, "c2", "p1");

    applyDeleteReferentialActions(
      [{ id: "p1", name: "parent-p1" }],
      getEntityMetadata(RiParent),
      store,
      null,
    );

    const rows = [...childTable(store, RiNullifyChild).values()];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.parentId).toBeNull();
    }
  });

  test("no-op when no dependent child rows match", () => {
    const store = createStore();
    seedParent(store, "p1");
    seedChild(store, RiRestrictChild, "c1", "other-parent");

    expect(() =>
      applyDeleteReferentialActions(
        [{ id: "p1", name: "parent-p1" }],
        getEntityMetadata(RiParent),
        store,
        null,
      ),
    ).not.toThrow();
    expect(childTable(store, RiRestrictChild).size).toBe(1);
  });

  test("returns early for an empty deletedRows list", () => {
    const store = createStore();
    seedParent(store, "p1");
    seedChild(store, RiRestrictChild, "c1", "p1");

    expect(() =>
      applyDeleteReferentialActions([], getEntityMetadata(RiParent), store, null),
    ).not.toThrow();
  });
});
