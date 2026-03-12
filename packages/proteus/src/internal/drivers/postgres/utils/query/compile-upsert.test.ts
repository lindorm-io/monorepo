import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata";
import { compileUpsert } from "./compile-upsert";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "orders",
    namespace: "shop",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("status", { type: "string" }),
    makeField("total", { type: "decimal" }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

const baseEntity = {
  id: "order-uuid-1",
  status: "pending",
  total: 99.99,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("compileUpsert", () => {
  describe("basic upsert structure", () => {
    test("should compile a basic upsert with single PK", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result).toMatchSnapshot();
    });

    test("should produce INSERT INTO ... VALUES ... ON CONFLICT ... DO UPDATE SET ... RETURNING *", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.text).toMatchSnapshot();
    });

    test("should include RETURNING *", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.text).toContain("RETURNING *");
    });

    test("should include ON CONFLICT clause", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.text).toContain("ON CONFLICT");
    });

    test("should include DO UPDATE SET clause", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.text).toContain("DO UPDATE SET");
    });

    test("should include entity field values as params", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.params).toContain("order-uuid-1");
      expect(result.params).toContain("pending");
      expect(result.params).toContain(99.99);
    });
  });

  describe("schema qualification", () => {
    test("should use entity namespace as schema", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.text).toContain('"shop"."orders"');
    });

    test("should use fallback namespace argument when entity has no namespace", () => {
      const meta = {
        ...baseMetadata,
        entity: { ...baseMetadata.entity, namespace: null },
      } as unknown as EntityMetadata;

      const result = compileUpsert(baseEntity, meta, "public");
      expect(result.text).toContain('"public"."orders"');
    });

    test("should use unqualified table name when both namespace and fallback are absent", () => {
      const meta = {
        ...baseMetadata,
        entity: { ...baseMetadata.entity, namespace: null },
      } as unknown as EntityMetadata;

      const result = compileUpsert(baseEntity, meta);
      expect(result.text).toContain('"orders"');
      expect(result.text).not.toContain('"shop"');
    });

    test("should prefer entity namespace over fallback namespace argument", () => {
      const result = compileUpsert(baseEntity, baseMetadata, "override_ns");
      expect(result.text).toContain('"shop"."orders"');
      expect(result.text).not.toContain('"override_ns"');
    });
  });

  describe("conflict target (ON CONFLICT columns)", () => {
    test("should use PK column in conflict target", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.text).toContain('ON CONFLICT ("id")');
    });

    test("should use composite primary key in conflict target", () => {
      const meta = {
        ...baseMetadata,
        entity: { ...baseMetadata.entity, name: "order_items", namespace: null },
        fields: [
          makeField("orderId", { type: "uuid", name: "order_id" }),
          makeField("productId", { type: "uuid", name: "product_id" }),
          makeField("quantity", { type: "integer" }),
        ],
        primaryKeys: ["orderId", "productId"],
      } as unknown as EntityMetadata;

      const entity = { orderId: "o1", productId: "p1", quantity: 3 };
      const result = compileUpsert(entity, meta);
      expect(result).toMatchSnapshot();
    });

    test("should list all composite PK columns in conflict target", () => {
      const meta = {
        ...baseMetadata,
        entity: { ...baseMetadata.entity, name: "order_items", namespace: null },
        fields: [
          makeField("orderId", { type: "uuid", name: "order_id" }),
          makeField("productId", { type: "uuid", name: "product_id" }),
          makeField("quantity", { type: "integer" }),
        ],
        primaryKeys: ["orderId", "productId"],
      } as unknown as EntityMetadata;

      const entity = { orderId: "o1", productId: "p1", quantity: 3 };
      const result = compileUpsert(entity, meta);
      expect(result.text).toContain('"order_id"');
      expect(result.text).toContain('"product_id"');
    });
  });

  describe("SET clause exclusions", () => {
    test("should exclude PK column from SET clause", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      // Extract the DO UPDATE SET ... RETURNING portion
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).not.toContain('"id"');
    });

    test("should exclude CreateDate column from SET clause", () => {
      const meta = {
        ...baseMetadata,
        fields: [
          ...baseMetadata.fields,
          makeField("createdAt", {
            type: "timestamp",
            decorator: "CreateDate",
            name: "created_at",
          }),
        ],
      } as unknown as EntityMetadata;

      const entity = { ...baseEntity, createdAt: new Date("2024-01-01") };
      const result = compileUpsert(entity, meta);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).not.toContain('"created_at"');
    });

    test("should exclude generated increment column from SET clause", () => {
      const meta = {
        ...baseMetadata,
        entity: { ...baseMetadata.entity, name: "products", namespace: null },
        fields: [
          makeField("sku", { type: "string" }),
          makeField("seqNum", { type: "integer", name: "seq_num" }),
          makeField("title", { type: "string" }),
        ],
        primaryKeys: ["sku"],
        generated: [
          { key: "seqNum", strategy: "increment", length: null, max: null, min: null },
        ],
      } as unknown as EntityMetadata;

      const entity = { sku: "SKU-001", title: "Widget" };
      const result = compileUpsert(entity, meta);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).not.toContain('"seq_num"');
    });

    test("should include non-PK, non-CreateDate, non-generated fields in SET clause using EXCLUDED", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).toContain('"status" = EXCLUDED."status"');
      expect(doUpdatePart).toContain('"total" = EXCLUDED."total"');
    });
  });

  describe("Version field in SET clause", () => {
    const versionMetadata = {
      ...baseMetadata,
      fields: [
        ...baseMetadata.fields,
        makeField("version", { type: "integer", decorator: "Version" }),
      ],
    } as unknown as EntityMetadata;

    const versionedEntity = { ...baseEntity, version: 2 };

    test("should compile upsert with version field", () => {
      const result = compileUpsert(versionedEntity, versionMetadata);
      expect(result).toMatchSnapshot();
    });

    test("should use table.version + 1 expression for version field in SET clause", () => {
      const result = compileUpsert(versionedEntity, versionMetadata);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).toContain('"version" = "shop"."orders"."version" + 1');
    });

    test("should not use EXCLUDED pseudo-table for version field", () => {
      const result = compileUpsert(versionedEntity, versionMetadata);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).not.toMatch(/EXCLUDED\."version"/);
    });

    test("should still include version value as a param in INSERT columns", () => {
      const result = compileUpsert(versionedEntity, versionMetadata);
      expect(result.params).toContain(2);
    });
  });

  describe("UpdateDate field in SET clause", () => {
    const updateDateMetadata = {
      ...baseMetadata,
      fields: [
        ...baseMetadata.fields,
        makeField("updatedAt", {
          type: "timestamp",
          decorator: "UpdateDate",
          name: "updated_at",
        }),
      ],
    } as unknown as EntityMetadata;

    const entityWithDate = { ...baseEntity, updatedAt: new Date("2024-06-01") };

    test("should compile upsert with UpdateDate field", () => {
      const result = compileUpsert(entityWithDate, updateDateMetadata);
      expect(result).toMatchSnapshot();
    });

    test("should use NOW() expression for UpdateDate field in SET clause", () => {
      const result = compileUpsert(entityWithDate, updateDateMetadata);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).toContain('"updated_at" = NOW()');
    });

    test("should not use EXCLUDED pseudo-table for UpdateDate field", () => {
      const result = compileUpsert(entityWithDate, updateDateMetadata);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).not.toMatch(/EXCLUDED\."updated_at"/);
    });
  });

  describe("all special fields combined", () => {
    test("should compile upsert with Version, CreateDate, and UpdateDate fields", () => {
      const meta = {
        ...baseMetadata,
        fields: [
          makeField("id", { type: "uuid" }),
          makeField("status", { type: "string" }),
          makeField("version", { type: "integer", decorator: "Version" }),
          makeField("createdAt", {
            type: "timestamp",
            decorator: "CreateDate",
            name: "created_at",
          }),
          makeField("updatedAt", {
            type: "timestamp",
            decorator: "UpdateDate",
            name: "updated_at",
          }),
        ],
      } as unknown as EntityMetadata;

      const entity = {
        id: "order-uuid-2",
        status: "shipped",
        version: 3,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-06-01"),
      };

      const result = compileUpsert(entity, meta);
      expect(result).toMatchSnapshot();
    });

    test("should apply all three rules simultaneously in SET clause", () => {
      const meta = {
        ...baseMetadata,
        fields: [
          makeField("id", { type: "uuid" }),
          makeField("status", { type: "string" }),
          makeField("version", { type: "integer", decorator: "Version" }),
          makeField("createdAt", {
            type: "timestamp",
            decorator: "CreateDate",
            name: "created_at",
          }),
          makeField("updatedAt", {
            type: "timestamp",
            decorator: "UpdateDate",
            name: "updated_at",
          }),
        ],
      } as unknown as EntityMetadata;

      const entity = {
        id: "order-uuid-2",
        status: "shipped",
        version: 3,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-06-01"),
      };

      const result = compileUpsert(entity, meta);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];

      // PK excluded
      expect(doUpdatePart).not.toContain('"id"');
      // CreateDate excluded
      expect(doUpdatePart).not.toContain('"created_at"');
      // Version uses increment expression
      expect(doUpdatePart).toContain('"version" = "shop"."orders"."version" + 1');
      // UpdateDate uses NOW()
      expect(doUpdatePart).toContain('"updated_at" = NOW()');
      // Regular mutable field uses EXCLUDED
      expect(doUpdatePart).toContain('"status" = EXCLUDED."status"');
    });
  });

  describe("relation FK columns", () => {
    test("should include owning-side FK columns from dehydrateEntity in INSERT and SET clause", () => {
      const manyToOneRelation: MetaRelation = {
        key: "customer",
        type: "ManyToOne",
        foreignKey: "orders",
        findKeys: { id: "customerId" },
        joinKeys: { customerId: "id" },
        joinTable: null,
        foreignConstructor: () => Object as any,
        options: {
          deferrable: false,
          initiallyDeferred: false,
          loading: { single: "eager", multiple: "eager" },
          nullable: true,
          onDestroy: "ignore",
          onInsert: "cascade",
          onOrphan: "ignore",
          onSoftDestroy: "ignore",
          onUpdate: "cascade",
          strategy: null,
        },
      } as unknown as MetaRelation;

      const meta = {
        ...baseMetadata,
        relations: [manyToOneRelation],
      } as unknown as EntityMetadata;

      // Entity with FK column directly on entity
      const entity = { ...baseEntity, customerId: "cust-uuid-1" };
      const result = compileUpsert(entity, meta);
      expect(result).toMatchSnapshot();
    });

    test("should include FK column in the INSERT column list", () => {
      const manyToOneRelation: MetaRelation = {
        key: "customer",
        type: "ManyToOne",
        foreignKey: "orders",
        findKeys: { id: "customerId" },
        joinKeys: { customerId: "id" },
        joinTable: null,
        foreignConstructor: () => Object as any,
        options: {
          deferrable: false,
          initiallyDeferred: false,
          loading: { single: "eager", multiple: "eager" },
          nullable: true,
          onDestroy: "ignore",
          onInsert: "cascade",
          onOrphan: "ignore",
          onSoftDestroy: "ignore",
          onUpdate: "cascade",
          strategy: null,
        },
      } as unknown as MetaRelation;

      const meta = {
        ...baseMetadata,
        relations: [manyToOneRelation],
      } as unknown as EntityMetadata;

      const entity = { ...baseEntity, customerId: "cust-uuid-1" };
      const result = compileUpsert(entity, meta);
      // FK column appears in INSERT column list
      expect(result.text).toContain('"customerId"');
    });

    test("should include FK column in SET clause using EXCLUDED", () => {
      const manyToOneRelation: MetaRelation = {
        key: "customer",
        type: "ManyToOne",
        foreignKey: "orders",
        findKeys: { id: "customerId" },
        joinKeys: { customerId: "id" },
        joinTable: null,
        foreignConstructor: () => Object as any,
        options: {
          deferrable: false,
          initiallyDeferred: false,
          loading: { single: "eager", multiple: "eager" },
          nullable: true,
          onDestroy: "ignore",
          onInsert: "cascade",
          onOrphan: "ignore",
          onSoftDestroy: "ignore",
          onUpdate: "cascade",
          strategy: null,
        },
      } as unknown as MetaRelation;

      const meta = {
        ...baseMetadata,
        relations: [manyToOneRelation],
      } as unknown as EntityMetadata;

      const entity = { ...baseEntity, customerId: "cust-uuid-1" };
      const result = compileUpsert(entity, meta);
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      expect(doUpdatePart).toContain('"customerId" = EXCLUDED."customerId"');
    });

    test("should skip inverse-side relations (no joinKeys)", () => {
      const oneToManyRelation: MetaRelation = {
        key: "items",
        type: "OneToMany",
        foreignKey: "order",
        findKeys: { orderId: "id" },
        joinKeys: null, // inverse side — no FK here
        joinTable: null,
        foreignConstructor: () => Object as any,
        options: {
          deferrable: false,
          initiallyDeferred: false,
          loading: { single: "eager", multiple: "eager" },
          nullable: true,
          onDestroy: "ignore",
          onInsert: "cascade",
          onOrphan: "ignore",
          onSoftDestroy: "ignore",
          onUpdate: "cascade",
          strategy: null,
        },
      } as unknown as MetaRelation;

      const meta = {
        ...baseMetadata,
        relations: [oneToManyRelation],
      } as unknown as EntityMetadata;

      const entity = { ...baseEntity, items: [{ id: "item-1" }] };
      const result = compileUpsert(entity, meta);
      // No FK column injected for inverse side
      expect(result.text).not.toContain('"orderId"');
    });
  });

  describe("conflictColumns option — custom conflict target", () => {
    test("should use provided conflictColumns instead of PK columns", () => {
      // When conflictColumns is specified, the ON CONFLICT target should use those
      // columns, not the entity's primaryKeys.
      const result = compileUpsert(baseEntity, baseMetadata, undefined, {
        conflictColumns: ["status"],
      });
      expect(result).toMatchSnapshot();
      expect(result.text).toContain('ON CONFLICT ("status")');
      // PK column must NOT appear in the conflict target
      expect(result.text).not.toMatch(/ON CONFLICT \("id"\)/);
    });

    test("should support multiple conflictColumns for a composite unique index", () => {
      const result = compileUpsert(baseEntity, baseMetadata, undefined, {
        conflictColumns: ["status", "total"],
      });
      expect(result).toMatchSnapshot();
      expect(result.text).toContain('"status"');
      expect(result.text).toContain('"total"');
      // Both columns appear in the ON CONFLICT clause
      const conflictClause = result.text.split("ON CONFLICT (")[1].split(")")[0];
      expect(conflictClause).toContain('"status"');
      expect(conflictClause).toContain('"total"');
    });

    test("conflictColumns with a single unique column produces correct SQL structure", () => {
      // Full SQL shape verification via snapshot
      const meta = {
        ...baseMetadata,
        entity: { ...baseMetadata.entity, name: "products", namespace: "catalog" },
        fields: [
          makeField("id", { type: "uuid" }),
          makeField("sku", { type: "string" }),
          makeField("title", { type: "string" }),
          makeField("price", { type: "decimal" }),
        ],
        primaryKeys: ["id"],
      } as unknown as EntityMetadata;

      const entity = { id: "prod-1", sku: "SKU-ABC", title: "Widget", price: 9.99 };
      const result = compileUpsert(entity, meta, undefined, {
        conflictColumns: ["sku"],
      });
      expect(result).toMatchSnapshot();
      // Conflict on sku, not on id
      expect(result.text).toContain('ON CONFLICT ("sku")');
      expect(result.text).not.toMatch(/ON CONFLICT \("id"\)/);
    });

    test("conflictColumns are quoted identifiers, not raw strings", () => {
      // Column names must be properly quoted even when coming from options
      const result = compileUpsert(baseEntity, baseMetadata, undefined, {
        conflictColumns: ["status"],
      });
      // The quoted form must be present
      expect(result.text).toContain('"status"');
    });

    test("SET clause is unaffected by conflictColumns option", () => {
      // The SET clause is determined by the columns in the entity, not the conflict target
      const result = compileUpsert(baseEntity, baseMetadata, undefined, {
        conflictColumns: ["status"],
      });
      const doUpdatePart = result.text.split("DO UPDATE SET ")[1].split(" RETURNING")[0];
      // PK still excluded from SET (exclusion is based on primaryKeys, not conflictColumns)
      expect(doUpdatePart).not.toContain('"id"');
      // Mutable columns still use EXCLUDED
      expect(doUpdatePart).toContain('"status" = EXCLUDED."status"');
      expect(doUpdatePart).toContain('"total" = EXCLUDED."total"');
    });

    test("empty options object falls back to PK-based conflict target", () => {
      // Passing options without conflictColumns must behave identically to no options
      const resultNoOptions = compileUpsert(baseEntity, baseMetadata);
      const resultEmptyOptions = compileUpsert(baseEntity, baseMetadata, undefined, {});
      expect(resultNoOptions.text).toBe(resultEmptyOptions.text);
      expect(resultNoOptions.params).toEqual(resultEmptyOptions.params);
    });

    test("undefined options falls back to PK-based conflict target", () => {
      const result = compileUpsert(baseEntity, baseMetadata, undefined, undefined);
      expect(result.text).toContain('ON CONFLICT ("id")');
    });
  });

  describe("params array", () => {
    test("should have one param per INSERT column", () => {
      // 3 fields: id, status, total
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.params).toHaveLength(3);
    });

    test("should reference correct positional placeholders in INSERT VALUES", () => {
      const result = compileUpsert(baseEntity, baseMetadata);
      expect(result.text).toContain("$1");
      expect(result.text).toContain("$2");
      expect(result.text).toContain("$3");
      expect(result.text).not.toContain("$4");
    });
  });
});
