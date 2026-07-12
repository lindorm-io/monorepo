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
  Sensitive,
  UpdateDateField,
  VersionField,
} from "../../../../decorators/index.js";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import { applyNamingStrategy } from "../../../utils/naming/apply-naming-strategy.js";
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
  const key = resolveTableKey(getEntityMetadata(RiParent), null);
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
  const key = resolveTableKey(getEntityMetadata(target), null);
  const table = store.tables.get(key) ?? new Map();
  table.set(JSON.stringify([id]), { id, value: `child-${id}`, parentId });
  store.tables.set(key, table);
};

const childTable = (store: MemoryStore, target: Function) =>
  store.tables.get(resolveTableKey(getEntityMetadata(target), null))!;

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

// ─── resolveTableKey follows the naming strategy ─────────────────────────────

@Entity()
class MemNamingRefreshTokenChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

@Entity({ name: "custom_chain" })
class MemNamingCustomChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

describe("resolveTableKey (memory store key)", () => {
  test("snake_cases the table key for a bare @Entity()", () => {
    const meta = applyNamingStrategy(
      getEntityMetadata(MemNamingRefreshTokenChain),
      "snake",
    );
    expect(resolveTableKey(meta, null)).toBe("mem_naming_refresh_token_chain");
  });

  test("keeps the class name verbatim under 'none'", () => {
    const meta = applyNamingStrategy(
      getEntityMetadata(MemNamingRefreshTokenChain),
      "none",
    );
    expect(resolveTableKey(meta, null)).toBe("MemNamingRefreshTokenChain");
  });

  test("keeps an @Entity({ name }) override verbatim under 'snake'", () => {
    const meta = applyNamingStrategy(getEntityMetadata(MemNamingCustomChain), "snake");
    expect(resolveTableKey(meta, null)).toBe("custom_chain");
  });
});

// ─── @Sensitive redaction in FK error output ─────────────────────────────────

@Entity({ name: "RiSensitiveParent" })
class RiSensitiveParent {
  @Sensitive() @PrimaryKeyField() @Generated("uuid") id!: string;
  @Field("string") name!: string;

  @OneToMany(() => RiSensitiveChild, "parent") children!: RiSensitiveChild[];
}

@Entity({ name: "RiSensitiveChild" })
class RiSensitiveChild {
  @PrimaryKeyField() @Generated("uuid") id!: string;
  @Field("string") value!: string;

  @Cascade({ onDestroy: "restrict" })
  @ManyToOne(() => RiSensitiveParent, "children")
  parent!: RiSensitiveParent;

  @Sensitive() @Field("uuid") parentId!: string;
}

// Parent PK sensitive, child FK NOT sensitive — the FK column still holds the
// parent's PK value, so the parent-side flag alone must trigger redaction
@Entity({ name: "RiSensitivePkParent" })
class RiSensitivePkParent {
  @Sensitive() @PrimaryKeyField() @Generated("uuid") id!: string;
  @Field("string") name!: string;

  @OneToMany(() => RiPlainFkChild, "parent") children!: RiPlainFkChild[];
}

@Entity({ name: "RiPlainFkChild" })
class RiPlainFkChild {
  @PrimaryKeyField() @Generated("uuid") id!: string;
  @Field("string") value!: string;

  @ManyToOne(() => RiSensitivePkParent, "children")
  parent!: RiSensitivePkParent;

  @Field("uuid") parentId!: string;
}

describe("sensitive redaction", () => {
  test("redacts a @Sensitive FK value in the FK-violation error", () => {
    const store = createStore();

    let error: any;
    try {
      assertForeignKeysExist(
        { id: "c1", value: "child", parentId: "secret-parent-id" },
        getEntityMetadata(RiSensitiveChild),
        store,
        null,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForeignKeyViolationError);
    expect(error.debug.value).toBe("[Filtered]");
    expect(error.details).not.toContain("secret-parent-id");
  });

  test("redacts the FK value when only the referenced parent PK is @Sensitive", () => {
    const store = createStore();

    let error: any;
    try {
      assertForeignKeysExist(
        { id: "c1", value: "child", parentId: "secret-parent-pk" },
        getEntityMetadata(RiPlainFkChild),
        store,
        null,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForeignKeyViolationError);
    expect(error.debug.value).toBe("[Filtered]");
    expect(error.details).not.toContain("secret-parent-pk");
  });

  test("keeps a non-sensitive FK value visible (behaviour unchanged)", () => {
    const store = createStore();

    let error: any;
    try {
      assertForeignKeysExist(
        { id: "c1", parentId: "visible-parent-id" },
        getEntityMetadata(RiCascadeChild),
        store,
        null,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForeignKeyViolationError);
    expect(error.debug.value).toBe("visible-parent-id");
    expect(error.details).toContain("visible-parent-id");
  });

  test("redacts a @Sensitive parent PK value in the restrict error", () => {
    const store = createStore();

    const childKey = resolveTableKey(getEntityMetadata(RiSensitiveChild), null);
    const table = new Map();
    table.set(JSON.stringify(["c1"]), {
      id: "c1",
      value: "child",
      parentId: "secret-pk",
    });
    store.tables.set(childKey, table);

    let error: any;
    try {
      applyDeleteReferentialActions(
        [{ id: "secret-pk", name: "parent" }],
        getEntityMetadata(RiSensitiveParent),
        store,
        null,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForeignKeyViolationError);
    expect(error.debug.value).toBe("[Filtered]");
  });

  test("keeps a non-sensitive parent PK value visible in the restrict error", () => {
    const store = createStore();
    seedParent(store, "p1");
    seedChild(store, RiRestrictChild, "c1", "p1");

    let error: any;
    try {
      applyDeleteReferentialActions(
        [{ id: "p1", name: "parent-p1" }],
        getEntityMetadata(RiParent),
        store,
        null,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForeignKeyViolationError);
    expect(error.debug.value).toBe("p1");
  });
});
