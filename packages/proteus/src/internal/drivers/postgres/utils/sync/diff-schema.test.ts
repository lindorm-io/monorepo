import { diffSchema } from "../../../../drivers/postgres/utils/sync/diff-schema";
import type { DbSnapshot } from "../../types/db-snapshot";
import type { DesiredSchema } from "../../types/desired-schema";

const emptySnapshot: DbSnapshot = { tables: [], enums: [], schemas: [] };

const emptyDesired: DesiredSchema = {
  tables: [],
  enums: [],
  schemas: [],
  extensions: [],
};

describe("diffSchema", () => {
  it("should return empty plan for matching state", () => {
    const plan = diffSchema(emptySnapshot, emptyDesired);
    expect(plan.operations).toHaveLength(0);
    expect(plan.summary).toEqual({ safe: 0, warning: 0, destructive: 0, total: 0 });
  });

  it("should create extension", () => {
    const plan = diffSchema(emptySnapshot, { ...emptyDesired, extensions: ["vector"] });
    expect(plan.operations[0].type).toBe("create_extension");
    expect(plan.operations[0].sql).toContain("vector");
  });

  it("should create schema", () => {
    const plan = diffSchema(emptySnapshot, { ...emptyDesired, schemas: ["myapp"] });
    expect(plan.operations[0].type).toBe("create_schema");
  });

  it("should skip existing schema", () => {
    const plan = diffSchema(
      { ...emptySnapshot, schemas: ["myapp"] },
      { ...emptyDesired, schemas: ["myapp"] },
    );
    expect(plan.operations.filter((o) => o.type === "create_schema")).toHaveLength(0);
  });

  it("should create new table", () => {
    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "users",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "name",
              pgType: "TEXT",
              nullable: false,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "users_pkey",
              type: "PRIMARY KEY",
              columns: ["id"],
              foreignSchema: null,
              foreignTable: null,
              foreignColumns: null,
              onDelete: null,
              onUpdate: null,
              checkExpr: null,
              deferrable: false,
              initiallyDeferred: false,
            },
          ],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(emptySnapshot, desired);
    expect(plan.operations.find((o) => o.type === "create_table")).toBeDefined();
    expect(plan).toMatchSnapshot();
  });

  it("should diff existing table columns", () => {
    const snapshot: DbSnapshot = {
      tables: [
        {
          schema: "public",
          name: "users",
          columns: [
            {
              name: "id",
              type: "uuid",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "old_col",
              type: "text",
              nullable: true,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
      enums: [],
      schemas: ["public"],
    };

    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "users",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "new_col",
              pgType: "TEXT",
              nullable: true,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);
    expect(plan.operations.find((o) => o.type === "add_column")).toBeDefined();
    expect(plan.operations.find((o) => o.type === "drop_column")).toBeDefined();
  });

  it("should order operations correctly", () => {
    const snapshot: DbSnapshot = {
      tables: [
        {
          schema: "public",
          name: "users",
          columns: [
            {
              name: "id",
              type: "uuid",
              nullable: false,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "old_idx_constraint",
              type: "UNIQUE",
              columns: ["id"],
              foreignSchema: null,
              foreignTable: null,
              foreignColumns: null,
              onDelete: null,
              onUpdate: null,
              checkExpr: null,
              deferrable: false,
              initiallyDeferred: false,
            },
          ],
          indexes: [
            {
              name: "old_idx",
              unique: false,
              columns: [{ name: "id", direction: "asc" }],
              method: "btree",
              where: null,
              include: [],
            },
          ],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
      enums: [],
      schemas: ["public"],
    };

    const desired: DesiredSchema = {
      ...emptyDesired,
      extensions: ["vector"],
      schemas: ["myapp"],
      enums: [{ schema: "public", name: "enum_status", values: ["active"] }],
      tables: [
        {
          schema: "public",
          name: "users",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "email",
              pgType: "TEXT",
              nullable: true,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "new_uq",
              type: "UNIQUE",
              columns: ["email"],
              foreignSchema: null,
              foreignTable: null,
              foreignColumns: null,
              onDelete: null,
              onUpdate: null,
              checkExpr: null,
              deferrable: false,
              initiallyDeferred: false,
            },
          ],
          indexes: [
            {
              name: "new_idx",
              unique: false,
              columns: [{ name: "email", direction: "asc" }],
              method: "btree",
              where: null,
              include: null,
              concurrent: false,
            },
          ],
          comment: "User accounts",
          columnComments: {},
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);
    const types = plan.operations.map((o) => o.type);

    // Verify ordering: extensions → schemas → enums → drops → adds → indexes → comments
    const extIdx = types.indexOf("create_extension");
    const schemaIdx = types.indexOf("create_schema");
    const enumIdx = types.indexOf("create_enum");
    const dropConstraintIdx = types.indexOf("drop_constraint");
    const dropIndexIdx = types.indexOf("drop_index");
    const addColIdx = types.indexOf("add_column");
    const addConstraintIdx = types.lastIndexOf("add_constraint");
    const createIndexIdx = types.indexOf("create_index");
    const commentIdx = types.indexOf("set_comment");

    expect(extIdx).toBeLessThan(schemaIdx);
    expect(schemaIdx).toBeLessThan(enumIdx);
    expect(dropConstraintIdx).toBeLessThan(addColIdx);
    expect(dropIndexIdx).toBeLessThan(addColIdx);
    expect(addColIdx).toBeLessThan(addConstraintIdx);
    expect(addConstraintIdx).toBeLessThan(createIndexIdx);
    expect(createIndexIdx).toBeLessThan(commentIdx);
  });

  it("should include DEFERRABLE INITIALLY DEFERRED for FK on new table", () => {
    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "orders",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "user_id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "orders_pkey",
              type: "PRIMARY KEY",
              columns: ["id"],
              foreignSchema: null,
              foreignTable: null,
              foreignColumns: null,
              onDelete: null,
              onUpdate: null,
              checkExpr: null,
              deferrable: false,
              initiallyDeferred: false,
            },
            {
              name: "orders_user_id_fkey",
              type: "FOREIGN KEY",
              columns: ["user_id"],
              foreignSchema: "public",
              foreignTable: "users",
              foreignColumns: ["id"],
              onDelete: "CASCADE",
              onUpdate: null,
              checkExpr: null,
              deferrable: true,
              initiallyDeferred: true,
            },
          ],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(emptySnapshot, desired);

    const fkOp = plan.operations.find(
      (o) => o.type === "add_constraint" && o.sql.includes("orders_user_id_fkey"),
    );

    expect(fkOp).toBeDefined();
    expect(fkOp!.sql).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(plan).toMatchSnapshot();
  });

  it("should include DEFERRABLE INITIALLY IMMEDIATE for FK on new table when initiallyDeferred is false", () => {
    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "items",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "order_id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "items_pkey",
              type: "PRIMARY KEY",
              columns: ["id"],
              foreignSchema: null,
              foreignTable: null,
              foreignColumns: null,
              onDelete: null,
              onUpdate: null,
              checkExpr: null,
              deferrable: false,
              initiallyDeferred: false,
            },
            {
              name: "items_order_id_fkey",
              type: "FOREIGN KEY",
              columns: ["order_id"],
              foreignSchema: "public",
              foreignTable: "orders",
              foreignColumns: ["id"],
              onDelete: null,
              onUpdate: null,
              checkExpr: null,
              deferrable: true,
              initiallyDeferred: false,
            },
          ],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(emptySnapshot, desired);

    const fkOp = plan.operations.find(
      (o) => o.type === "add_constraint" && o.sql.includes("items_order_id_fkey"),
    );

    expect(fkOp).toBeDefined();
    expect(fkOp!.sql).toContain("DEFERRABLE INITIALLY IMMEDIATE");
    expect(fkOp!.sql).not.toContain("INITIALLY DEFERRED");
    expect(plan).toMatchSnapshot();
  });

  it("should create triggers for new table with triggers", () => {
    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "events",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "events_pkey",
              type: "PRIMARY KEY",
              columns: ["id"],
              foreignSchema: null,
              foreignTable: null,
              foreignColumns: null,
              onDelete: null,
              onUpdate: null,
              checkExpr: null,
              deferrable: false,
              initiallyDeferred: false,
            },
          ],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [
            {
              name: "trg_append_only_events",
              statements: [
                `CREATE OR REPLACE FUNCTION proteus_append_only() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'append-only: updates not allowed'; END; $$ LANGUAGE plpgsql;`,
                `CREATE TRIGGER "trg_append_only_events" BEFORE UPDATE OR DELETE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION proteus_append_only();`,
              ],
            },
          ],
        },
      ],
    };

    const plan = diffSchema(emptySnapshot, desired);
    const triggerOps = plan.operations.filter((o) => o.type === "create_trigger");
    expect(triggerOps).toHaveLength(2);
    expect(plan).toMatchSnapshot();
  });

  it("should create triggers when existing table gains triggers", () => {
    const snapshot: DbSnapshot = {
      tables: [
        {
          schema: "public",
          name: "events",
          columns: [
            {
              name: "id",
              type: "uuid",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
      enums: [],
      schemas: ["public"],
    };

    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "events",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [
            {
              name: "trg_append_only_events",
              statements: [
                `CREATE OR REPLACE FUNCTION proteus_append_only() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'append-only: updates not allowed'; END; $$ LANGUAGE plpgsql;`,
                `CREATE TRIGGER "trg_append_only_events" BEFORE UPDATE OR DELETE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION proteus_append_only();`,
              ],
            },
          ],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);
    const triggerOps = plan.operations.filter((o) => o.type === "create_trigger");
    expect(triggerOps).toHaveLength(2);
    expect(plan).toMatchSnapshot();
  });

  it("should drop triggers when existing table loses triggers", () => {
    const snapshot: DbSnapshot = {
      tables: [
        {
          schema: "public",
          name: "events",
          columns: [
            {
              name: "id",
              type: "uuid",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [{ name: "trg_append_only_events" }],
        },
      ],
      enums: [],
      schemas: ["public"],
    };

    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "events",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);
    const triggerOps = plan.operations.filter((o) => o.type === "drop_trigger");
    expect(triggerOps).toHaveLength(1);
    expect(plan).toMatchSnapshot();
  });

  it("should emit no trigger ops when triggers match", () => {
    const snapshot: DbSnapshot = {
      tables: [
        {
          schema: "public",
          name: "events",
          columns: [
            {
              name: "id",
              type: "uuid",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [{ name: "trg_append_only_events" }],
        },
      ],
      enums: [],
      schemas: ["public"],
    };

    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "events",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: "gen_random_uuid()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [
            {
              name: "trg_append_only_events",
              statements: [
                `CREATE TRIGGER "trg_append_only_events" BEFORE UPDATE OR DELETE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION proteus_append_only();`,
              ],
            },
          ],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);
    const triggerOps = plan.operations.filter(
      (o) => o.type === "create_trigger" || o.type === "drop_trigger",
    );
    expect(triggerOps).toHaveLength(0);
  });

  it("should compute summary correctly", () => {
    const desired: DesiredSchema = {
      ...emptyDesired,
      tables: [
        {
          schema: "public",
          name: "users",
          columns: [
            {
              name: "id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [],
          indexes: [],
          comment: null,
          columnComments: {},
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(emptySnapshot, desired);
    expect(plan.summary.total).toBe(plan.operations.length);
    expect(plan.summary.safe + plan.summary.warning + plan.summary.destructive).toBe(
      plan.summary.total,
    );
  });
});
