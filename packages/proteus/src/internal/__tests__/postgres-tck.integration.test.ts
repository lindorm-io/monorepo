// Postgres Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against a real PostgreSQL instance.
// Uses a random schema for isolation; teardown drops the schema.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces";
import { ProteusSource } from "../../classes/ProteusSource";
import { PostgresDriver } from "../drivers/postgres/classes/PostgresDriver";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora";
import { runTck } from "../__fixtures__/tck/run-tck";
import { describe } from "vitest";

jest.setTimeout(120_000);

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";

const namespace = `tck_${randomBytes(6).toString("hex")}`;

let source: ProteusSource;
let clearClient: Client | null = null;
const amphora = createTckAmphora();

const factory: TckDriverFactory = {
  driver: "postgres",
  capabilities: {
    softDelete: true,
    expiry: true,
    versioning: true,
    cursor: true,
    lazyLoading: true,
    embeddedLists: true,
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

    // Create the schema first via raw client
    const raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await raw.query(`CREATE SCHEMA "${namespace}"`);
    await raw.end();

    source = new ProteusSource({
      driver: "postgres",
      url: PG_CONNECTION,
      namespace,
      synchronize: true,
      entities,
      logger,
      amphora,
    });

    await source.connect();
    await source.setup();

    // Create a persistent client for clear operations (avoid opening/closing per test)
    clearClient = new Client({ connectionString: PG_CONNECTION });
    await clearClient.connect();

    return {
      repository<E extends IEntity>(target: Constructor<E>) {
        return source.repository(target);
      },

      async clear() {
        if (!clearClient) {
          throw new Error("[TCK:PG] clearClient not initialized");
        }
        const result = await clearClient.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
          [namespace],
        );

        const tables = result.rows.map((r: any) => `"${namespace}"."${r.table_name}"`);
        if (tables.length > 0) {
          // Use DELETE instead of TRUNCATE — TRUNCATE requires ACCESS EXCLUSIVE lock
          // which deadlocks when a server-side cursor holds a transaction open.
          // Disable FK triggers so delete order doesn't matter.
          await clearClient.query(`SET session_replication_role = 'replica'`);
          for (const table of tables) {
            await clearClient.query(`DELETE FROM ${table}`);
          }
          await clearClient.query(`SET session_replication_role = 'origin'`);
        }
      },

      async teardown() {
        // Close the persistent clear client
        if (clearClient) {
          await clearClient.end();
          clearClient = null;
        }

        await source.disconnect();

        const raw = new Client({ connectionString: PG_CONNECTION });
        await raw.connect();
        try {
          await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
        } finally {
          await raw.end();
        }
      },
    };
  },
};

describe("TCK: PostgreSQL", () => {
  runTck(factory, () => source);
});
