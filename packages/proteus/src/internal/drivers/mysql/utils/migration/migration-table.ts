import { MySqlMigrationError } from "../../errors/MySqlMigrationError.js";
import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import type {
  MigrationRecord,
  MysqlMigrationTableOptions,
} from "../../types/migration.js";
import { quoteIdentifier } from "../quote-identifier.js";

const getQuotedTable = (options?: MysqlMigrationTableOptions): string =>
  quoteIdentifier(options?.table ?? "proteus_migrations");

type MigrationRow = {
  id: string;
  name: string;
  checksum: string;
  created_at: Date | string;
  started_at: Date | string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

const toRecord = (row: MigrationRow): MigrationRecord => ({
  id: row.id,
  name: row.name,
  checksum: row.checksum,
  createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  startedAt: row.started_at instanceof Date ? row.started_at : new Date(row.started_at),
  finishedAt: row.finished_at
    ? row.finished_at instanceof Date
      ? row.finished_at
      : new Date(row.finished_at)
    : null,
  rolledBackAt: row.rolled_back_at
    ? row.rolled_back_at instanceof Date
      ? row.rolled_back_at
      : new Date(row.rolled_back_at)
    : null,
});

export const ensureMigrationTable = async (
  client: MysqlQueryClient,
  options?: MysqlMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${qt} (
      \`id\`             VARCHAR(255) NOT NULL PRIMARY KEY,
      \`name\`           VARCHAR(255) NOT NULL UNIQUE,
      \`checksum\`       VARCHAR(64) NOT NULL,
      \`created_at\`     DATETIME(3) NOT NULL,
      \`started_at\`     DATETIME(3) NOT NULL,
      \`finished_at\`    DATETIME(3) DEFAULT NULL,
      \`rolled_back_at\` DATETIME(3) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

export const getAppliedMigrations = async (
  client: MysqlQueryClient,
  options?: MysqlMigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQuotedTable(options);
  const { rows } = await client.query<MigrationRow>(
    `SELECT \`id\`, \`name\`, \`checksum\`, \`created_at\`, \`started_at\`, \`finished_at\`, \`rolled_back_at\`
     FROM ${qt}
     WHERE \`finished_at\` IS NOT NULL AND \`rolled_back_at\` IS NULL
     ORDER BY \`created_at\` ASC, \`name\` ASC`,
  );
  return rows.map(toRecord);
};

export const getPartiallyAppliedMigrations = async (
  client: MysqlQueryClient,
  options?: MysqlMigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQuotedTable(options);
  const { rows } = await client.query<MigrationRow>(
    `SELECT \`id\`, \`name\`, \`checksum\`, \`created_at\`, \`started_at\`, \`finished_at\`, \`rolled_back_at\`
     FROM ${qt}
     WHERE \`started_at\` IS NOT NULL AND \`finished_at\` IS NULL AND \`rolled_back_at\` IS NULL
     ORDER BY \`created_at\` ASC, \`name\` ASC`,
  );
  return rows.map(toRecord);
};

export const getAllMigrationRecords = async (
  client: MysqlQueryClient,
  options?: MysqlMigrationTableOptions,
): Promise<Array<MigrationRecord>> => {
  const qt = getQuotedTable(options);
  const { rows } = await client.query<MigrationRow>(
    `SELECT \`id\`, \`name\`, \`checksum\`, \`created_at\`, \`started_at\`, \`finished_at\`, \`rolled_back_at\`
     FROM ${qt}
     ORDER BY \`created_at\` ASC, \`name\` ASC`,
  );
  return rows.map(toRecord);
};

export const insertMigrationRecord = async (
  client: MysqlQueryClient,
  record: {
    id: string;
    name: string;
    checksum: string;
    createdAt: Date;
    startedAt: Date;
  },
  options?: MysqlMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  await client.query(
    `INSERT INTO ${qt} (\`id\`, \`name\`, \`checksum\`, \`created_at\`, \`started_at\`)
     VALUES (?, ?, ?, ?, ?) AS \`_new\`
     ON DUPLICATE KEY UPDATE
       \`id\` = \`_new\`.\`id\`,
       \`checksum\` = \`_new\`.\`checksum\`,
       \`started_at\` = \`_new\`.\`started_at\`,
       \`finished_at\` = NULL,
       \`rolled_back_at\` = NULL`,
    [record.id, record.name, record.checksum, record.createdAt, record.startedAt],
  );
};

export const deleteMigrationRecord = async (
  client: MysqlQueryClient,
  id: string,
  options?: MysqlMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  await client.query(`DELETE FROM ${qt} WHERE \`id\` = ?`, [id]);
};

export const markMigrationFinished = async (
  client: MysqlQueryClient,
  id: string,
  options?: MysqlMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  const { rowCount } = await client.query(
    `UPDATE ${qt} SET \`finished_at\` = NOW(3) WHERE \`id\` = ?`,
    [id],
  );
  if (rowCount === 0) {
    throw new MySqlMigrationError("No migration record found", { debug: { id } });
  }
};

export const markMigrationFailed = async (
  client: MysqlQueryClient,
  id: string,
  options?: MysqlMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  await client.query(`UPDATE ${qt} SET \`finished_at\` = NULL WHERE \`id\` = ?`, [id]);
};

export const markMigrationRolledBack = async (
  client: MysqlQueryClient,
  id: string,
  options?: MysqlMigrationTableOptions,
): Promise<void> => {
  const qt = getQuotedTable(options);
  const { rowCount } = await client.query(
    `UPDATE ${qt} SET \`rolled_back_at\` = NOW(3), \`finished_at\` = COALESCE(\`finished_at\`, NOW(3)) WHERE \`id\` = ?`,
    [id],
  );
  if (rowCount === 0) {
    throw new MySqlMigrationError("No migration record found", { debug: { id } });
  }
};
