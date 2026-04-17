import { MongoMigrationManager } from "../drivers/mongo/classes/MongoMigrationManager";
import { MySqlMigrationManager } from "../drivers/mysql/classes/MySqlMigrationManager";
import type { MysqlQueryClient } from "../drivers/mysql/types/mysql-query-client";
import { MigrationManager } from "../drivers/postgres/classes/MigrationManager";
import type { PostgresQueryClient } from "../drivers/postgres/types/postgres-query-client";
import { SqliteMigrationManager } from "../drivers/sqlite/classes/SqliteMigrationManager";
import type { SqliteQueryClient } from "../drivers/sqlite/types/sqlite-query-client";
import type { IMigrationManager } from "../interfaces/MigrationManager";
import type { MigrationTableOptions } from "../types/migration";
import type { PoolClient } from "pg";
import { ProteusSource } from "../../classes/ProteusSource";
import { ProteusError } from "../../errors/ProteusError";

export type MigrationManagerContext = {
  source: ProteusSource;
  manager: IMigrationManager;
};

export const wrapPoolClient = (poolClient: PoolClient): PostgresQueryClient => ({
  query: async <R = Record<string, unknown>>(
    sql: string,
    params?: Array<unknown>,
  ): Promise<{ rows: Array<R>; rowCount: number }> => {
    const r = await poolClient.query(sql, params);
    return { rows: r.rows as Array<R>, rowCount: r.rowCount ?? 0 };
  },
});

type MysqlPoolConnection = {
  query: (sql: string, params?: Array<unknown>) => Promise<[unknown, unknown]>;
  release: () => void;
};

const wrapMysqlConnection = (connection: MysqlPoolConnection): MysqlQueryClient => ({
  query: async <R = Record<string, unknown>>(
    sql: string,
    params?: Array<unknown>,
  ): Promise<{ rows: Array<R>; rowCount: number; insertId: number }> => {
    const [rows] = await connection.query(sql, params);

    if (Array.isArray(rows)) {
      return {
        rows: rows as Array<R>,
        rowCount: rows.length,
        insertId: 0,
      };
    }

    return {
      rows: [] as Array<R>,
      rowCount: (rows as any).affectedRows ?? 0,
      insertId: Number((rows as any).insertId ?? 0),
    };
  },
});

const SUPPORTED_DRIVERS = ["postgres", "mysql", "sqlite", "mongo"];

export const withMigrationManager = async (
  source: ProteusSource,
  directory: string,
  fn: (ctx: MigrationManagerContext) => Promise<void>,
): Promise<void> => {
  const driverType = source.driverType;

  if (!SUPPORTED_DRIVERS.includes(driverType)) {
    throw new ProteusError(`Migrations not supported for driver "${driverType}"`);
  }

  const logger = source.log.child(["MigrationManager"]);
  const tableOptions: MigrationTableOptions | undefined = source.migrationsTable
    ? { table: source.migrationsTable }
    : undefined;

  switch (driverType) {
    // Note: `schema` option is not passed from the factory — Postgres migration-table
    // functions default to "public" schema when no schema is specified.
    case "postgres": {
      const poolClient = await source.client<PoolClient>();
      let released = false;

      const release = (): void => {
        if (!released) {
          released = true;
          poolClient.release();
        }
      };

      try {
        const client = wrapPoolClient(poolClient);
        const manager = new MigrationManager({
          client,
          directory,
          logger,
          namespace: source.namespace,
          tableOptions,
        });
        await fn({ source, manager });
      } finally {
        release();
      }
      break;
    }

    case "mysql": {
      const connection = await source.client<MysqlPoolConnection>();
      let released = false;

      const release = (): void => {
        if (!released) {
          released = true;
          connection.release();
        }
      };

      try {
        const client = wrapMysqlConnection(connection);
        const manager = new MySqlMigrationManager({
          client,
          directory,
          logger,
          namespace: source.namespace,
          tableOptions,
        });
        await fn({ source, manager });
      } finally {
        release();
      }
      break;
    }

    case "sqlite": {
      const client = await source.client<SqliteQueryClient>();
      const manager = new SqliteMigrationManager({
        client,
        directory,
        logger,
        tableOptions,
      });
      await fn({ source, manager });
      break;
    }

    case "mongo": {
      const db = await source.client<import("mongodb").Db>();
      // Db.client is a public runtime property but excluded from mongodb's TS public types
      const mongoClient = (db as unknown as { client: import("mongodb").MongoClient })
        .client;
      const manager = new MongoMigrationManager({
        client: mongoClient,
        db,
        directory,
        logger,
        namespace: source.namespace,
        tableName: tableOptions?.table,
      });
      await fn({ source, manager });
      break;
    }
  }
};
