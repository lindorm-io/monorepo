// Caching + @Encrypted Integration Tests
//
// The query cache is a SECOND store — with a Redis adapter, a second database.
// Anything the CachingRepository writes there leaves the vault's protection, so
// an @Encrypted field must reach it as ciphertext and be opened again on the way
// out. These tests assert both halves against a real Amphora, a real cache
// adapter and the memory driver. No Docker needed.

import { beforeEach, describe, expect, test } from "vitest";
import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ICacheAdapter } from "../../interfaces/CacheAdapter.js";
import { ProteusSource } from "../../classes/ProteusSource.js";
import { MemoryCacheAdapter } from "../../classes/MemoryCacheAdapter.js";
import {
  Cache,
  CreateDateField,
  Encrypted,
  Entity,
  Field,
  Generated,
  Nullable,
  PrimaryKeyField,
  Transform,
  TypedJson,
  UpdateDateField,
  VersionField,
} from "../../decorators/index.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  issuer: "https://test.proteus.cache/",
  purpose: "proteus:cache-test",
});

const PLAINTEXT = "canary-cache-must-not-hold-this-in-the-clear";
const PLAIN_TRANSFORMED = "shout";
const PLAIN_ISO = "2021-06-15T10:30:00.000Z";
const PLAIN_BIG = 9007199254740993n;

@Entity({ name: "CachedSecret" })
@Cache("1 Minute")
class CachedSecret {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  label!: string;

  @Encrypted()
  @Field("string")
  secret!: string;

  @Transform({
    to: (value: unknown) => (value as string).toUpperCase(),
    from: (raw: unknown) => (raw as string).toLowerCase(),
  })
  @Encrypted()
  @Field("string")
  transformedSecret!: string;

  @Encrypted()
  @TypedJson()
  @Field("json")
  payload!: Record<string, unknown>;

  @Nullable()
  @Encrypted()
  @Field("string")
  optionalSecret!: string | null;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;
}

/** A MemoryCacheAdapter that also keeps every value ever written, for inspection. */
class SpyCacheAdapter implements ICacheAdapter {
  private readonly inner = new MemoryCacheAdapter();
  readonly written: Array<string> = [];
  gets = 0;

  get = async (key: string): Promise<string | null> => {
    this.gets++;
    return this.inner.get(key);
  };

  set = async (key: string, value: string, ttlMs: number): Promise<void> => {
    this.written.push(value);
    return this.inner.set(key, value, ttlMs);
  };

  del = async (key: string): Promise<void> => this.inner.del(key);

  delByPrefix = async (prefix: string): Promise<void> => this.inner.delByPrefix(prefix);
}

const makePayload = () => ({
  canary: PLAINTEXT,
  when: new Date(PLAIN_ISO),
  big: PLAIN_BIG,
  blob: Buffer.from("hello cache"),
  maybe: undefined,
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("caching + @Encrypted", () => {
  let source: ProteusSource;
  let adapter: SpyCacheAdapter;

  beforeEach(async () => {
    adapter = new SpyCacheAdapter();
    source = new ProteusSource({
      driver: "memory",
      entities: [CachedSecret],
      logger: createMockLogger(),
      amphora: (() => {
        const a = new Amphora({ logger: createMockLogger() });
        a.add([KEK]);
        return a;
      })(),
      encryption: { condition: { purpose: "proteus:cache-test" } },
      cache: { adapter, ttl: "1 minute" },
    });

    await source.connect();
    await source.setup();
  });

  test("the cached entry holds ciphertext, never the plaintext", async () => {
    const repo = source.repository(CachedSecret);

    await repo.insert({
      label: "sealed",
      secret: PLAINTEXT,
      transformedSecret: PLAIN_TRANSFORMED,
      payload: makePayload(),
      optionalSecret: PLAINTEXT,
    });

    // Populate the cache.
    await repo.find({ label: "sealed" });

    expect(adapter.written.length).toBeGreaterThan(0);
    const cached = adapter.written.join("\n");

    expect(cached).not.toContain(PLAINTEXT);
    expect(cached).not.toContain(PLAIN_TRANSFORMED);
    expect(cached).not.toContain(PLAIN_TRANSFORMED.toUpperCase());
    expect(cached).not.toContain(PLAIN_ISO);
    expect(cached).not.toContain(String(PLAIN_BIG));
    expect(cached).not.toContain("hello cache");
    // The typed-json sidecar is sealed too — its one-letter type codes would
    // otherwise describe the shape of the payload the data half hides.
    expect(cached).not.toContain('"canary":"S"');
    expect(cached).not.toContain('"when":"D"');

    // The unencrypted column proves the entry really is this entity's row, so
    // the absences above are not just an empty cache.
    expect(cached).toContain("sealed");
  });

  test("a cache HIT returns the decrypted values, with each transform applied once", async () => {
    const repo = source.repository(CachedSecret);

    const inserted = await repo.insert({
      label: "hit",
      secret: PLAINTEXT,
      transformedSecret: PLAIN_TRANSFORMED,
      payload: makePayload(),
      optionalSecret: null,
    });

    const [miss] = await repo.find({ label: "hit" });
    expect(miss.secret).toBe(PLAINTEXT);

    const getsAfterMiss = adapter.gets;
    const [hit] = await repo.find({ label: "hit" });

    // A second get means the read went through the cache, not straight to the
    // driver — without it this test would prove nothing about the cached form.
    expect(adapter.gets).toBeGreaterThan(getsAfterMiss);

    expect(hit.id).toBe(inserted.id);
    expect(hit.secret).toBe(PLAINTEXT);
    expect(hit.transformedSecret).toBe(PLAIN_TRANSFORMED);
    expect(hit.optionalSecret).toBeNull();

    const p = hit.payload as any;
    expect(p.canary).toBe(PLAINTEXT);
    expect(p.when).toBeInstanceOf(Date);
    expect((p.when as Date).getTime()).toBe(new Date(PLAIN_ISO).getTime());
    expect(typeof p.big).toBe("bigint");
    expect(p.big).toBe(PLAIN_BIG);
    expect(Buffer.isBuffer(p.blob)).toBe(true);
    expect((p.blob as Buffer).toString()).toBe("hello cache");
    expect("maybe" in p).toBe(true);
    expect(p.maybe).toBeUndefined();
  });

  test("a write invalidates the sealed entry rather than serving a stale one", async () => {
    const repo = source.repository(CachedSecret);

    const inserted = await repo.insert({
      label: "invalidate",
      secret: PLAINTEXT,
      transformedSecret: PLAIN_TRANSFORMED,
      payload: makePayload(),
      optionalSecret: null,
    });

    await repo.find({ label: "invalidate" });

    const entity = await repo.findOneOrFail({ id: inserted.id });
    entity.secret = "rotated-secret";
    await repo.update(entity);

    const [after] = await repo.find({ label: "invalidate" });
    expect(after.secret).toBe("rotated-secret");
  });
});
