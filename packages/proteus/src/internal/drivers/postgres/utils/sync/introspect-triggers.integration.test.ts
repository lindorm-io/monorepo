import { randomBytes } from "crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { introspectTriggers } from "./introspect-triggers.js";

/**
 * The trigger filter is a LIKE pattern, where `_` is the SINGLE-CHARACTER
 * WILDCARD. Unescaped, `'proteus_%'` also claims every trigger named `proteus`
 * plus at least one more character — and what introspection reports as
 * proteus-managed is exactly what `diffSchema` is free to DROP, so a foreign
 * trigger named that way gets removed on the next sync.
 *
 * Runs against the docker-composed PostgreSQL instance
 * (packages/proteus/docker-compose.postgres.yml).
 */

let client: PostgresQueryClient;
let raw: Client;
let schema: string;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_${randomBytes(6).toString("hex")}`;

  await raw.query(`CREATE SCHEMA ${schema}`);

  await raw.query(`
    CREATE TABLE ${schema}.ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      amount INTEGER NOT NULL
    )
  `);

  await raw.query(`
    CREATE FUNCTION ${schema}.deny() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'denied';
    END;
    $$
  `);

  // A genuine proteus-managed trigger, named the way the append-only DDL names
  // them (packages/proteus/src/internal/drivers/postgres/utils/ddl/generate-append-only-ddl.ts).
  await raw.query(`
    CREATE TRIGGER "proteus_append_only_no_delete"
      BEFORE DELETE ON ${schema}.ledger
      FOR EACH ROW EXECUTE FUNCTION ${schema}.deny()
  `);

  // Foreign triggers a user may legitimately create. Every one of them matches
  // the unescaped `proteus_%` pattern.
  for (const name of ["proteusXyz", "proteus1abc", "proteusAudit"]) {
    await raw.query(`
      CREATE TRIGGER "${name}"
        BEFORE UPDATE ON ${schema}.ledger
        FOR EACH ROW EXECUTE FUNCTION ${schema}.deny()
    `);
  }

  // A trigger sharing no prefix at all — the control.
  await raw.query(`
    CREATE TRIGGER "trg_user_audit"
      BEFORE INSERT ON ${schema}.ledger
      FOR EACH ROW EXECUTE FUNCTION ${schema}.deny()
  `);
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA ${schema} CASCADE`);
  await raw.end();
});

describe("introspectTriggers (integration)", () => {
  it("should claim the proteus_-prefixed trigger and no other", async () => {
    const rows = await introspectTriggers(client, [schema], ["ledger"]);

    expect(rows).toEqual([
      { schema, table: "ledger", triggerName: "proteus_append_only_no_delete" },
    ]);
  });

  it("should not claim a trigger whose name is proteus plus any single character", async () => {
    const rows = await introspectTriggers(client, [schema], ["ledger"]);
    const names = rows.map((row) => row.triggerName);

    expect(names).not.toContain("proteusXyz");
    expect(names).not.toContain("proteus1abc");
    expect(names).not.toContain("proteusAudit");
  });
});
