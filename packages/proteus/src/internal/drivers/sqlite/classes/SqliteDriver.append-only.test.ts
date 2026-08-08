/**
 * The @AppendOnly trigger DDL is not best-effort.
 *
 * The repository guard refuses an update/delete that goes THROUGH proteus on
 * every driver. The database triggers exist for the writes that do not — raw
 * SQL, another service, a migration. A deployment that finished setup believes
 * the table is immutable, so a trigger that failed to install and was only
 * logged is a silent loss of that guarantee: setup must fail instead.
 *
 * The first test runs the whole thing for real — a real better-sqlite3 file, a
 * real sync — and reads the installed triggers back out of `sqlite_master`, so
 * the failure tests below are not asserting against a path that never worked.
 * The failure itself is injected on the live client (SQLite's own
 * `CREATE TRIGGER IF NOT EXISTS` swallows every name collision, so there is no
 * DDL a caller can write that fails on demand).
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
  PrimaryKeyField,
} from "../../../../decorators/index.js";
import { SqliteSyncError } from "../errors/SqliteSyncError.js";
import type { SqliteQueryClient } from "../types/sqlite-query-client.js";

@AppendOnly()
@Entity({ name: "AppendOnlyLedger" })
class AppendOnlyLedger {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @Field("string")
  note!: string;
}

describe("SqliteDriver append-only triggers", () => {
  const opened: Array<ProteusSource> = [];
  const files: Array<string> = [];

  afterEach(async () => {
    for (const source of opened.splice(0)) await source.disconnect();
    for (const file of files.splice(0)) await rm(file, { force: true });
  });

  const newFile = (): string => {
    const filename = join(tmpdir(), `proteus-ao-${randomUUID()}.db`);
    files.push(filename);
    return filename;
  };

  const makeSource = (filename: string): ProteusSource => {
    const source = new ProteusSource({
      driver: "sqlite",
      filename,
      entities: [AppendOnlyLedger],
      logger: createMockLogger(),
      synchronize: true,
    });
    opened.push(source);
    return source;
  };

  /** Make every CREATE TRIGGER statement fail, leaving the rest of sync alone. */
  const breakTriggerDdl = (client: SqliteQueryClient): void => {
    const exec = client.exec.bind(client);
    client.exec = (sql: string): void => {
      if (sql.includes("CREATE TRIGGER")) {
        throw new Error("disk I/O error");
      }
      exec(sql);
    };
  };

  test("setup installs both triggers when the DDL succeeds", async () => {
    const source = makeSource(newFile());

    await source.connect();
    await source.setup();

    const client = await source.client<SqliteQueryClient>();
    const triggers = client.all(
      `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'AppendOnlyLedger'`,
    ) as Array<{ name: string }>;

    expect(triggers.map((t) => t.name).sort()).toEqual([
      "proteus_ao_AppendOnlyLedger_no_delete",
      "proteus_ao_AppendOnlyLedger_no_update",
    ]);
  });

  /**
   * The triggers reach the database twice: the sync PLAN creates them on a
   * fresh table, and the driver re-applies them after every sync. Against an
   * ALREADY-migrated database the plan is empty — introspection sees the
   * triggers — so the post-sync re-application is the only actor, and it is
   * the one that used to swallow a failure into a `warn` and let setup report
   * success. That is the redeploy case: the schema is current, the DDL fails,
   * and nothing told anyone.
   */
  const redeployWithBrokenTriggerDdl = async (): Promise<unknown> => {
    const filename = newFile();

    const first = makeSource(filename);
    await first.connect();
    await first.setup();
    await first.disconnect();

    const second = makeSource(filename);
    await second.connect();
    breakTriggerDdl(await second.client<SqliteQueryClient>());

    return second.setup().then(
      () => null,
      (error: unknown) => error,
    );
  };

  test("setup fails, naming the table, when re-applying the triggers fails", async () => {
    const error = await redeployWithBrokenTriggerDdl();

    expect(error).toBeInstanceOf(SqliteSyncError);
    expect((error as SqliteSyncError).message).toContain("AppendOnlyLedger");
    expect(error).toMatchObject({
      code: "append_only_trigger_failed",
      data: { table: `"AppendOnlyLedger"`, driver: "sqlite" },
    });
  });

  test("the failure names the driver and carries the underlying DDL error", async () => {
    const error = (await redeployWithBrokenTriggerDdl()) as SqliteSyncError;

    expect(error.details).toContain("sqlite driver");
    expect(error.details).toContain("disk I/O error");
    expect(error.errors.join(" ")).toContain("disk I/O error");
  });
});
