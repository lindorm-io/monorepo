import { randomBytes } from "crypto";
import { Client } from "pg";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client";
import type { DesiredSchema } from "../../types/desired-schema";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { diffSchema } from "./diff-schema";
import { SyncPlanExecutor } from "./execute-sync-plan";
import { introspectSchema } from "./introspect-schema";
import type { SyncPlan, SyncOptions } from "../../types/sync-plan";

const executeSyncPlan = (
  client: PostgresQueryClient,
  plan: SyncPlan,
  options: SyncOptions = {},
) => new SyncPlanExecutor().execute(client, plan, options);

let client: PostgresQueryClient;
let raw: Client;
let schema: string;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_types_${randomBytes(6).toString("hex")}`;
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await raw.end();
});

const TABLE = "exotic_types";

const getDesired = (): DesiredSchema => ({
  extensions: [],
  schemas: [schema],
  enums: [],
  tables: [
    {
      schema,
      name: TABLE,
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
          name: "price",
          pgType: "NUMERIC(10, 2)",
          nullable: false,
          defaultExpr: "0",
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "short_name",
          pgType: "VARCHAR(100)",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "is_active",
          pgType: "BOOLEAN",
          nullable: false,
          defaultExpr: "true",
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "rating",
          pgType: "DOUBLE PRECISION",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "counter",
          pgType: "BIGINT",
          nullable: false,
          defaultExpr: "0",
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "small_val",
          pgType: "SMALLINT",
          nullable: false,
          defaultExpr: "0",
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "data",
          pgType: "BYTEA",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "payload",
          pgType: "JSONB",
          nullable: false,
          defaultExpr: "'{}'",
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "legacy_json",
          pgType: "JSON",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "ip_addr",
          pgType: "INET",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "network",
          pgType: "CIDR",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "mac",
          pgType: "MACADDR",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "location",
          pgType: "POINT",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "birthday",
          pgType: "DATE",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "doc",
          pgType: "XML",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "tags",
          pgType: "TEXT[]",
          nullable: true,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "scores",
          pgType: "INTEGER[]",
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
          name: `${TABLE}_pkey`,
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
    },
  ],
});

describe("type round-trip (integration)", () => {
  it("should create table with all exotic types", async () => {
    const desired = getDesired();
    const managed = [{ schema, name: TABLE }];
    const snapshot = await introspectSchema(client, managed);
    const plan = diffSchema(snapshot, desired);
    expect(plan.operations.length).toBeGreaterThan(0);

    const result = await executeSyncPlan(client, plan);
    expect(result.executed).toBe(true);
  });

  it("should produce zero operations on re-sync (all types round-trip correctly)", async () => {
    const desired = getDesired();
    const managed = [{ schema, name: TABLE }];
    const snapshot = await introspectSchema(client, managed);
    const plan = diffSchema(snapshot, desired);

    const spurious = plan.operations.map((op) => `[${op.type}] ${op.description}`);
    expect(spurious).toEqual([]);
  });
});
