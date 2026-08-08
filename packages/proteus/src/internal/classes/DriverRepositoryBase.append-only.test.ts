import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "../../classes/ProteusSource.js";
import {
  AppendOnly,
  CreateDateField,
  Entity,
  Field,
  Generated,
  PrimaryKeyField,
  UpdateDateField,
} from "../../decorators/index.js";
import type { IProteusRepository } from "../../interfaces/index.js";

/**
 * An @AppendOnly entity is immutable after insert, and the repository is the
 * layer that says so — the SQL triggers `setup()` writes are a second line, not
 * the first. They can be absent: the trigger DDL is best-effort (a failure is
 * logged and swallowed), a schema managed by migrations may never have carried
 * them, and MySQL/SQLite cannot guard TRUNCATE at all.
 *
 * So this runs against a REAL sqlite source with real rows, and asserts what
 * the cross-driver TCK deliberately cannot: that the append-only error is what
 * comes back — not a driver error raised by the trigger downstream — and that
 * the rows are still there afterwards.
 *
 * The parity half (all four methods, all six drivers) lives in
 * ../__fixtures__/tck/append-only.tck.ts.
 */

@AppendOnly()
@Entity({ name: "AppendOnlyLedger" })
class AppendOnlyLedger {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  entry!: string;
}

let source: ProteusSource;
let repo: IProteusRepository<AppendOnlyLedger>;

const filename = join(tmpdir(), `proteus-append-only-${randomUUID()}.db`);

beforeAll(async () => {
  source = new ProteusSource({
    driver: "sqlite",
    filename,
    entities: [AppendOnlyLedger],
    logger: createMockLogger(),
    synchronize: true,
  });
  await source.connect();
  await source.setup();

  repo = source.repository(AppendOnlyLedger);

  await repo.insert({ entry: "first" });
  await repo.insert({ entry: "second" });
});

afterAll(async () => {
  await source.disconnect();
  await rm(filename, { force: true });
});

const REFUSED = { code: "append_only_violation" };

describe("criteria-based writes on an @AppendOnly entity", () => {
  test("insert still works — append-only blocks mutation, not writes", async () => {
    const inserted = await repo.insert({ entry: "third" });
    expect(inserted.entry).toBe("third");
    await expect(repo.count()).resolves.toBe(3);
  });

  test("delete is refused and the rows survive", async () => {
    await expect(repo.delete({ entry: "first" })).rejects.toMatchObject(REFUSED);
    await expect(repo.findOne({ entry: "first" })).resolves.not.toBeNull();
  });

  test("delete with a limit is refused", async () => {
    await expect(repo.delete({ entry: "first" }, { limit: 1 })).rejects.toMatchObject(
      REFUSED,
    );
  });

  test("updateMany is refused and the value is unchanged", async () => {
    await expect(
      repo.updateMany({ entry: "first" }, { entry: "rewritten" }),
    ).rejects.toMatchObject(REFUSED);

    await expect(repo.findOne({ entry: "rewritten" })).resolves.toBeNull();
    await expect(repo.findOne({ entry: "first" })).resolves.not.toBeNull();
  });

  // An append-only entity cannot declare a @DeleteDateField — the two are
  // rejected together at metadata build — so these two can never mutate
  // anything. What is at stake is WHICH refusal comes back: append-only is the
  // reason there is no delete date, so it must be the answer, not the
  // downstream "missing @DeleteDateField" complaint about its own consequence.
  test("softDelete is refused as append-only, not as a missing delete date", async () => {
    await expect(repo.softDelete({ entry: "second" })).rejects.toMatchObject(REFUSED);

    const found = await repo.findOne({ entry: "second" });
    expect(found).not.toBeNull();
  });

  test("restore is refused as append-only, not as a missing delete date", async () => {
    await expect(repo.restore({ entry: "second" })).rejects.toMatchObject(REFUSED);
  });

  test("the refusal names the method that was blocked", async () => {
    await expect(repo.delete({ entry: "first" })).rejects.toMatchObject({
      message: 'Cannot delete an append-only entity "AppendOnlyLedger"',
    });
    await expect(
      repo.updateMany({ entry: "first" }, { entry: "x" }),
    ).rejects.toMatchObject({
      message: 'Cannot updateMany an append-only entity "AppendOnlyLedger"',
    });
  });
});
