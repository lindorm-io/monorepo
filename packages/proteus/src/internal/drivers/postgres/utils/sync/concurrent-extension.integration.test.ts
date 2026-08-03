// Concurrent-deploy regression test for the `CREATE EXTENSION` race.
//
// The sync advisory lock is scoped per NAMESPACE, but an extension is a
// DATABASE-scoped object — so two services synchronizing different schemas of
// the same database escape the lock entirely: both see "not exists", both
// CREATE, and the loser fails on `pg_extension_name_index`. That failure aborts
// the loser's transaction, taking down every unrelated statement in its plan
// (the GIN trigram index it needed) while the extension itself exists.
//
// Runs against a throwaway database. The extension must be ABSENT at the start
// of each round for the race to exist at all, and dropping it in the shared
// `default` database would break the suites running beside this one.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ProteusSource } from "../../../../../classes/ProteusSource.js";
import { Entity } from "../../../../../decorators/Entity.js";
import { Field } from "../../../../../decorators/Field.js";
import { Generated } from "../../../../../decorators/Generated.js";
import { Index } from "../../../../../decorators/Index_.js";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField.js";

vi.setConfig({ testTimeout: 300_000 });

const PG = "postgres://root:example@localhost:5432/default";
const database = `proteus_extrace_${randomBytes(6).toString("hex")}`;
const raceUrl = `postgres://root:example@localhost:5432/${database}`;

// Rounds × contenders: the race is a window of a few milliseconds, so a single
// pair proves little. Several rounds of several concurrent deploys each is what
// makes an unfixed run go red reliably.
const ROUNDS = 3;
const CONTENDERS = 4;

@Entity({ name: "ExtensionRaceBand" })
class ExtensionRaceBand {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Index({ using: "gin", opclass: "gin_trgm_ops" })
  @Field("text")
  name!: string;
}

let admin: Client; // connected to `default` — owns create/drop of the race db
let raw: Client; // connected to the race db — resets state, inspects results

const namespacesForRound = (round: number): Array<string> =>
  Array.from({ length: CONTENDERS }, (_, i) => `race_${round}_${i}`);

/** One concurrent deploy: its own schema, its own pool, all requiring pg_trgm. */
const deploy = (namespace: string): ProteusSource =>
  new ProteusSource({
    driver: "postgres",
    url: raceUrl,
    namespace,
    synchronize: true,
    naming: "none",
    entities: [ExtensionRaceBand],
    logger: createMockLogger(),
  });

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

describe("Postgres: concurrent synchronize across schemas of one database", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: PG });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);

    raw = new Client({ connectionString: raceUrl });
    await raw.connect();
  });

  afterAll(async () => {
    await raw.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  });

  it.each(Array.from({ length: ROUNDS }, (_, round) => round))(
    "round %i: every concurrent deploy gets its trigram index",
    async (round) => {
      // No extension, no race — every round starts from "not installed".
      await raw.query("DROP EXTENSION IF EXISTS pg_trgm CASCADE");

      const namespaces = namespacesForRound(round);
      const sources = namespaces.map(deploy);

      // Connect first so the pools are warm — the deploys must collide on
      // synchronize(), not on TCP setup.
      await Promise.all(sources.map((source) => source.connect()));

      const settled = await Promise.allSettled(sources.map((source) => source.setup()));

      await Promise.all(sources.map((source) => source.disconnect()));

      const rejected = settled
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      // Asserted together: the losers of the race both fail their sync AND end
      // up without the index, and one diff shows the whole picture.
      expect({
        rejected,
        indexed: await trigramIndexedSchemas(namespaces),
      }).toEqual({ rejected: [], indexed: namespaces });

      const extension = await raw.query("SELECT 1 FROM pg_extension WHERE extname = $1", [
        "pg_trgm",
      ]);
      expect(extension.rowCount).toBe(1);
    },
  );
});
