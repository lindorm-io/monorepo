import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { QueryState } from "#internal/types/query";
import { compileAggregate } from "./compile-aggregate";

// --- Metadata fixtures ---

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "orders",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("amount", { type: "float" }),
    makeField("quantity", { type: "integer" }),
    makeField("price", { type: "float" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const softDeleteMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "invoices",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("total", { type: "float" }),
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const versionedMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "prices",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("value", { type: "float" }),
    makeField("versionStartDate", {
      type: "timestamp",
      name: "version_start_date",
      decorator: "VersionStartDate",
    }),
    makeField("versionEndDate", {
      type: "timestamp",
      name: "version_end_date",
      decorator: "VersionEndDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const versionedAndSoftDeleteMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "ledger_entries",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("amount", { type: "float" }),
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
    makeField("versionStartDate", {
      type: "timestamp",
      name: "version_start_date",
      decorator: "VersionStartDate",
    }),
    makeField("versionEndDate", {
      type: "timestamp",
      name: "version_end_date",
      decorator: "VersionEndDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const halfVersionedMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "broken",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("value", { type: "float" }),
    makeField("versionStartDate", {
      type: "timestamp",
      name: "version_start_date",
      decorator: "VersionStartDate",
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const noNamespaceMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "metrics",
    namespace: null,
  },
  fields: [makeField("id", { type: "uuid" }), makeField("score", { type: "float" })],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

// --- Helpers ---

const createEmptyState = (): QueryState<any> => ({
  predicates: [],
  orderBy: null,
  skip: null,
  take: null,
  includes: [],
  selections: null,
  withDeleted: false,
  distinct: false,
  lock: null,
  versionTimestamp: null,
  withAllVersions: false,
  rawSelections: [],
  rawWhere: [],
  groupBy: null,
  having: [],
  rawHaving: [],
  subqueryPredicates: [],
  ctes: [],
  cteFrom: null,
  windows: [],
  setOperations: [],
  resolvedFilters: [],
  withoutScope: false,
  filterOverrides: {},
});

// --- Tests ---

describe("compileAggregate — aggregate type variations", () => {
  test("should compile SUM with no criteria", () => {
    const result = compileAggregate("SUM", "amount", createEmptyState(), metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile AVG with no criteria", () => {
    const result = compileAggregate("AVG", "amount", createEmptyState(), metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile MIN with no criteria", () => {
    const result = compileAggregate("MIN", "amount", createEmptyState(), metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile MAX with no criteria", () => {
    const result = compileAggregate("MAX", "amount", createEmptyState(), metadata);
    expect(result).toMatchSnapshot();
  });

  test("should aggregate over a non-primary integer field", () => {
    const result = compileAggregate("SUM", "quantity", createEmptyState(), metadata);
    expect(result).toMatchSnapshot();
  });
});

describe("compileAggregate — WHERE predicate criteria", () => {
  test("should compile SUM with a simple equality predicate", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { amount: { $gte: 100 } }, conjunction: "and" as const }],
    };
    const result = compileAggregate("SUM", "amount", state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.params).toContain(100);
  });

  test("should compile AVG with multiple predicates ANDed", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [
        { predicate: { quantity: { $gte: 1 } }, conjunction: "and" as const },
        { predicate: { price: { $lte: 500 } }, conjunction: "and" as const },
      ],
    };
    const result = compileAggregate("AVG", "price", state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.params).toEqual([1, 500]);
  });

  test("should have correct param indices when predicate and no filters", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { amount: 42.5 }, conjunction: "and" as const }],
    };
    const result = compileAggregate("SUM", "amount", state, metadata);
    expect(result.params).toEqual([42.5]);
    expect(result.text).toContain("$1");
  });
});

describe("compileAggregate — soft-delete filtering", () => {
  test("should add DeleteDate IS NULL filter by default on soft-deletable entity", () => {
    const result = compileAggregate(
      "SUM",
      "total",
      createEmptyState(),
      softDeleteMetadata,
    );
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("IS NULL");
    expect(result.text).toContain("deleted_at");
  });

  test("should omit soft-delete filter when withDeleted is true", () => {
    const state: QueryState<any> = { ...createEmptyState(), withDeleted: true };
    const result = compileAggregate("SUM", "total", state, softDeleteMetadata);
    expect(result).toMatchSnapshot();
    expect(result.text).not.toContain("WHERE");
  });

  test("should combine user predicate with soft-delete filter", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { total: { $gte: 50 } }, conjunction: "and" as const }],
    };
    const result = compileAggregate("MAX", "total", state, softDeleteMetadata);
    expect(result).toMatchSnapshot();
    expect(result.params).toEqual([50]);
  });
});

