// Real-driver companion to array-default.test.ts. A non-nullable @Field("array")
// zero-coerces to []: the runtime always populates the column, so an insert that
// omits the array must NOT violate the NOT NULL (DEFAULT-less) column, and reads
// back as []. @Nullable arrays keep defaulting to / permitting null.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  Default,
  Entity,
  Field,
  Generated,
  Nullable,
  PrimaryKeyField,
} from "../../decorators/index.js";
import { ProteusSource } from "../../classes/ProteusSource.js";

vi.setConfig({ testTimeout: 120_000 });

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";
const namespace = `tck_arrdefault_${randomBytes(6).toString("hex")}`;

@Entity({ name: "ArrDefaultDoc" })
class ArrDefaultDoc {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @Field("array")
  tags!: Array<string>;

  @Nullable()
  @Field("array")
  labels!: Array<string> | null;

  @Default(() => ["seed"])
  @Field("array")
  seeded!: Array<string>;

  @Field("array", { arrayType: "timestamp" })
  timestamps!: Array<Date>;

  @Field("object")
  meta!: Record<string, unknown>;

  @Nullable()
  @Field("object")
  settings!: Record<string, unknown> | null;
}

let source: ProteusSource;

describe("postgres — non-nullable array zero-value default", () => {
  beforeAll(async () => {
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
      entities: [ArrDefaultDoc],
      logger: createMockLogger(),
    });

    await source.connect();
    await source.setup();
  });

  afterAll(async () => {
    if (source) {
      await source.disconnect();
    }
    const raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    try {
      await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    } finally {
      await raw.end();
    }
  });

  test("insert omitting the array persists and reads back as []", async () => {
    const repo = source.repository(ArrDefaultDoc);

    // Omit `tags` — the NOT NULL, DEFAULT-less column must not reject the insert.
    const inserted = await repo.insert({ name: "no-tags" });
    expect(inserted.tags).toEqual([]);

    const found = await repo.findOne({ id: inserted.id });
    expect(found!.tags).toEqual([]);
    // Non-nullable object zero-coerces to {}; @Nullable container stays null;
    // explicit @Default wins.
    expect(found!.meta).toEqual({});
    expect(found!.labels).toBeNull();
    expect(found!.settings).toBeNull();
    expect(found!.seeded).toEqual(["seed"]);
    expect(found!.timestamps).toEqual([]);
  });

  test("explicit and populated containers round-trip; typed elements hydrate", async () => {
    const repo = source.repository(ArrDefaultDoc);
    const when = new Date("2026-01-15T00:00:00.000Z");

    const inserted = await repo.insert({
      name: "with-values",
      tags: ["a", "b"],
      labels: [],
      timestamps: [when],
      meta: { a: 1, nested: { b: 2 } },
      settings: {},
    });

    const found = await repo.findOne({ id: inserted.id });
    expect(found!.tags).toEqual(["a", "b"]);
    expect(found!.labels).toEqual([]);
    expect(found!.meta).toEqual({ a: 1, nested: { b: 2 } });
    expect(found!.settings).toEqual({});
    expect(found!.timestamps).toHaveLength(1);
    expect(found!.timestamps[0]).toBeInstanceOf(Date);
    expect(found!.timestamps[0].toISOString()).toBe(when.toISOString());
  });
});
