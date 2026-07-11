import { describe, expect, test } from "vitest";
import { makeField } from "../../__fixtures__/make-field.js";
import type {
  EntityMetadata,
  MetaRelation,
  MetaRelationOptions,
} from "../../entity/types/metadata.js";
import { Entity } from "../../../decorators/Entity.js";
import { Generated } from "../../../decorators/Generated.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { getEntityMetadata } from "../../entity/metadata/get-entity-metadata.js";
import { applyNamingStrategy } from "./apply-naming-strategy.js";

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
    // A bare `@Entity()` stages the class name verbatim with `named: false`, so
    // the strategy must transform it (PascalCase class → snake/camel table).
    name: "RefreshTokenChain",
    named: false,
    namespace: null,
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("firstName", { type: "string" }),
    makeField("lastName", { type: "string" }),
    makeField("customName", { type: "string", name: "custom_col", named: true }),
    // Explicit column name that happens to EQUAL the property key. Must survive a
    // snake/camel strategy verbatim — the `named` flag proves intent, not name !== key.
    makeField("createdAt", { type: "timestamp", name: "createdAt", named: true }),
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

  test("should transform a bare entity name to snake_case", () => {
    const result = applyNamingStrategy(baseMetadata, "snake");
    expect(result.entity.name).toBe("refresh_token_chain");
  });

  test("should transform a bare entity name to camelCase", () => {
    const result = applyNamingStrategy(baseMetadata, "camel");
    expect(result.entity.name).toBe("refreshTokenChain");
  });

  test("should keep a bare entity name verbatim under 'none'", () => {
    const result = applyNamingStrategy(baseMetadata, "none");
    expect(result.entity.name).toBe("RefreshTokenChain");
  });

  test("should preserve an explicitly-named entity verbatim under snake and camel", () => {
    const named = {
      ...baseMetadata,
      entity: { ...baseMetadata.entity, name: "CustomTable", named: true },
    } as unknown as EntityMetadata;
    expect(applyNamingStrategy(named, "snake").entity.name).toBe("CustomTable");
    expect(applyNamingStrategy(named, "camel").entity.name).toBe("CustomTable");
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

  test("should preserve an explicit name equal to the property key under snake", () => {
    const result = applyNamingStrategy(baseMetadata, "snake");
    // Without the `named` flag this would be transformed to "created_at".
    expect(result.fields[4].name).toBe("createdAt");
  });

  test("should preserve an explicit name equal to the property key under camel", () => {
    // A field with no explicit name is still camelised; the explicitly-named one is not.
    const result = applyNamingStrategy(baseMetadata, "camel");
    expect(result.fields[4].name).toBe("createdAt");
  });

  test("should transform field names to camelCase when name is not explicit", () => {
    const result = applyNamingStrategy(baseMetadata, "camel");
    expect(result.fields[1].name).toBe("firstName");
    expect(result.fields[3].name).toBe("custom_col"); // explicit — untouched
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
            makeField("zipCode", { type: "string", name: "zip_col", named: true }),
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

// ─── Flattened @Embedded fields follow the naming strategy ───────────────────
//
// A flattened @Embedded child has a DOTTED key (`homeAddress.street`) but a
// composite name (`homeAddress_street`). Under a strategy the COMPOSITE is
// transformed — not the dotted key (which would mangle) and not verbatim
// (which is only for explicitly-named children).

const embeddedConstructor = () => class {};

const embeddedMetadata = (namedChild = false) =>
  ({
    ...baseMetadata,
    fields: [
      makeField("id", { type: "uuid" }),
      // default @Embedded(() => Address) on property `homeAddress`, child `street`
      makeField("homeAddress.street", {
        type: "string",
        name: "homeAddress_street",
        embedded: { parentKey: "homeAddress", constructor: embeddedConstructor },
      }),
      // explicit @Embedded(() => Address, { prefix: "work_" }) on `workAddress`,
      // child `streetName` → composite `work_streetName`
      makeField("workAddress.streetName", {
        type: "string",
        name: "work_streetName",
        embedded: { parentKey: "workAddress", constructor: embeddedConstructor },
      }),
      // child declared with an explicit @Field({ name: "postcode" }) → named: true,
      // composite is `homeAddress_postcode` and must survive verbatim
      makeField("homeAddress.zip", {
        type: "string",
        name: namedChild ? "homeAddress_postcode" : "homeAddress_zip",
        named: namedChild,
        embedded: { parentKey: "homeAddress", constructor: embeddedConstructor },
      }),
    ],
  }) as unknown as EntityMetadata;

describe("applyNamingStrategy — flattened @Embedded fields", () => {
  test("should keep composite verbatim under 'none'", () => {
    const result = applyNamingStrategy(embeddedMetadata(), "none");
    // 'none' short-circuits and returns the original metadata untouched
    expect(result.fields[1].name).toBe("homeAddress_street");
    expect(result.fields[2].name).toBe("work_streetName");
  });

  test("should transform the composite under 'snake'", () => {
    const result = applyNamingStrategy(embeddedMetadata(), "snake");
    expect(result.fields[1].name).toBe("home_address_street");
    // explicit prefix feeds into the composite and is transformed too
    expect(result.fields[2].name).toBe("work_street_name");
  });

  test("should transform the composite under 'camel'", () => {
    const result = applyNamingStrategy(embeddedMetadata(), "camel");
    expect(result.fields[1].name).toBe("homeAddressStreet");
    expect(result.fields[2].name).toBe("workStreetName");
  });

  test("should preserve an explicitly-named embedded child under 'snake'", () => {
    const result = applyNamingStrategy(embeddedMetadata(true), "snake");
    // named child: verbatim, not transformed to home_address_postcode
    expect(result.fields[3].name).toBe("homeAddress_postcode");
  });

  test("should preserve an explicitly-named embedded child under 'camel'", () => {
    const result = applyNamingStrategy(embeddedMetadata(true), "camel");
    expect(result.fields[3].name).toBe("homeAddress_postcode");
  });

  test("should transform a default embedded child under 'snake' (not named)", () => {
    const result = applyNamingStrategy(embeddedMetadata(false), "snake");
    // default child (named: false) follows the strategy
    expect(result.fields[3].name).toBe("home_address_zip");
  });
});

// ─── Resolved entity (table) name via real @Entity decorators ─────────────────
//
// End-to-end through the real decorator → metadata → applyNamingStrategy chain:
// a bare @Entity() stages the class name with `named: false` and follows the
// strategy; @Entity({ name }) stages `named: true` and stays verbatim under every
// strategy — exactly mirroring @Field({ name }).

@Entity()
class NamingBareTokenChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

@Entity({ name: "custom_token_chain" })
class NamingSnakeOverrideChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

@Entity({ name: "MixedCaseOverride" })
class NamingMixedOverrideChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

const resolvedEntityName = (target: Function, strategy: "snake" | "camel" | "none") =>
  applyNamingStrategy(getEntityMetadata(target), strategy).entity.name;

describe("applyNamingStrategy — resolved entity table name (real @Entity)", () => {
  test("should snake_case a bare @Entity() class name", () => {
    expect(resolvedEntityName(NamingBareTokenChain, "snake")).toBe(
      "naming_bare_token_chain",
    );
  });

  test("should camelCase a bare @Entity() class name", () => {
    expect(resolvedEntityName(NamingBareTokenChain, "camel")).toBe(
      "namingBareTokenChain",
    );
  });

  test("should keep a bare @Entity() class name verbatim under 'none'", () => {
    expect(resolvedEntityName(NamingBareTokenChain, "none")).toBe("NamingBareTokenChain");
  });

  test("should keep an @Entity({ name }) override verbatim under snake", () => {
    expect(resolvedEntityName(NamingSnakeOverrideChain, "snake")).toBe(
      "custom_token_chain",
    );
  });

  test("should keep an @Entity({ name }) override verbatim under camel", () => {
    expect(resolvedEntityName(NamingSnakeOverrideChain, "camel")).toBe(
      "custom_token_chain",
    );
  });

  test("should keep an @Entity({ name }) override verbatim under 'none'", () => {
    expect(resolvedEntityName(NamingSnakeOverrideChain, "none")).toBe(
      "custom_token_chain",
    );
  });

  test("should NOT transform a mixed-case @Entity({ name }) override under snake", () => {
    expect(resolvedEntityName(NamingMixedOverrideChain, "snake")).toBe(
      "MixedCaseOverride",
    );
  });

  test("should NOT transform a mixed-case @Entity({ name }) override under camel", () => {
    expect(resolvedEntityName(NamingMixedOverrideChain, "camel")).toBe(
      "MixedCaseOverride",
    );
  });
});
