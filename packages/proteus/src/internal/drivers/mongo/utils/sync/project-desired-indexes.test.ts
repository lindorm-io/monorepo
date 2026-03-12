import type {
  EntityMetadata,
  MetaField,
  MetaIndex,
  MetaRelation,
  MetaUnique,
} from "#internal/entity/types/metadata";
import { projectDesiredIndexes } from "./project-desired-indexes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeField = (key: string, overrides: Partial<MetaField> = {}): MetaField =>
  ({
    key,
    name: overrides.name ?? key,
    type: overrides.type ?? "string",
    decorator: overrides.decorator ?? "Field",
    ...overrides,
  }) as unknown as MetaField;

const makeIndex = (overrides: Partial<MetaIndex> = {}): MetaIndex => ({
  keys: overrides.keys ?? [{ key: "name", direction: "asc", nulls: null }],
  include: null,
  name: overrides.name ?? null,
  unique: overrides.unique ?? false,
  concurrent: false,
  sparse: overrides.sparse ?? false,
  where: null,
  using: null,
  with: null,
  ...overrides,
});

const makeUnique = (keys: Array<string>, name?: string): MetaUnique => ({
  keys,
  name: name ?? null,
});

const makeMetadata = (overrides: Partial<EntityMetadata> = {}): EntityMetadata =>
  ({
    target: class TestEntity {},
    entity: { name: overrides.entity?.name ?? "TestEntity", namespace: null },
    fields: overrides.fields ?? [makeField("id"), makeField("name")],
    primaryKeys: overrides.primaryKeys ?? ["id"],
    indexes: overrides.indexes ?? [],
    uniques: overrides.uniques ?? [],
    relations: overrides.relations ?? [],
    inheritance: overrides.inheritance ?? null,
    ...overrides,
  }) as unknown as EntityMetadata;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("projectDesiredIndexes", () => {
  test("should return empty array for entity with no indexes", () => {
    const metadata = makeMetadata();
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project @Index decorator index", () => {
    const metadata = makeMetadata({
      indexes: [makeIndex()],
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project named index", () => {
    const metadata = makeMetadata({
      indexes: [makeIndex({ name: "my_idx" })],
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project descending index", () => {
    const metadata = makeMetadata({
      indexes: [
        makeIndex({
          keys: [{ key: "createdAt", direction: "desc", nulls: null }],
        }),
      ],
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project compound index", () => {
    const metadata = makeMetadata({
      indexes: [
        makeIndex({
          keys: [
            { key: "tenantId", direction: "asc", nulls: null },
            { key: "name", direction: "asc", nulls: null },
          ],
        }),
      ],
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project sparse index", () => {
    const metadata = makeMetadata({
      indexes: [makeIndex({ sparse: true })],
    });
    const result = projectDesiredIndexes([metadata], null);
    expect(result[0].sparse).toBe(true);
    expect(result).toMatchSnapshot();
  });

  test("should project unique index", () => {
    const metadata = makeMetadata({
      indexes: [makeIndex({ unique: true })],
    });
    const result = projectDesiredIndexes([metadata], null);
    expect(result[0].unique).toBe(true);
    expect(result).toMatchSnapshot();
  });

  test("should project @Unique decorator as unique index", () => {
    const metadata = makeMetadata({
      uniques: [makeUnique(["email"])],
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project compound @Unique", () => {
    const metadata = makeMetadata({
      uniques: [makeUnique(["tenantId", "email"])],
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project named @Unique", () => {
    const metadata = makeMetadata({
      uniques: [makeUnique(["email"], "email_uniq")],
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project FK index from owning relation", () => {
    const metadata = makeMetadata({
      relations: [
        {
          key: "profile",
          type: "ManyToOne",
          joinKeys: { profileId: "id" },
          foreignKey: "user",
          foreignConstructor: () => class {} as any,
        } as unknown as MetaRelation,
      ],
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should skip ManyToMany relations for FK indexes", () => {
    const metadata = makeMetadata({
      relations: [
        {
          key: "tags",
          type: "ManyToMany",
          joinKeys: { userId: "id" },
          joinTable: "user_tags",
          foreignKey: "users",
          foreignConstructor: () => class {} as any,
        } as unknown as MetaRelation,
      ],
    });
    // ManyToMany should still produce a join collection index
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should project TTL index from @ExpiryDate field", () => {
    const metadata = makeMetadata({
      fields: [
        makeField("id"),
        makeField("name"),
        makeField("expiresAt", { decorator: "ExpiryDate", type: "timestamp" }),
      ],
    });
    const result = projectDesiredIndexes([metadata], null);
    expect(result.find((r) => r.expireAfterSeconds === 0)).toBeDefined();
    expect(result).toMatchSnapshot();
  });

  test("should project discriminator index for single-table parent", () => {
    const metadata = makeMetadata({
      inheritance: {
        strategy: "single-table",
        discriminatorField: "__type",
        discriminatorValue: null,
        root: class {} as any,
        parent: null,
        children: new Map([["child", class {} as any]]),
      },
    });
    expect(projectDesiredIndexes([metadata], null)).toMatchSnapshot();
  });

  test("should skip inheritance children (no duplicate indexes)", () => {
    const ChildClass = class Child {};
    const parentMeta = makeMetadata({
      entity: { name: "Parent", namespace: null } as any,
      inheritance: {
        strategy: "single-table",
        discriminatorField: "__type",
        discriminatorValue: null,
        root: class {} as any,
        parent: null,
        children: new Map([["child", ChildClass as any]]),
      },
      indexes: [makeIndex()],
    });
    const childMeta = makeMetadata({
      entity: { name: "Parent", namespace: null } as any,
      target: ChildClass as any,
      inheritance: {
        strategy: "single-table",
        discriminatorField: "__type",
        discriminatorValue: "child",
        root: class {} as any,
        parent: class {} as any,
        children: new Map(),
      },
    });

    expect(projectDesiredIndexes([parentMeta, childMeta], null)).toMatchSnapshot();
  });

  test("should prefix collection name with namespace", () => {
    const metadata = makeMetadata({
      entity: { name: "User", namespace: null } as any,
      indexes: [makeIndex()],
    });
    expect(projectDesiredIndexes([metadata], "myapp")).toMatchSnapshot();
  });

  test("should map single PK field to _id in index keys", () => {
    const metadata = makeMetadata({
      indexes: [
        makeIndex({
          keys: [{ key: "id", direction: "asc", nulls: null }],
        }),
      ],
    });
    const result = projectDesiredIndexes([metadata], null);
    expect(result[0].keys).toMatchSnapshot();
  });
});
