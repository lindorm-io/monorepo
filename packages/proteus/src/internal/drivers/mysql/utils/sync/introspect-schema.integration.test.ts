import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import { introspectSchema } from "./introspect-schema.js";

/**
 * The trigger filter is a LIKE pattern, where `_` is the SINGLE-CHARACTER
 * WILDCARD. Unescaped, `'proteus_%'` also claims every trigger named `proteus`
 * plus at least one more character — and what introspection reports as
 * proteus-managed is exactly what `diffSchema` is free to DROP, so a foreign
 * trigger named that way gets removed on the next sync.
 *
 * Runs against the docker-composed MySQL instance
 * (packages/proteus/docker-compose.mysql.yml).
 */

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const MYSQL_HOST = process.env["MYSQL_HOST"] ?? "127.0.0.1";
const MYSQL_PORT = Number(process.env["MYSQL_PORT"] ?? 3306);
const MYSQL_USER = "root";
const MYSQL_PASSWORD = "example";
const MYSQL_DATABASE = `intro_${randomBytes(6).toString("hex")}`;

let admin: mysql.Connection;
let raw: mysql.Connection;
let client: MysqlQueryClient;

beforeAll(async () => {
  admin = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
  });
  await admin.query(`CREATE DATABASE \`${MYSQL_DATABASE}\``);

  raw = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
  });

  // `introspectSchema` expands array params (`TABLE_NAME IN (?)`), which only
  // the text protocol does — so `query`, never `execute`.
  client = {
    query: async <R = Record<string, unknown>>(sql: string, params?: Array<unknown>) => {
      const [rows] = await raw.query(sql, params);
      const list = Array.isArray(rows) ? (rows as Array<R>) : [];
      return { rows: list, rowCount: list.length, insertId: 0 };
    },
  };

  await raw.query(`
    CREATE TABLE \`ledger\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`amount\` INT NOT NULL,
      PRIMARY KEY (\`id\`)
    )
  `);

  // A genuine proteus-managed trigger, named the way the append-only DDL names
  // them (packages/proteus/src/internal/drivers/mysql/utils/ddl/generate-append-only-ddl.ts).
  await raw.query(`
    CREATE TRIGGER \`proteus_ao_ledger_no_delete\`
      BEFORE DELETE ON \`ledger\`
      FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only'
  `);

  // Foreign triggers a user may legitimately create. Every one of them matches
  // the unescaped `proteus_%` pattern.
  for (const name of ["proteusXyz", "proteus1abc", "proteusAudit"]) {
    await raw.query(`
      CREATE TRIGGER \`${name}\`
        BEFORE UPDATE ON \`ledger\`
        FOR EACH ROW
        SET NEW.\`amount\` = NEW.\`amount\`
    `);
  }

  // A trigger sharing no prefix at all — the control.
  await raw.query(`
    CREATE TRIGGER \`trg_user_audit\`
      BEFORE INSERT ON \`ledger\`
      FOR EACH ROW
      SET NEW.\`amount\` = NEW.\`amount\`
  `);
});

afterAll(async () => {
  await raw.end();
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${MYSQL_DATABASE}\``);
  } finally {
    await admin.end();
  }
});

describe("introspectSchema triggers (integration)", () => {
  it("should claim the proteus_-prefixed trigger and no other", async () => {
    const snapshot = await introspectSchema(client, ["ledger"]);

    expect(snapshot.tables.get("ledger")!.triggers).toEqual([
      { name: "proteus_ao_ledger_no_delete" },
    ]);
  });

  it("should not claim a trigger whose name is proteus plus any single character", async () => {
    const snapshot = await introspectSchema(client, ["ledger"]);
    const names = snapshot.tables.get("ledger")!.triggers.map((trigger) => trigger.name);

    expect(names).not.toContain("proteusXyz");
    expect(names).not.toContain("proteus1abc");
    expect(names).not.toContain("proteusAudit");
  });
});
