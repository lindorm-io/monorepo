// Postgres Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against a real PostgreSQL instance.
// Uses a random schema for isolation; teardown drops the schema.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import type { Constructor, Dict } from "@lindorm/types";
import type { IEntity } from "../../interfaces/index.js";
import { ProteusSource } from "../../classes/ProteusSource.js";
import { PostgresDriver } from "../drivers/postgres/classes/PostgresDriver.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import type { NamingStrategy } from "../../types/source-options.js";
import {
  createTckAmphora,
  TCK_ENCRYPTION,
} from "../__fixtures__/tck/create-tck-amphora.js";
import { stageTckEncryptions } from "../__fixtures__/tck/stage-tck-encryptions.js";
import { resolveTckStorageName } from "../__fixtures__/tck/resolve-tck-metadata.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { describe, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000 });

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";

let namespace = `tck_${randomBytes(6).toString("hex")}`;

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
    checkConstraints: true,
    bigintColumns: true,
    decimalColumns: true,
    binaryColumns: true,
    typedJson: true,
    bigintIdentity: true,
    upsertConflictColumns: true,
    encryption: true,
    inheritance: { singleTable: true, joined: true },
    transactions: { rollback: true, savepoints: true },
    migrations: { lifecycle: true, generation: true },
  },
  async setup(
    entities: Array<Constructor<IEntity>>,
    naming: NamingStrategy = "none",
  ): Promise<TckDriverHandle> {
    const logger = createMockLogger();

    // Per-naming schema so each strategy's run is isolated.
    namespace = `tck_${naming}_${randomBytes(6).toString("hex")}`;

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
      naming,
      entities,
      logger,
      amphora,
      encryption: TCK_ENCRYPTION,
    });

    stageTckEncryptions(source, entities);

    await source.connect();
    await source.setup();

    // Create a persistent client for clear operations (avoid opening/closing per test)
    clearClient = new Client({ connectionString: PG_CONNECTION });
    await clearClient.connect();

    return {
      amphora,

      repository<E extends IEntity>(target: Constructor<E>) {
        return source.repository(target);
      },

      async readRawRows<E extends IEntity>(target: Constructor<E>) {
        if (!clearClient) {
          throw new Error("[TCK:PG] clearClient not initialized");
        }
        const table = resolveTckStorageName(source, target as Constructor<IEntity>);
        const raw = await clearClient.query(`SELECT * FROM "${namespace}"."${table}"`);
        return raw.rows as Array<Dict>;
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
  // One strategy per driver — postgres proves `snake`. See ../__fixtures__/tck/NAMING.md.
  runTck(factory, () => source, ["snake"]);
});
