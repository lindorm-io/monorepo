import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { compileDeleteWithLimit } from "./compile-delete-with-limit.js";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Base metadata — single PK, schema-qualified
// ---------------------------------------------------------------------------
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
    makeField("status", { type: "string" }),
    makeField("amount", { type: "float" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

// ---------------------------------------------------------------------------
// Composite PK metadata
// ---------------------------------------------------------------------------
const compositePkMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "order_items",
    namespace: "app",
  },
  fields: [
    makeField("orderId", { type: "uuid", name: "order_id" }),
    makeField("itemId", { type: "uuid", name: "item_id" }),
    makeField("qty", { type: "integer" }),
  ],
  relations: [],
  primaryKeys: ["orderId", "itemId"],
} as unknown as EntityMetadata;

// ---------------------------------------------------------------------------
// No-namespace metadata
// ---------------------------------------------------------------------------
const noNamespaceMeta = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "orders",
    namespace: null,
  },
  fields: [makeField("id", { type: "uuid" }), makeField("status", { type: "string" })],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

// ---------------------------------------------------------------------------
// Custom column name on PK
// ---------------------------------------------------------------------------
const customColMeta = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "tickets",
    namespace: "app",
  },
  fields: [
    makeField("ticketId", { type: "uuid", name: "ticket_id" }),
    makeField("subject", { type: "string" }),
  ],
  relations: [],
  primaryKeys: ["ticketId"],
} as unknown as EntityMetadata;

