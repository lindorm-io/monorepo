import type { EntityMetadata } from "#internal/entity/types/metadata";
import { buildSimpleIn } from "./build-simple-in";

// --- helpers ---

const makeField = (key: string, name: string) => ({
  key,
  name,
  decorator: "Field" as const,
  arrayType: null,
  collation: null,
  comment: null,
  computed: null,
  embedded: null,
  encrypted: null,
  enum: null,
  default: null,
  hideOn: [],
  max: null,
  min: null,
  nullable: false,
  order: null,
  precision: null,
  readonly: false,
  scale: null,
  schema: null,
  transform: null,
  type: "string" as const,
});

const makeMetadata = (fieldMappings: Record<string, string>): EntityMetadata =>
  ({
    fields: Object.entries(fieldMappings).map(([key, name]) => makeField(key, name)),
    entity: { decorator: "Entity", comment: null, name: "test_entity", namespace: null },
    primaryKeys: ["id"],
    relations: [],
    relationIds: [],
    relationCounts: [],
    indexes: [],
    uniques: [],
    checks: [],
    scopeKeys: [],
    versionKeys: [],
    generated: [],
    hooks: [],
    extras: [],
    filters: [],
    schemas: [],
    embeddedLists: [],
    cache: null,
    defaultOrder: null,
  }) as unknown as EntityMetadata;

// --- single-key cases ---

describe("buildSimpleIn — single field key", () => {
  it("should produce a simple IN clause with one value", () => {
    const params: Array<unknown> = [];
    const result = buildSimpleIn(null, ["id"], [["uuid-1"]], params);
    expect(result).toMatchSnapshot();
    expect(params).toMatchSnapshot();
  });

  it("should produce a simple IN clause with multiple values", () => {
    const params: Array<unknown> = [];
    const result = buildSimpleIn(
      null,
      ["id"],
      [["uuid-1"], ["uuid-2"], ["uuid-3"]],
      params,
    );
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["uuid-1", "uuid-2", "uuid-3"]);
  });

  it("should accumulate params starting after existing entries", () => {
    const params: Array<unknown> = ["pre-existing"];
    const result = buildSimpleIn(null, ["id"], [["uuid-1"]], params);
    // pre-existing param occupies $1, so the IN clause should use $2
    expect(result).toContain("$2");
    expect(params).toEqual(["pre-existing", "uuid-1"]);
  });

  it("should resolve column name from metadata when metadata is provided", () => {
    const metadata = makeMetadata({ userId: "user_id" });
    const params: Array<unknown> = [];
    const result = buildSimpleIn(metadata, ["userId"], [["uuid-1"]], params);
    expect(result).toContain('"user_id"');
    expect(result).toMatchSnapshot();
  });

  it("should use field key directly when metadata is null", () => {
    const params: Array<unknown> = [];
    const result = buildSimpleIn(null, ["raw_col"], [["value-1"]], params);
    expect(result).toContain('"raw_col"');
  });

  it("should fall back to the key itself when field is not found in metadata", () => {
    const metadata = makeMetadata({ otherField: "other_col" });
    const params: Array<unknown> = [];
    const result = buildSimpleIn(metadata, ["unknownKey"], [["val"]], params);
    // resolveColumnNameSafe falls back to the key
    expect(result).toContain('"unknownKey"');
  });

  it("should throw on empty values array", () => {
    const params: Array<unknown> = [];
    expect(() => buildSimpleIn(null, ["id"], [], params)).toThrow(
      "buildSimpleIn: values array must not be empty",
    );
  });

  it("should produce correct parameter placeholders for many values", () => {
    const params: Array<unknown> = [];
    const values = Array.from({ length: 5 }, (_, i) => [`val-${i}`]);
    const result = buildSimpleIn(null, ["id"], values, params);
    expect(result).toMatchSnapshot();
    expect(params).toHaveLength(5);
  });
});

// --- composite-key (ROW) cases ---

describe("buildSimpleIn — composite field keys", () => {
  it("should produce a ROW IN clause for two keys", () => {
    const params: Array<unknown> = [];
    const result = buildSimpleIn(
      null,
      ["tenant_id", "user_id"],
      [
        ["t1", "u1"],
        ["t1", "u2"],
      ],
      params,
    );
    expect(result).toMatchSnapshot();
    expect(params).toMatchSnapshot();
  });

  it("should start ROW IN clause with ROW(…)", () => {
    const params: Array<unknown> = [];
    const result = buildSimpleIn(null, ["a", "b"], [["x", "y"]], params);
    expect(result).toMatch(/^ROW\(/);
  });

  it("should list all column names in ROW()", () => {
    const params: Array<unknown> = [];
    const result = buildSimpleIn(
      null,
      ["col_a", "col_b", "col_c"],
      [["1", "2", "3"]],
      params,
    );
    expect(result).toContain('"col_a"');
    expect(result).toContain('"col_b"');
    expect(result).toContain('"col_c"');
  });

  it("should resolve composite column names from metadata", () => {
    const metadata = makeMetadata({ tenantId: "tenant_id", orgId: "org_id" });
    const params: Array<unknown> = [];
    const result = buildSimpleIn(metadata, ["tenantId", "orgId"], [["t1", "o1"]], params);
    expect(result).toContain('"tenant_id"');
    expect(result).toContain('"org_id"');
    expect(result).toMatchSnapshot();
  });

  it("should accumulate params correctly across multiple tuples", () => {
    const params: Array<unknown> = [];
    buildSimpleIn(
      null,
      ["a", "b"],
      [
        ["a1", "b1"],
        ["a2", "b2"],
        ["a3", "b3"],
      ],
      params,
    );
    expect(params).toEqual(["a1", "b1", "a2", "b2", "a3", "b3"]);
  });

  it("should offset placeholders when params array is pre-populated", () => {
    const params: Array<unknown> = ["existing-1", "existing-2"];
    const result = buildSimpleIn(null, ["x", "y"], [["xv", "yv"]], params);
    // $3 and $4 because params already has 2 entries
    expect(result).toContain("$3");
    expect(result).toContain("$4");
    expect(params).toEqual(["existing-1", "existing-2", "xv", "yv"]);
  });
});
