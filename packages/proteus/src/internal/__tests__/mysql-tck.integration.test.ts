// MySQL Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against a real MySQL 8.4 instance.
// Creates a randomized database per run for parallel-safe execution.

import { createMockLogger } from "@lindorm/logger";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces";
import { ProteusSource } from "../../classes/ProteusSource";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora";
import { runTck } from "../__fixtures__/tck/run-tck";

jest.setTimeout(120_000);

const MYSQL_HOST = process.env["MYSQL_HOST"] ?? "127.0.0.1";
const MYSQL_PORT = Number(process.env["MYSQL_PORT"] ?? 3306);
const MYSQL_DATABASE = `tck_${randomBytes(6).toString("hex")}`;
const MYSQL_USER = "root";
const MYSQL_PASSWORD = "example";

let source: ProteusSource;
let clearConn: mysql.Connection | null = null;
const amphora = createTckAmphora();

const factory: TckDriverFactory = {
  driver: "mysql",
  capabilities: {
    softDelete: true,
    expiry: true,
    versioning: true,
    cursor: true,
    lazyLoading: true,
    atomicIncrements: true,
    queryBuilder: true,
    uniqueEnforcement: true,
    referentialIntegrity: true,
    encryption: true,
    inheritance: { singleTable: true, joined: true },
    transactions: { rollback: true, savepoints: true },
    migrations: { lifecycle: true, generation: true },
  },
  async setup(entities: Array<Constructor<IEntity>>): Promise<TckDriverHandle> {
    const logger = createMockLogger();

    // Wait for MySQL to be ready (container may still be initializing)
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const probe = await mysql.createConnection({
          host: MYSQL_HOST,
          port: MYSQL_PORT,
          user: MYSQL_USER,
          password: MYSQL_PASSWORD,
          connectTimeout: 2000,
        });
        await probe.execute("SELECT 1");
        await probe.end();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Create isolated database for this test file
    const adminConn = await mysql.createConnection({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
    });
    await adminConn.execute(`CREATE DATABASE \`${MYSQL_DATABASE}\``);
    await adminConn.end();

    source = new ProteusSource({
      driver: "mysql",
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      database: MYSQL_DATABASE,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      synchronize: true,
      entities,
      logger,
      amphora,
    });

    await source.connect();
    await source.setup();

    // Create a persistent connection for clear operations
    clearConn = await mysql.createConnection({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      database: MYSQL_DATABASE,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
    });

    return {
      repository<E extends IEntity>(target: Constructor<E>) {
        return source.repository(target);
      },

      async clear() {
        if (!clearConn) {
          throw new Error("[TCK:MySQL] clearConn not initialized");
        }

        // Disable FK checks so delete order doesn't matter
        await clearConn.execute("SET FOREIGN_KEY_CHECKS = 0");

        const [rows] = await clearConn.execute(
          `SELECT TABLE_NAME FROM information_schema.tables
           WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
          [MYSQL_DATABASE],
        );

        for (const row of rows as Array<{ TABLE_NAME: string }>) {
          await clearConn.execute(`DELETE FROM \`${row.TABLE_NAME}\``);
        }

        await clearConn.execute("SET FOREIGN_KEY_CHECKS = 1");
      },

      async teardown() {
        if (clearConn) {
          await clearConn.end();
          clearConn = null;
        }

        await source.disconnect();

        // Drop the isolated database
        const conn = await mysql.createConnection({
          host: MYSQL_HOST,
          port: MYSQL_PORT,
          user: MYSQL_USER,
          password: MYSQL_PASSWORD,
        });

        try {
          await conn.execute(`DROP DATABASE IF EXISTS \`${MYSQL_DATABASE}\``);
        } finally {
          await conn.end();
        }
      },
    };
  },
};

describe("TCK: MySQL", () => {
  runTck(factory, () => source);
});