// ---------------------------------------------------------------------------
// Soft-delete metadata
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Versioned metadata
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Both soft-delete and versioned
// ---------------------------------------------------------------------------
const combinedMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "records",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("data", { type: "string" }),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("compileDeleteWithLimit", () => {
  describe("basic delete with limit", () => {
    test("generates CTE + DELETE with correct structure", () => {
      const result = compileDeleteWithLimit({ status: "pending" } as any, 10, metadata);
      expect(result).toMatchSnapshot();
    });

    test("text contains WITH to_delete CTE", () => {
      const result = compileDeleteWithLimit({ status: "pending" } as any, 10, metadata);
      expect(result.text).toContain('WITH "to_delete" AS (');
    });

    test("text contains DELETE FROM targeting the same table", () => {
      const result = compileDeleteWithLimit({ status: "pending" } as any, 10, metadata);
      expect(result.text).toContain('DELETE FROM "app"."orders"');
    });

    test("text contains LIMIT placeholder", () => {
      const result = compileDeleteWithLimit({ status: "pending" } as any, 10, metadata);
      expect(result.text).toContain("LIMIT $");
    });

    test("text uses IN (SELECT pk FROM to_delete) for single PK", () => {
      const result = compileDeleteWithLimit({ status: "pending" } as any, 10, metadata);
      expect(result.text).toContain('"id" IN (SELECT "id" FROM "to_delete")');
    });
  });

  describe("composite primary key", () => {
    test("generates ROW() condition for composite PK", () => {
      const result = compileDeleteWithLimit({} as any, 5, compositePkMetadata);
      expect(result).toMatchSnapshot();
    });

    test("text contains ROW(...) IN (SELECT ... FROM to_delete)", () => {
      const result = compileDeleteWithLimit({} as any, 5, compositePkMetadata);
      expect(result.text).toContain(
        'ROW("order_id", "item_id") IN (SELECT "order_id", "item_id" FROM "to_delete")',
      );
    });
  });

  describe("namespace / schema qualification", () => {
    test("uses metadata namespace when present", () => {
      const result = compileDeleteWithLimit({} as any, 10, metadata);
      expect(result.text).toContain('"app"."orders"');
    });

    test("unqualified table name when metadata.namespace is null and no override", () => {
      const result = compileDeleteWithLimit({} as any, 10, noNamespaceMeta);
      expect(result).toMatchSnapshot();
      expect(result.text).not.toContain('"app"');
      expect(result.text).toContain('"orders"');
    });

    test("explicit namespace override used when metadata.namespace is null", () => {
      const result = compileDeleteWithLimit({} as any, 10, noNamespaceMeta, "public");
      expect(result).toMatchSnapshot();
      expect(result.text).toContain('"public"."orders"');
    });

    test("metadata.namespace takes precedence over explicit namespace override", () => {
      // metadata.namespace = "app"; override = "public" — "app" wins
      const result = compileDeleteWithLimit({} as any, 10, metadata, "public");
      expect(result.text).toContain('"app"."orders"');
      expect(result.text).not.toContain('"public"');
    });
  });

  describe("param index ordering", () => {
    test("criteria params come first; limit param is last", () => {
      // criteria binds status ($1) and amount ($2), limit should be $3
      const result = compileDeleteWithLimit(
        { status: "active", amount: 100 } as any,
        25,
        metadata,
      );
      expect(result).toMatchSnapshot();
      // The limit value must be the final element of params
      const params = result.params;
      expect(params[params.length - 1]).toBe(25);
    });

    test("limit placeholder index matches params array length", () => {
      const result = compileDeleteWithLimit({ status: "active" } as any, 50, metadata);
      const params = result.params;
      const limitIdx = params.length;
      // The text must reference $<limitIdx> inside LIMIT clause
      expect(result.text).toContain(`LIMIT $${limitIdx}`);
    });

    test("empty criteria produces limit as the only param", () => {
      const result = compileDeleteWithLimit({} as any, 100, metadata);
      expect(result.params).toEqual([100]);
    });
  });

  describe("custom column name on primary key", () => {
    test("uses resolved column name (ticket_id) not field key (ticketId)", () => {
      const result = compileDeleteWithLimit({} as any, 5, customColMeta);
      expect(result).toMatchSnapshot();
      expect(result.text).toContain('"ticket_id"');
      expect(result.text).not.toContain('"ticketId"');
    });
  });

  describe("null criteria value", () => {
    test("generates IS NULL condition for null field value", () => {
      const result = compileDeleteWithLimit({ status: null } as any, 10, metadata);
      expect(result).toMatchSnapshot();
    });

    test("text includes IS NULL instead of = $N for null field", () => {
      const result = compileDeleteWithLimit({ status: null } as any, 10, metadata);
      expect(result.text).toContain('"status" IS NULL');
      expect(result.text).not.toMatch(/"status" = \$\d/);
    });

    test("params array contains only the limit value (no param for null comparison)", () => {
      const result = compileDeleteWithLimit({ status: null } as any, 10, metadata);
      // IS NULL is parameterless — params should only have the limit value
      expect(result.params).toEqual([10]);
    });
  });

  describe("soft-delete entity", () => {
    test("CTE SELECT includes deleted_at IS NULL filter", () => {
      const result = compileDeleteWithLimit({} as any, 10, softDeleteMetadata);
      expect(result).toMatchSnapshot();
    });

    test("text includes deleted_at IS NULL condition", () => {
      const result = compileDeleteWithLimit({} as any, 10, softDeleteMetadata);
      expect(result.text).toContain('"deleted_at" IS NULL');
    });
  });

  describe("versioned entity", () => {
    test("CTE SELECT includes version_end_date IS NULL filter", () => {
      const result = compileDeleteWithLimit({} as any, 10, versionedMetadata);
      expect(result).toMatchSnapshot();
    });

    test("text includes version_end_date IS NULL condition", () => {
      const result = compileDeleteWithLimit({} as any, 10, versionedMetadata);
      expect(result.text).toContain('"version_end_date" IS NULL');
    });
  });

  describe("soft-delete and versioned combined", () => {
    test("CTE SELECT includes both deleted_at IS NULL and version_end_date IS NULL filters", () => {
      const result = compileDeleteWithLimit({} as any, 10, combinedMetadata);
      expect(result).toMatchSnapshot();
    });

    test("text includes both soft-delete and version filters", () => {
      const result = compileDeleteWithLimit({} as any, 10, combinedMetadata);
      expect(result.text).toContain('"deleted_at" IS NULL');
      expect(result.text).toContain('"version_end_date" IS NULL');
    });
  });
});
