// flushCache against REAL Postgres + REAL Redis.
//
// The bug this feature kills: a mutation made outside the ORM — raw `client()`
// SQL or a `queryBuilder()` write — does not invalidate the query cache, so
// reads keep serving stale rows until the TTL expires. These tests prove the
// staleness is real and that flushCache actually clears it.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Redis } from "ioredis";
import { Client, type PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { ProteusSource } from "../../classes/ProteusSource.js";
import { RedisCacheAdapter } from "../../classes/RedisCacheAdapter.js";
import {
  Cache,
  Entity,
  Field,
  Generated,
  PrimaryKeyField,
} from "../../decorators/index.js";

vi.setConfig({ testTimeout: 120_000 });

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";
const namespace = `flush_cache_${randomBytes(6).toString("hex")}`;

@Entity({ name: "FlushCacheProduct" })
@Cache("5 Minutes")
class FlushCacheProduct {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

let client: Redis;
let source: ProteusSource;

describe("flushCache integration", () => {
  beforeAll(async () => {
    client = new Redis({
      host: process.env.REDIS_HOST ?? "127.0.0.1",
      port: Number(process.env.REDIS_PORT ?? 6379),
      db: 2,
      lazyConnect: true,
    });
    await client.connect();

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
      entities: [FlushCacheProduct],
      cache: { adapter: new RedisCacheAdapter({ client }), ttl: "5 Minutes" },
      logger: createMockLogger(),
    });

    await source.connect();
    await source.setup();
  });

  afterAll(async () => {
    if (source) {
      await source.disconnect();
    }
    if (client) {
      await client.quit();
      client.disconnect();
    }

    const raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    try {
      await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    } finally {
      await raw.end();
    }
  });

  beforeEach(async () => {
    await client.flushdb();
    await source.repository(FlushCacheProduct).clear();
  });

  test("a raw client() write leaves reads stale until flushCache evicts the entry", async () => {
    const repo = source.repository(FlushCacheProduct);
    const product = await repo.insert({ name: "Widget" });

    // Warm the cache.
    expect((await repo.findOne({ id: product.id }))!.name).toBe("Widget");

    // Mutate OUTSIDE the ORM — nothing invalidates the cache.
    const pg = await source.client<PoolClient>();
    try {
      await pg.query(
        `UPDATE "${namespace}"."FlushCacheProduct" SET "name" = $1 WHERE "id" = $2`,
        ["Renamed", product.id],
      );
    } finally {
      pg.release();
    }

    // The stale read is the bug flushCache exists to fix.
    expect((await repo.findOne({ id: product.id }))!.name).toBe("Widget");

    await source.flushCache(FlushCacheProduct);

    expect((await repo.findOne({ id: product.id }))!.name).toBe("Renamed");
  });

  test("a queryBuilder() write leaves reads stale until flushCache evicts the entry", async () => {
    const repo = source.repository(FlushCacheProduct);
    const product = await repo.insert({ name: "Gadget" });

    expect((await repo.findOne({ id: product.id }))!.name).toBe("Gadget");

    await source
      .queryBuilder(FlushCacheProduct)
      .update()
      .set({ name: "Rebuilt" })
      .where({ id: product.id })
      .execute();

    expect((await repo.findOne({ id: product.id }))!.name).toBe("Gadget");

    await source.flushCache();

    expect((await repo.findOne({ id: product.id }))!.name).toBe("Rebuilt");
  });

  test("flushCache from a session clears entries cached through the source", async () => {
    const repo = source.repository(FlushCacheProduct);
    const product = await repo.insert({ name: "Sprocket" });

    expect((await repo.findOne({ id: product.id }))!.name).toBe("Sprocket");

    const pg = await source.client<PoolClient>();
    try {
      await pg.query(
        `UPDATE "${namespace}"."FlushCacheProduct" SET "name" = $1 WHERE "id" = $2`,
        ["Overhauled", product.id],
      );
    } finally {
      pg.release();
    }

    await source.session().flushCache(FlushCacheProduct);

    expect((await repo.findOne({ id: product.id }))!.name).toBe("Overhauled");
  });

  test("flushCache with no target removes every cache key of the namespace", async () => {
    const repo = source.repository(FlushCacheProduct);
    await repo.insert({ name: "Bolt" });
    await repo.find();

    const before = await client.keys(`${namespace}:cache:*`);
    expect(before.length).toBeGreaterThan(0);

    await source.flushCache();

    expect(await client.keys(`${namespace}:cache:*`)).toEqual([]);
  });
});
