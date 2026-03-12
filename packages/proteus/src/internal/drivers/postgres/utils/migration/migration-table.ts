import { PostgresMigrationError } from "../../errors/PostgresMigrationError";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import type { MigrationRecord, MigrationTableOptions } from "../../types/migration";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";

const getQualifiedTable = (options?: MigrationTableOptions): string =>
  quoteQualifiedName(options?.schema ?? "public", options?.table ?? "proteus_migrations");

type MigrationRow = {
  id: string;
  name: string;
  checksum: string;
  created_at: Date;
  started_at: Date;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

const toRecord = (row: MigrationRow): MigrationRecord => ({
  id: row.id,
  name: row.name,
  checksum: row.checksum,
  createdAt: row.created_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  rolledBackAt: row.rolled_back_at,
});

export const ensureMigrationTable = async (
  client: PostgresQueryClient,
  options?: MigrationTableOptions,
): Promise<void> => {
  const schema = quoteIdentifier(options?.schema ?? "public");
  const qt = getQualifiedTable(options);

  await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${qt} (
      "id"             UUID        NOT NULL PRIMARY KEY,
      "name"           TEXT        NOT NULL UNIQUE,
      "checksum"       TEXT        NOT NULL,
      "created_at"     TIMESTAMPTZ NOT NULL,
      "started_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
      "finished_at"    TIMESTAMPTZ,
      "rolled_back_at" TIMESTAMPTZ
    )
  `);
};

export const getAppliedMigrations = async (
  client: PostgresQueryClient,
  options?: MigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQualifiedTable(options);
  const { rows } = await client.query<MigrationRow>(
    `SELECT "id", "name", "checksum", "created_at", "started_at", "finished_at", "rolled_back_at"
     FROM ${qt}
     WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
     ORDER BY "created_at" ASC, "name" ASC`,
  );
  return rows.map(toRecord);
};

export const getAllMigrationRecords = async (
  client: PostgresQueryClient,
  options?: MigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQualifiedTable(options);
  const { rows } = await client.query<MigrationRow>(
    `SELECT "id", "name", "checksum", "created_at", "started_at", "finished_at", "rolled_back_at"
     FROM ${qt}
     ORDER BY "created_at" ASC, "name" ASC`,
  );
  return rows.map(toRecord);
};

export const getPartiallyAppliedMigrations = async (
  client: PostgresQueryClient,
  options?: MigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQualifiedTable(options);
  const { rows } = await client.query<MigrationRow>(
    `SELECT "id", "name", "checksum", "created_at", "started_at", "finished_at", "rolled_back_at"
     FROM ${qt}
     WHERE "started_at" IS NOT NULL AND "finished_at" IS NULL AND "rolled_back_at" IS NULL
     ORDER BY "created_at" ASC, "name" ASC`,
  );
  return rows.map(toRecord);
};

export const insertMigrationRecord = async (
  client: PostgresQueryClient,
  record: {
    id: string;
    name: string;
    checksum: string;
    createdAt: Date;
    startedAt: Date;
  },
  options?: MigrationTableOptions,
): Promise<void> => {
  const qt = getQualifiedTable(options);
  await client.query(
    `INSERT INTO ${qt} ("id", "name", "checksum", "created_at", "started_at")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("name") DO UPDATE SET
       "id" = EXCLUDED."id",
       "checksum" = EXCLUDED."checksum",
       "started_at" = EXCLUDED."started_at",
       "finished_at" = NULL,
       "rolled_back_at" = NULL`,
    [record.id, record.name, record.checksum, record.createdAt, record.startedAt],
  );
};

export const deleteMigrationRecord = async (
  client: PostgresQueryClient,
  id: string,
  options?: MigrationTableOptions,
): Promise<void> => {
  const qt = getQualifiedTable(options);
  await client.query(`DELETE FROM ${qt} WHERE "id" = $1`, [id]);
};

export const markMigrationFinished = async (
  client: PostgresQueryClient,
  id: string,
  options?: MigrationTableOptions,
): Promise<void> => {
  const qt = getQualifiedTable(options);
  const { rowCount } = await client.query(
    `UPDATE ${qt} SET "finished_at" = now() WHERE "id" = $1`,
    [id],
  );
  if (rowCount === 0) {
    throw new PostgresMigrationError("No migration record found", { debug: { id } });
  }
};

export const markMigrationRolledBack = async (
  client: PostgresQueryClient,
  id: string,
  options?: MigrationTableOptions,
): Promise<void> => {
  const qt = getQualifiedTable(options);
  const { rowCount } = await client.query(
    `UPDATE ${qt} SET "rolled_back_at" = now(), "finished_at" = COALESCE("finished_at", now()) WHERE "id" = $1`,
    [id],
  );
  if (rowCount === 0) {
    throw new PostgresMigrationError("No migration record found", { debug: { id } });
  }
};
