// Postgres trigram (pg_trgm) fuzzy-search integration test.
//
// Trigram search is PostgreSQL-only, so this lives in a focused PG integration
// file rather than the cross-driver TCK. It proves the full path end-to-end:
//   - a @Index({ using: "gin", opclass: "gin_trgm_ops" }) on a @Field("text") column
//   - synchronize auto-creates the pg_trgm extension + GIN trigram index
//   - find({ name: { $similar } }, { order: { name: { $similarity } } }) ranks
//     the closest match first.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import { ProteusSource } from "../../classes/ProteusSource.js";
import { Entity } from "../../decorators/Entity.js";
import { Field } from "../../decorators/Field.js";
import { Generated } from "../../decorators/Generated.js";
import { Index } from "../../decorators/Index_.js";
import { PrimaryKeyField } from "../../decorators/PrimaryKeyField.js";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000 });

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";

@Entity({ name: "TrigramBand" })
class TrigramBand {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Index({ using: "gin", opclass: "gin_trgm_ops" })
  @Field("text")
  name!: string;
}

const namespace = `trgm_${randomBytes(6).toString("hex")}`;

let source: ProteusSource;
let raw: Client;

describe("Postgres: pg_trgm trigram fuzzy search", () => {
  beforeAll(async () => {
    raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await raw.query(`CREATE SCHEMA "${namespace}"`);

    source = new ProteusSource({
      driver: "postgres",
      url: PG_CONNECTION,
      namespace,
      synchronize: true,
      naming: "none",
      entities: [TrigramBand],
      logger: createMockLogger(),
    });

    await source.connect();
    await source.setup();
  });

  afterAll(async () => {
    await source.disconnect();
    await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await raw.end();
  });

  beforeEach(async () => {
    const repo = source.repository(TrigramBand);
    const all = await repo.find();
    for (const row of all) await repo.destroy(row);

    await repo.insert({ name: "beatles" });
    await repo.insert({ name: "beetles" });
    await repo.insert({ name: "rolling stones" });
    await repo.insert({ name: "led zeppelin" });
  });

  test("synchronize creates the pg_trgm extension", async () => {
    const result = await raw.query(
      "SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'",
    );
    expect(result.rowCount).toBe(1);
  });

  test("synchronize creates a GIN trigram index (no ASC/DESC)", async () => {
    const result = await raw.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexdef ILIKE '%gin_trgm_ops%'`,
      [namespace],
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].indexdef).toMatch(/USING gin .*gin_trgm_ops/i);
  });

  test("$similar returns fuzzy matches, $similarity orders closest first", async () => {
    const repo = source.repository(TrigramBand);

    const results = await repo.find({ name: { $similar: "beatles" } } as any, {
      order: { name: { $similarity: "beatles", dir: "DESC" } },
    });

    expect(results.length).toBeGreaterThan(0);
    // Exact match ranks ahead of the near-typo "beetles".
    expect(results[0].name).toBe("beatles");
    expect(results.map((r) => r.name)).toContain("beetles");
    // Unrelated bands fall below the default similarity threshold.
    expect(results.map((r) => r.name)).not.toContain("led zeppelin");
  });

  test("$similar threshold form filters by explicit similarity", async () => {
    const repo = source.repository(TrigramBand);

    const results = await repo.find({
      name: { $similar: { value: "beatles", threshold: 0.9 } },
    } as any);

    expect(results.map((r) => r.name)).toEqual(["beatles"]);
  });
});
