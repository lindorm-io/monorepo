// Concurrent-deploy regression test for the `CREATE EXTENSION` race on the
// MIGRATION path (the sync path has its own at
// ../sync/concurrent-extension.integration.test.ts).
//
// The migration advisory lock is scoped per NAMESPACE, but an extension is a
// DATABASE-scoped object — so two services migrating different schemas of the
// same database escape the lock entirely: both pass `IF NOT EXISTS`, and the
// loser fails on `pg_extension_name_index`. Emitted inside the migration
// transaction, that failure aborts the WHOLE migration, taking down every
// unrelated statement in it (the GIN trigram index it needed) while the
// extension itself exists.
//
// Runs against a throwaway database. The extension must be ABSENT at the start
// of each round for the race to exist at all, and dropping it in the shared
// `default` database would break the suites running beside this one.

import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Entity } from "../../../../../decorators/Entity.js";
import { Field } from "../../../../../decorators/Field.js";
import { Generated } from "../../../../../decorators/Generated.js";
import { Index } from "../../../../../decorators/Index_.js";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { MigrationManager } from "../../classes/MigrationManager.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { generateMigration } from "./generate-migration.js";

vi.setConfig({ testTimeout: 300_000 });

const PG = "postgres://root:example@localhost:5432/default";
const database = `proteus_extracemig_${randomBytes(6).toString("hex")}`;
const raceUrl = `postgres://root:example@localhost:5432/${database}`;

// Rounds × contenders: the race is a window of a few milliseconds, so a single
// pair proves little. Several rounds of several concurrent deploys each is what
// makes an unfixed run go red reliably.
const ROUNDS = 3;
const CONTENDERS = 4;

@Entity({ name: "MigrationRaceBand" })
class MigrationRaceBand {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Index({ using: "gin", opclass: "gin_trgm_ops" })
  @Field("text")
  name!: string;
}

let admin: Client; // connected to `default` — owns create/drop of the race db
let raw: Client; // connected to the race db — resets state, inspects results
let generator: PostgresQueryClient; // race db — generates the migration files

const namespacesForRound = (round: number): Array<string> =>
  Array.from({ length: CONTENDERS }, (_, i) => `racemig_${round}_${i}`);

const wrap = (client: Client): PostgresQueryClient => ({
  query: async <R = Record<string, unknown>>(sql: string, params?: Array<unknown>) => {
    const result = await client.query(sql, params);
    return { rows: result.rows as Array<R>, rowCount: result.rowCount ?? 0 };
  },
});

type Contender = {
  namespace: string;
  client: Client;
  directory: string;
  manager: MigrationManager;
};

/** One concurrent deploy: its own schema, its own session, its own migration file. */
const prepareContender = async (namespace: string): Promise<Contender> => {
  const directory = await mkdtemp(join(tmpdir(), `proteus-racemig-${namespace}-`));

  // `diffSchema` emits `create_extension` for every desired extension
  // unconditionally, so the generated file always carries the racing statement.
  await generateMigration(
    generator,
    [getEntityMetadata(MigrationRaceBand)],
    {
      namespace,
    },
    { directory, name: "init" },
  );

  const client = new Client({ connectionString: raceUrl });
  await client.connect();

  return {
    namespace,
    client,
    directory,
    manager: new MigrationManager({
      client: wrap(client),
      directory,
      logger: createMockLogger(),
      namespace,
      tableOptions: { schema: namespace },
    }),
  };
};

/**
 * `LindormError.errors` carries the wrapped cause, and it is the whole story
 * here — without it a failed round only reports "Migration up() failed".
 */
const describeRejection = (reason: unknown): string => {
  const error = reason as Error & { errors?: Array<string> };
  return [String(reason), ...(error.errors ?? [])].join(" | ");
};

const trigramIndexedSchemas = async (
  namespaces: Array<string>,
): Promise<Array<string>> => {
  const { rows } = await raw.query<{ schemaname: string }>(
    `SELECT schemaname FROM pg_indexes
      WHERE schemaname = ANY($1) AND indexdef ILIKE '%gin_trgm_ops%'
      ORDER BY schemaname`,
    [namespaces],
  );
  return rows.map((r) => r.schemaname);
};

describe("Postgres: concurrent migrate across schemas of one database", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: PG });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);

    raw = new Client({ connectionString: raceUrl });
    await raw.connect();
    generator = wrap(raw);
  });

  afterAll(async () => {
    await raw.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  });

  it.each(Array.from({ length: ROUNDS }, (_, round) => round))(
    "round %i: every concurrent migration gets its trigram index",
    async (round) => {
      // No extension, no race — every round starts from "not installed".
      await raw.query("DROP EXTENSION IF EXISTS pg_trgm CASCADE");

      const namespaces = namespacesForRound(round);
      const contenders: Array<Contender> = [];

      try {
        // Prepared first so the sessions are warm and the files are on disk —
        // the deploys must collide on apply(), not on TCP setup or codegen.
        for (const namespace of namespaces) {
          contenders.push(await prepareContender(namespace));
        }

        const settled = await Promise.allSettled(
          contenders.map((c) => c.manager.apply()),
        );

        const rejected = settled
          .filter((r) => r.status === "rejected")
          .map((r) => describeRejection((r as PromiseRejectedResult).reason));

        // Asserted together: the losers of the race both fail their migration
        // AND end up without the index, and one diff shows the whole picture.
        expect({
          rejected,
          indexed: await trigramIndexedSchemas(namespaces),
        }).toEqual({ rejected: [], indexed: namespaces });

        const extension = await raw.query(
          "SELECT 1 FROM pg_extension WHERE extname = $1",
          ["pg_trgm"],
        );
        expect(extension.rowCount).toBe(1);
      } finally {
        for (const contender of contenders) {
          await contender.client.end();
          await rm(contender.directory, { recursive: true, force: true });
        }
      }
    },
  );
});
