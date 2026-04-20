import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata";
import { findOptionsToQueryState } from "./find-options-to-query-state";
import { describe, expect, test } from "vitest";

const metadataWithDefaultOrder = {
  defaultOrder: { createdAt: "DESC" },
  relations: [],
} as unknown as EntityMetadata;

const metadataWithoutDefaultOrder = {
  defaultOrder: null,
  relations: [],
} as unknown as EntityMetadata;

describe("findOptionsToQueryState", () => {
  test("should convert empty criteria and options", () => {
    const result = findOptionsToQueryState({}, {});
    expect(result).toMatchSnapshot();
  });

  test("should add criteria as predicate", () => {
    const result = findOptionsToQueryState({ name: "Alice" }, {});
    expect(result).toMatchSnapshot();
  });

  test("should map limit and offset", () => {
    const result = findOptionsToQueryState({}, { limit: 10, offset: 20 });
    expect(result).toMatchSnapshot();
  });

  test("should map order", () => {
    const result = findOptionsToQueryState(
      {},
      { order: { name: "ASC", age: "DESC" } as any },
    );
    expect(result.orderBy).toEqual({ name: "ASC", age: "DESC" });
  });

  test("should map select", () => {
    const result = findOptionsToQueryState({}, { select: ["id", "name"] as any });
    expect(result.selections).toEqual(["id", "name"]);
  });

  test("should map withDeleted", () => {
    const result = findOptionsToQueryState({}, { withDeleted: true });
    expect(result.withDeleted).toBe(true);
  });

  test("should map distinct", () => {
    const result = findOptionsToQueryState({}, { distinct: true });
    expect(result.distinct).toBe(true);
  });

  test("should map lock", () => {
    const result = findOptionsToQueryState({}, { lock: "pessimistic_write" });
    expect(result.lock).toBe("pessimistic_write");
  });

  test("should map relations to include specs", () => {
    const result = findOptionsToQueryState({}, { relations: ["author", "tags"] as any });
    expect(result.includes).toMatchSnapshot();
  });

  test("should default includes to empty array when no relations", () => {
    const result = findOptionsToQueryState({}, {});
    expect(result.includes).toEqual([]);
  });

  test("should not add predicate for empty criteria", () => {
    const result = findOptionsToQueryState({}, {});
    expect(result.predicates).toEqual([]);
  });

  test("should map versionTimestamp", () => {
    const timestamp = new Date("2025-06-15T12:00:00Z");
    const result = findOptionsToQueryState({}, { versionTimestamp: timestamp });
    expect(result.versionTimestamp).toBe(timestamp);
  });

  test("should default versionTimestamp to null", () => {
    const result = findOptionsToQueryState({}, {});
    expect(result.versionTimestamp).toBeNull();
  });

  test("should always set withAllVersions to false", () => {
    const result = findOptionsToQueryState({}, {});
    expect(result.withAllVersions).toBe(false);
  });

  test("should set withAllVersions to false even when versionTimestamp is set", () => {
    const result = findOptionsToQueryState({}, { versionTimestamp: new Date() });
    expect(result.withAllVersions).toBe(false);
  });
});

describe("findOptionsToQueryState — withAllVersions", () => {
  test("should map withAllVersions: true from FindOptions", () => {
    const result = findOptionsToQueryState({}, { withAllVersions: true });
    expect(result.withAllVersions).toBe(true);
  });

  test("should default withAllVersions to false", () => {
    const result = findOptionsToQueryState({}, {});
    expect(result.withAllVersions).toBe(false);
  });
});

describe("findOptionsToQueryState — defaultOrder", () => {
  test("should apply metadata defaultOrder when no explicit order is provided", () => {
    const result = findOptionsToQueryState({}, {}, metadataWithDefaultOrder);
    expect(result.orderBy).toEqual({ createdAt: "DESC" });
  });

  test("should use null orderBy when metadata has no defaultOrder and no explicit order", () => {
    const result = findOptionsToQueryState({}, {}, metadataWithoutDefaultOrder);
    expect(result.orderBy).toBeNull();
  });

  test("should prefer explicit order over metadata defaultOrder", () => {
    const result = findOptionsToQueryState(
      {},
      { order: { name: "ASC" } as any },
      metadataWithDefaultOrder,
    );
    expect(result.orderBy).toEqual({ name: "ASC" });
  });

  test("should use null orderBy when no metadata is provided and no explicit order", () => {
    const result = findOptionsToQueryState({}, {});
    expect(result.orderBy).toBeNull();
  });
});