describe("compileAggregate — version filtering", () => {
  test("should emit VersionEndDate IS NULL by default on versioned entity", () => {
    const result = compileAggregate(
      "SUM",
      "value",
      createEmptyState(),
      versionedMetadata,
    );
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("version_end_date");
    expect(result.text).toContain("IS NULL");
  });

  test("should emit point-in-time version condition when versionTimestamp is set", () => {
    const timestamp = new Date("2025-06-15T12:00:00Z");
    const state: QueryState<any> = { ...createEmptyState(), versionTimestamp: timestamp };
    const result = compileAggregate("AVG", "value", state, versionedMetadata);
    expect(result).toMatchSnapshot();
    expect(result.params).toContain(timestamp);
    expect(result.text).toContain("version_start_date");
    expect(result.text).toContain("version_end_date");
  });

  test("should omit version filter when withAllVersions is true", () => {
    const state: QueryState<any> = { ...createEmptyState(), withAllVersions: true };
    const result = compileAggregate("SUM", "value", state, versionedMetadata);
    expect(result).toMatchSnapshot();
    expect(result.text).not.toContain("WHERE");
  });

  test("should ignore versionTimestamp when withAllVersions is true", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      withAllVersions: true,
      versionTimestamp: new Date("2025-06-15T00:00:00Z"),
    };
    const result = compileAggregate("MIN", "value", state, versionedMetadata);
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });

  test("should not emit version condition when only one version decorator is present", () => {
    const result = compileAggregate(
      "SUM",
      "value",
      createEmptyState(),
      halfVersionedMetadata,
    );
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });

  test("should not emit version condition on non-versioned entity", () => {
    const result = compileAggregate("SUM", "amount", createEmptyState(), metadata);
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });
});

describe("compileAggregate — combined soft-delete + version filtering", () => {
  test("should AND both conditions on versioned + soft-deletable entity", () => {
    const result = compileAggregate(
      "SUM",
      "amount",
      createEmptyState(),
      versionedAndSoftDeleteMetadata,
    );
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("deleted_at");
    expect(result.text).toContain("version_end_date");
    expect(result.text).toContain("IS NULL");
  });

  test("should emit only version condition when withDeleted is true", () => {
    const state: QueryState<any> = { ...createEmptyState(), withDeleted: true };
    const result = compileAggregate(
      "AVG",
      "amount",
      state,
      versionedAndSoftDeleteMetadata,
    );
    expect(result).toMatchSnapshot();
    expect(result.text).not.toContain("deleted_at");
    expect(result.text).toContain("version_end_date");
  });

  test("should emit only soft-delete condition when withAllVersions is true", () => {
    const state: QueryState<any> = { ...createEmptyState(), withAllVersions: true };
    const result = compileAggregate(
      "MAX",
      "amount",
      state,
      versionedAndSoftDeleteMetadata,
    );
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("deleted_at");
    expect(result.text).not.toContain("version_end_date");
  });

  test("should emit no WHERE clause when withDeleted and withAllVersions are both true", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      withDeleted: true,
      withAllVersions: true,
    };
    const result = compileAggregate(
      "SUM",
      "amount",
      state,
      versionedAndSoftDeleteMetadata,
    );
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });

  test("should AND user WHERE with both system conditions", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { amount: { $gte: 0 } }, conjunction: "and" as const }],
    };
    const result = compileAggregate(
      "SUM",
      "amount",
      state,
      versionedAndSoftDeleteMetadata,
    );
    expect(result).toMatchSnapshot();
    expect(result.params).toEqual([0]);
  });

  test("should use correct param indices with predicate + point-in-time versioning", () => {
    const timestamp = new Date("2025-06-15T12:00:00Z");
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { amount: { $gte: 10 } }, conjunction: "and" as const }],
      versionTimestamp: timestamp,
    };
    const result = compileAggregate(
      "SUM",
      "amount",
      state,
      versionedAndSoftDeleteMetadata,
    );
    expect(result).toMatchSnapshot();
    // amount=$1, versionTimestamp=$2 (appears twice in start <= $2 AND end > $2)
    expect(result.params).toEqual([10, timestamp]);
    expect(result.text).toContain("$1");
    expect(result.text).toContain("$2");
  });
});

describe("compileAggregate — namespace/schema qualification", () => {
  test("should qualify table with entity namespace when present", () => {
    const result = compileAggregate("SUM", "amount", createEmptyState(), metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain('"app"');
    expect(result.text).toContain('"orders"');
  });

  test("should not add schema qualifier when namespace is null on entity", () => {
    const result = compileAggregate(
      "SUM",
      "score",
      createEmptyState(),
      noNamespaceMetadata,
    );
    expect(result).toMatchSnapshot();
    expect(result.text).not.toContain('"app"');
    expect(result.text).toContain('"metrics"');
  });

  test("should use explicit namespace argument when entity namespace is null", () => {
    const result = compileAggregate(
      "AVG",
      "score",
      createEmptyState(),
      noNamespaceMetadata,
      "reporting",
    );
    expect(result).toMatchSnapshot();
    expect(result.text).toContain('"reporting"');
    expect(result.text).toContain('"metrics"');
  });

  test("should prefer entity namespace over explicit namespace argument", () => {
    // entity.namespace = "app", explicit namespace = "override" → entity wins
    const result = compileAggregate(
      "MAX",
      "amount",
      createEmptyState(),
      metadata,
      "override",
    );
    expect(result).toMatchSnapshot();
    expect(result.text).toContain('"app"');
    expect(result.text).not.toContain('"override"');
  });

  test("should produce no schema when namespace is explicitly null", () => {
    const result = compileAggregate(
      "MIN",
      "score",
      createEmptyState(),
      noNamespaceMetadata,
      null,
    );
    expect(result).toMatchSnapshot();
    // FROM clause should be unqualified — no schema prefix before the table name
    expect(result.text).toContain('FROM "metrics"');
    expect(result.text).not.toContain('"app"."metrics"');
    expect(result.text).not.toContain('"reporting"."metrics"');
  });
});
