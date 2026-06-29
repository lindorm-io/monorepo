// Regression: upsert() with a conflictOn targeting a multi-word column must
// resolve the property key to its snake_case DB column name. Previously the
// repository pre-resolved conflictOn to the column name and compileUpsert
// resolved it again, throwing "Field <col> not found" for any multi-word column
// under the "snake" naming strategy. The TCK runs under "none" naming (where
// key === column) so it never exercised this path.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  CreateDateField,
  Entity,
  Field,
  Generated,
  PrimaryKeyField,
  Unique,
  UpdateDateField,
  VersionField,
} from "../../decorators/index.js";
import { ProteusSource } from "../../classes/ProteusSource.js";

vi.setConfig({ testTimeout: 120_000 });

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";
const namespace = `tck_naming_${randomBytes(6).toString("hex")}`;

@Entity({ name: "NamingSong" })
class NamingSong {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  // Multi-word column → snake column "song_key"
  @Unique()
  @Field("string")
  songKey!: string;

  @Field("string")
  name!: string;
}

let source: ProteusSource;

describe("postgres upsert under snake naming", () => {
  beforeAll(async () => {
    const logger = createMockLogger();

    const raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await raw.query(`CREATE SCHEMA "${namespace}"`);
    await raw.end();

    source = new ProteusSource({
      driver: "postgres",
      url: PG_CONNECTION,
      namespace,
      naming: "snake",
      synchronize: true,
      entities: [NamingSong],
      logger,
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

  test("upsert with conflictOn on a multi-word column inserts then updates", async () => {
    const repo = source.repository(NamingSong);

    const inserted = await repo.upsert(
      repo.create({ songKey: "k-1", name: "Original" }),
      {
        conflictOn: ["songKey"],
      },
    );
    expect(inserted.songKey).toBe("k-1");
    expect(inserted.name).toBe("Original");

    const updated = await repo.upsert(repo.create({ songKey: "k-1", name: "Updated" }), {
      conflictOn: ["songKey"],
    });
    expect(updated.name).toBe("Updated");

    const count = await repo.count({ songKey: "k-1" });
    expect(count).toBe(1);

    const found = await repo.findOne({ songKey: "k-1" });
    expect(found!.name).toBe("Updated");
  });
});