describe("findOptionsToQueryState — order: null suppression", () => {
  test("should use {} sentinel when order: null is explicitly passed with metadata defaultOrder", () => {
    // order: null means user wants to suppress defaultOrder
    // {} is used as sentinel so downstream ?? fallback doesn't re-apply defaultOrder
    const result = findOptionsToQueryState(
      {},
      { order: null } as any,
      metadataWithDefaultOrder,
    );
    expect(result.orderBy).toEqual({});
  });

  test("should use {} sentinel when order: null is explicitly passed without metadata", () => {
    const result = findOptionsToQueryState({}, { order: null } as any);
    expect(result.orderBy).toEqual({});
  });

  test("should use {} sentinel (not null) so it differs from no-order case", () => {
    const noOrder = findOptionsToQueryState({}, {}, metadataWithDefaultOrder);
    const suppressed = findOptionsToQueryState(
      {},
      { order: null } as any,
      metadataWithDefaultOrder,
    );
    // No order -> gets defaultOrder applied
    expect(noOrder.orderBy).toEqual({ createdAt: "DESC" });
    // Suppressed -> gets empty sentinel, NOT defaultOrder
    expect(suppressed.orderBy).toEqual({});
    expect(suppressed.orderBy).not.toEqual({ createdAt: "DESC" });
  });
});

const makeEagerRelation = (
  key: string,
  overrides: Partial<MetaRelation["options"]["loading"]> = {},
): MetaRelation =>
  ({
    key,
    type: "ManyToOne",
    foreignConstructor: () => Object,
    foreignKey: "id",
    findKeys: { [key + "Id"]: "id" },
    joinKeys: null,
    joinTable: null,
    options: {
      loading: {
        single: "lazy",
        multiple: "lazy",
        ...overrides,
      },
      strategy: null,
      cascade: false,
      orphanDeletion: false,
      onDelete: null,
      orderBy: null,
      deferrable: null,
    },
  }) as unknown as MetaRelation;

describe("findOptionsToQueryState — eager auto-include", () => {
  const metadataWithEagerRelation = {
    defaultOrder: null,
    filters: [],
    relations: [
      makeEagerRelation("author", { multiple: "eager" }),
      makeEagerRelation("profile", { multiple: "lazy" }),
    ],
  } as unknown as EntityMetadata;

  test("should auto-include eager relations when not explicitly passed in relations", () => {
    const result = findOptionsToQueryState({}, {}, metadataWithEagerRelation);
    expect(result.includes.map((i) => i.relation)).toContain("author");
    expect(result.includes.map((i) => i.relation)).not.toContain("profile");
  });

  test("should not duplicate eager relation when it is also in explicit relations option", () => {
    const result = findOptionsToQueryState(
      {},
      { relations: ["author"] as any },
      metadataWithEagerRelation,
    );
    const authorIncludes = result.includes.filter((i) => i.relation === "author");
    expect(authorIncludes).toHaveLength(1);
  });

  test("should auto-include relation with single=eager when operationScope is 'single'", () => {
    const metadataWithSingleEager = {
      defaultOrder: null,
      filters: [],
      relations: [makeEagerRelation("author", { single: "eager", multiple: "lazy" })],
    } as unknown as EntityMetadata;

    const result = findOptionsToQueryState({}, {}, metadataWithSingleEager, "single");
    expect(result.includes.map((i) => i.relation)).toContain("author");
  });

  test("should not auto-include relation with single=eager when operationScope is 'multiple'", () => {
    const metadataWithSingleEager = {
      defaultOrder: null,
      filters: [],
      relations: [makeEagerRelation("author", { single: "eager", multiple: "lazy" })],
    } as unknown as EntityMetadata;

    const result = findOptionsToQueryState({}, {}, metadataWithSingleEager, "multiple");
    expect(result.includes.map((i) => i.relation)).not.toContain("author");
  });
});
