import { SqliteMigrationError } from "../../errors/SqliteMigrationError.js";
import type { SqliteQueryClient } from "../../types/sqlite-query-client.js";
import type {
  MigrationRecord,
  SqliteMigrationTableOptions,
} from "../../types/migration.js";
import { quoteIdentifier } from "../quote-identifier.js";

const getQuotedTable = (options?: SqliteMigrationTableOptions): string =>
  quoteIdentifier(options?.table ?? "proteus_migrations");

type MigrationRow = {
  id: string;
  name: string;
  checksum: string;
  created_at: string;
  started_at: string;
  finished_at: string | null;
  rolled_back_at: string | null;
};

const toRecord = (row: MigrationRow): MigrationRecord => ({
  id: row.id,
  name: row.name,
  checksum: row.checksum,
  createdAt: new Date(row.created_at),
  startedAt: new Date(row.started_at),
  finishedAt: row.finished_at ? new Date(row.finished_at) : null,
  rolledBackAt: row.rolled_back_at ? new Date(row.rolled_back_at) : null,
});

export const ensureMigrationTable = async (
  client: SqliteQueryClient,
  options?: SqliteMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);

  client.exec(`
    CREATE TABLE IF NOT EXISTS ${qt} (
      "id"             TEXT NOT NULL PRIMARY KEY,
      "name"           TEXT NOT NULL UNIQUE,
      "checksum"       TEXT NOT NULL,
      "created_at"     TEXT NOT NULL,
      "started_at"     TEXT NOT NULL,
      "finished_at"    TEXT,
      "rolled_back_at" TEXT
    )
  `);
};

export const getAppliedMigrations = async (
  client: SqliteQueryClient,
  options?: SqliteMigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQuotedTable(options);
  const rows = client.all(
    `SELECT "id", "name", "checksum", "created_at", "started_at", "finished_at", "rolled_back_at"
     FROM ${qt}
     WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
     ORDER BY "created_at" ASC, "name" ASC`,
  ) as Array<MigrationRow>;
  return rows.map(toRecord);
};

export const getPartiallyAppliedMigrations = async (
  client: SqliteQueryClient,
  options?: SqliteMigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQuotedTable(options);
  const rows = client.all(
    `SELECT "id", "name", "checksum", "created_at", "started_at", "finished_at", "rolled_back_at"
     FROM ${qt}
     WHERE "started_at" IS NOT NULL AND "finished_at" IS NULL AND "rolled_back_at" IS NULL
     ORDER BY "created_at" ASC, "name" ASC`,
  ) as Array<MigrationRow>;
  return rows.map(toRecord);
};

export const getAllMigrationRecords = async (
  client: SqliteQueryClient,
  options?: SqliteMigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQuotedTable(options);
  const rows = client.all(
    `SELECT "id", "name", "checksum", "created_at", "started_at", "finished_at", "rolled_back_at"
     FROM ${qt}
     ORDER BY "created_at" ASC, "name" ASC`,
  ) as Array<MigrationRow>;
  return rows.map(toRecord);
};

export const insertMigrationRecord = async (
  client: SqliteQueryClient,
  record: {
    id: string;
    name: string;
    checksum: string;
    createdAt: Date;
    startedAt: Date;
  },
  options?: SqliteMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  client.run(
    `INSERT INTO ${qt} ("id", "name", "checksum", "created_at", "started_at")
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT ("name") DO UPDATE SET
       "id" = excluded."id",
       "checksum" = excluded."checksum",
       "started_at" = excluded."started_at",
       "finished_at" = NULL,
       "rolled_back_at" = NULL`,
    [
      record.id,
      record.name,
      record.checksum,
      record.createdAt.toISOString(),
      record.startedAt.toISOString(),
    ],
  );
};

export const deleteMigrationRecord = async (
  client: SqliteQueryClient,
  id: string,
  options?: SqliteMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  client.run(`DELETE FROM ${qt} WHERE "id" = ?`, [id]);
};

export const markMigrationFinished = async (
  client: SqliteQueryClient,
  id: string,
  options?: SqliteMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  const { changes } = client.run(`UPDATE ${qt} SET "finished_at" = ? WHERE "id" = ?`, [
    new Date().toISOString(),
    id,
  ]);
  if (changes === 0) {
    throw new SqliteMigrationError("No migration record found", { debug: { id } });
  }
};

export const markMigrationRolledBack = async (
  client: SqliteQueryClient,
  id: string,
  options?: SqliteMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  const { changes } = client.run(
    `UPDATE ${qt} SET "rolled_back_at" = ?, "finished_at" = COALESCE("finished_at", ?) WHERE "id" = ?`,
    [new Date().toISOString(), new Date().toISOString(), id],
  );
  if (changes === 0) {
    throw new SqliteMigrationError("No migration record found", { debug: { id } });
  }
};
