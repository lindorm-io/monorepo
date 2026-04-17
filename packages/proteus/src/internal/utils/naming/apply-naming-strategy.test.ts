import { makeField } from "../../__fixtures__/make-field";
import type {
  EntityMetadata,
  MetaRelation,
  MetaRelationOptions,
} from "../../entity/types/metadata";
import { applyNamingStrategy } from "./apply-naming-strategy";

const defaultOptions: MetaRelationOptions = {
  deferrable: false,
  initiallyDeferred: false,
  loading: { single: "ignore", multiple: "ignore" },
  nullable: false,
  onDestroy: "ignore",
  onInsert: "ignore",
  onOrphan: "ignore",
  onSoftDestroy: "ignore",
  onUpdate: "ignore",
  strategy: null,
};

const baseMetadata = {
  target: class TestEntity {},
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "test_entity",
    namespace: null,
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("firstName", { type: "string" }),
    makeField("lastName", { type: "string" }),
    makeField("customName", { type: "string", name: "custom_col" }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
  hooks: [],
  uniques: [],
  checks: [],
  indexes: [],
  schemas: [],
  extras: [],
} as unknown as EntityMetadata;

describe("applyNamingStrategy", () => {
  test("should return original metadata for 'none' strategy", () => {
    const result = applyNamingStrategy(baseMetadata, "none");
    expect(result).toBe(baseMetadata);
  });

  test("should transform field names to snake_case", () => {
    const result = applyNamingStrategy(baseMetadata, "snake");
    expect(result.fields[0].name).toBe("id");
    expect(result.fields[1].name).toBe("first_name");
    expect(result.fields[2].name).toBe("last_name");
  });

  test("should preserve explicit column names", () => {
    const result = applyNamingStrategy(baseMetadata, "snake");
    expect(result.fields[3].name).toBe("custom_col");
  });

  test("should not mutate original metadata", () => {
    const original = { ...baseMetadata };
    applyNamingStrategy(baseMetadata, "snake");
    expect(baseMetadata.fields[1].name).toBe("firstName");
  });

  test("should transform joinKeys", () => {
    const metaWithRelation = {
      ...baseMetadata,
      relations: [
        {
          key: "author",
          foreignConstructor: () => class {},
          foreignKey: "posts",
          findKeys: { authorId: "id" },
          joinKeys: { authorId: "id" },
          joinTable: null,
          options: defaultOptions,
          orderBy: null,
          type: "ManyToOne",
        } as unknown as MetaRelation,
      ],
    } as unknown as EntityMetadata;

    const result = applyNamingStrategy(metaWithRelation, "snake");
    expect(result.relations[0].joinKeys).toEqual({ author_id: "id" });
  });

  test("should transform findKeys", () => {
    const metaWithRelation = {
      ...baseMetadata,
      relations: [
        {
          key: "posts",
          foreignConstructor: () => class {},
          foreignKey: "author",
          findKeys: { authorId: "id" },
          joinKeys: null,
          joinTable: null,
          options: defaultOptions,
          orderBy: null,
          type: "OneToMany",
        } as unknown as MetaRelation,
      ],
    } as unknown as EntityMetadata;

    const result = applyNamingStrategy(metaWithRelation, "snake");
    expect(result.relations[0].findKeys).toEqual({ author_id: "id" });
  });

  test("should preserve null joinKeys and findKeys", () => {
    const metaWithRelation = {
      ...baseMetadata,
      relations: [
        {
          key: "posts",
          foreignConstructor: () => class {},
          foreignKey: "author",
          findKeys: null,
          joinKeys: null,
          joinTable: null,
          options: defaultOptions,
          orderBy: null,
          type: "OneToMany",
        } as unknown as MetaRelation,
      ],
    } as unknown as EntityMetadata;

    const result = applyNamingStrategy(metaWithRelation, "snake");
    expect(result.relations[0].findKeys).toBeNull();
    expect(result.relations[0].joinKeys).toBeNull();
  });

  test("should transform embeddedList element field names", () => {
    const metaWithEmbeddedList = {
      ...baseMetadata,
      embeddedLists: [
        {
          key: "addresses",
          tableName: "user_addresses",
          parentFkColumn: "userId",
          parentPkColumn: "id",
          elementType: null,
          elementConstructor: () => class {},
          elementFields: [
            makeField("streetName", { type: "string" }),
            makeField("cityName", { type: "string" }),
            // explicit column name must be preserved
            makeField("zipCode", { type: "string", name: "zip_col" }),
          ],
        },
      ],
    } as unknown as EntityMetadata;

    const result = applyNamingStrategy(metaWithEmbeddedList, "snake");
    const el = result.embeddedLists[0];
    expect(el.elementFields![0].name).toBe("street_name");
    expect(el.elementFields![1].name).toBe("city_name");
    // explicit name must survive
    expect(el.elementFields![2].name).toBe("zip_col");
  });

  test("should transform embeddedList parentFkColumn", () => {
    const metaWithEmbeddedList = {
      ...baseMetadata,
      embeddedLists: [
        {
          key: "tags",
          tableName: "user_tags",
          parentFkColumn: "userId",
          parentPkColumn: "id",
          elementType: "string",
          elementFields: null,
          elementConstructor: null,
        },
      ],
    } as unknown as EntityMetadata;

    const result = applyNamingStrategy(metaWithEmbeddedList, "snake");
    expect(result.embeddedLists[0].parentFkColumn).toBe("user_id");
  });

  test("should handle empty embeddedLists array without error", () => {
    const metaWithNoLists = {
      ...baseMetadata,
      embeddedLists: [],
    } as unknown as EntityMetadata;

    const result = applyNamingStrategy(metaWithNoLists, "snake");
    expect(result.embeddedLists).toEqual([]);
  });

  test("should handle missing embeddedLists (undefined) without error", () => {
    // metadata without embeddedLists key at all (older shape)
    const metaWithoutLists = {
      ...baseMetadata,
    } as unknown as EntityMetadata;
    // Ensure no embeddedLists on object — base fixture has none
    const result = applyNamingStrategy(metaWithoutLists, "snake");
    expect(result.embeddedLists).toEqual([]);
  });
});
