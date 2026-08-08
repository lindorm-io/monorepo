/**
 * A sync against an unchanged schema must plan NOTHING.
 *
 * Not a performance nicety. The sqlite driver's only tool for an incompatible
 * column change is the 12-step rebuild — copy every row into `_new_<table>`,
 * drop the original, rename — and a rebuild DROPS the table's triggers, so an
 * @AppendOnly table would lose and regain its database-level protection on
 * every startup, with all of its data in flight for the duration.
 *
 * The bug this pins: `SqliteDriver.connect` sets `defaultSafeIntegers(true)`,
 * which applies to PRAGMA results as much as to user tables, so `table_xinfo`
 * returns `notnull` as `1n`. The introspection compared it with `=== 1`, read
 * every NOT NULL column as nullable, and the diff planned a full rebuild that
 * produced a byte-identical table — forever. Runs through `ProteusSource`
 * against a real better-sqlite3 file so the connection carries the driver's own
 * settings; an in-memory fixture opened without `defaultSafeIntegers` cannot
 * see it.
 */

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ProteusSource } from "../../../../classes/ProteusSource.js";
import {
  AppendOnly,
  CreateDateField,
  Entity,
  Field,
  Generated,
  Index,
  Nullable,
  PrimaryKeyField,
  Unique,
  UpdateDateField,
} from "../../../../decorators/index.js";
import type { SqliteQueryClient } from "../types/sqlite-query-client.js";
import { diffSchema } from "../utils/sync/diff-schema.js";
import { introspectSchema } from "../utils/sync/introspect-schema.js";
import { projectDesiredSchemaSqlite } from "../utils/sync/project-desired-schema-sqlite.js";

@Entity({ name: "SyncIdempotenceThing" })
class SyncIdempotenceThing {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  // An index, a unique constraint and a partial index between them cover every
  // PRAGMA integer the index diff reads back (`unique`, `partial`, `seqno`).
  @Index()
  @Field("string")
  note!: string;

  @Unique()
  @Field("string")
  slug!: string;

  @Index({ where: `"count" > 0` })
  @Field("integer")
  count!: number;

  @Nullable()
  @Field("string")
  optional!: string | null;

  @Field("boolean")
  active!: boolean;

  @Field("bigint")
  big!: bigint;
}

/**
 * A `Sqlite`-prefixed name is the one the unescaped `sqlite_%` LIKE filter used
 * to hide — it introspected as absent, so the planner believed it did not exist.
 * @AppendOnly is what a phantom rebuild costs the most: the rebuild drops the
 * table's triggers and copies every row. Both hazards, one entity, and it shares
 * the zero-operations assertions below with the plain entity.
 */
@AppendOnly()
@Entity({ name: "SqliteAppendOnlyLedger" })
class SqliteAppendOnlyLedger {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @Field("string")
  note!: string;
}

describe("SqliteDriver sync idempotence", () => {
  const opened: Array<ProteusSource> = [];
  const files: Array<string> = [];

  afterEach(async () => {
    for (const source of opened.splice(0)) await source.disconnect();
    for (const file of files.splice(0)) await rm(file, { force: true });
  });

  const newFile = (): string => {
    const filename = join(tmpdir(), `proteus-sync-idem-${randomUUID()}.db`);
    files.push(filename);
    return filename;
  };

  const makeSource = (filename: string): ProteusSource => {
    const source = new ProteusSource({
      driver: "sqlite",
      filename,
      entities: [SyncIdempotenceThing, SqliteAppendOnlyLedger],
      logger: createMockLogger(),
      synchronize: true,
    });
    opened.push(source);
    return source;
  };

  /** The plan the driver's next sync would produce, built exactly as it builds it. */
  const nextPlan = async (source: ProteusSource) => {
    const client = await source.client<SqliteQueryClient>();
    const desired = projectDesiredSchemaSqlite(source.getEntityMetadata(), {
      namespace: undefined,
    });
    const snapshot = introspectSchema(
      client,
      desired.tables.map((t) => t.name),
    );
    return diffSchema(snapshot, desired);
  };

  test("a second sync of an unchanged schema plans zero operations", async () => {
    const source = makeSource(newFile());

    await source.connect();
    await source.setup();

    const plan = await nextPlan(source);

    expect(plan.operations).toEqual([]);
  });

  test("a redeploy against the same file plans zero operations", async () => {
    const filename = newFile();

    const first = makeSource(filename);
    await first.connect();
    await first.setup();
    await first.disconnect();

    const second = makeSource(filename);
    await second.connect();
    await second.setup();

    expect((await nextPlan(second)).operations).toEqual([]);
  });

  test("a genuine change is still planned", async () => {
    const source = makeSource(newFile());

    await source.connect();
    await source.setup();

    const client = await source.client<SqliteQueryClient>();
    client.exec(`ALTER TABLE "SyncIdempotenceThing" DROP COLUMN "optional"`);

    const plan = await nextPlan(source);

    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]).toMatchObject({
      type: "add_column",
      tableName: "SyncIdempotenceThing",
    });
  });
});
