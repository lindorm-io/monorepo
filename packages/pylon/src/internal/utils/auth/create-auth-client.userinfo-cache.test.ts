// The OIDC Core §5.3 userinfo cache, driven end to end through the REAL auth
// client against a REAL sqlite proteus source and a REAL Amphora — the payload
// is `@Encrypted`, so a mocked repository would prove nothing about what
// actually round-trips or about what lands on disk.

import { Aegis } from "@lindorm/aegis";
import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import type { ReadableTime } from "@lindorm/date";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { isBigInt } from "@lindorm/is";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { CachedUserinfo } from "../../../entities/CachedUserinfo.js";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type { PylonAuthConfig, PylonUserinfo } from "../../../types/index.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../../__fixtures__/app-config.js";
import { stageEncryptedField } from "../../utils/stage-encrypted-field.js";
import { createAuthClient } from "./create-auth-client.js";

const ISSUER = "https://test.lindorm.io/";
const NOW = new Date("2026-08-06T10:00:00.000Z");
const TOKEN = "opaque-access-token";

/**
 * ⚠ Two claims here exist to prove the payload is stored in DOMAIN form:
 * `updatedAt` is a real `Date` (which a PLAIN `@Field("json")` would reject
 * outright), and `address` is the one NESTED profile claim (OIDC Core §5.1),
 * whose keys the wire translation would rewrite. See the two pins below.
 */
const PROFILE: PylonUserinfo = {
  subject: "alice",
  name: "Alice Andersson",
  email: "alice@lindorm.io",
  emailVerified: true,
  picture: "https://cdn.lindorm.io/alice.png",
  updatedAt: new Date("2026-08-06T09:00:00.000Z"),
  address: { streetAddress: "1 Storgatan", postalCode: "11122", country: "SE" },
};

let sources: Array<ProteusSource> = [];

const createKv = async (amphora: IAmphora): Promise<ProteusSource> => {
  const source = new ProteusSource({
    driver: "sqlite",
    filename: ":memory:",
    entities: [] as never,
    logger: createMockLogger(),
    synchronize: true,
    amphora,
  });
  sources.push(source);

  // Exactly what Pylon.loadSources does: register, then stage the KEK onto the
  // bare `@Encrypted()` marker BEFORE setup resolves the entity.
  await source.addEntities([CachedUserinfo]);
  await stageEncryptedField(source, CachedUserinfo, "payload", {
    condition: { purpose: "pylon:kek" },
  });

  await source.connect();
  await source.setup();

  return source;
};

const createDriver = (userinfo: Mock, clientId = "client-a"): IPylonAuthDriver =>
  ({
    clientId,
    endpoints: () => ({
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}authorize`,
      tokenEndpoint: `${ISSUER}token`,
      userinfoEndpoint: `${ISSUER}userinfo`,
      introspectionEndpoint: null,
      revocationEndpoint: null,
      endSessionEndpoint: null,
    }),
    userinfo,
  }) as unknown as IPylonAuthDriver;

type ContextOptions = {
  kv?: ProteusSource;
  ttl?: ReadableTime;
  /** `false` = the deployment turned userinfo caching off on its own. */
  userinfo?: false;
  /** `null` = a VERIFY-ONLY driver, which is nobody's OAuth client. */
  clientId?: string | null;
  amphora: IAmphora;
};

const createContext = (opts: ContextOptions): any => {
  const aegis = createMockAegis();
  // The presented credential is OPAQUE, so the local fast path must fail and the
  // driver call must be reached — the mock resolves a JWT by default.
  aegis.verify.mockRejectedValue(new Error("unsupported_token_type"));

  const ctx: any = {
    aegis,
    amphora: opts.amphora,
    logger: createMockLogger(),
    request: {},
    state: {
      app: {
        // Exactly what `buildAppConfig` resolves: the driver's identity and
        // capabilities, plus the deployment's per-concern cache policy.
        config: createTestAppConfig({
          auth: createTestAuthConfig({
            clientId: opts.clientId === undefined ? "client-a" : opts.clientId,
            issuer: ISSUER,
            cache: opts.kv
              ? { userinfo: opts.userinfo === false ? false : { ttl: opts.ttl } }
              : false,
          }),
        }),
        environment: "test",
      },
      authorization: { type: "bearer", value: TOKEN },
      metadata: { correlationId: "corr-1" },
      origin: "https://api.lindorm.io",
      session: null,
      tokens: {},
    },
  };

  // The evictable SESSION, exactly what the dependencies middleware installs.
  if (opts.kv) {
    ctx.cache = opts.kv.session({ logger: ctx.logger });
  }

  return ctx;
};

const createConfig = (driver: IPylonAuthDriver): PylonAuthConfig => ({
  driver,
  defaultTokenExpiry: "1d",
  refresh: { maxAge: "1h", mode: "half_life" },
  router: null,
});

/** Every stored value of the row, stringified — so the assertion covers the
 *  `@TypedJson` sidecar column as well as the payload itself, whatever the
 *  naming strategy called either. */
const rawRow = async (source: ProteusSource, id: string): Promise<string> => {
  const client = await source.client<any>();
  const tables: Array<string> = client
    .all("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((r: any) => r.name as string);

  for (const table of tables) {
    try {
      const row = client.get(`SELECT * FROM "${table}" WHERE id = ?`, [id]);
      // ⚠ Drivers hand back their own scalar types (sqlite returns a BigInt for
      // a large integer), so everything goes through String() rather than
      // trusting JSON.stringify to know them.
      if (row)
        return JSON.stringify(row, (_key, value) =>
          isBigInt(value) ? String(value) : value,
        );
    } catch (error: any) {
      // Table without an `id` column — skip. A serialisation failure is NOT a
      // skip: it would silently turn the seal assertion into a no-op.
      if (!/no such column/i.test(error.message)) throw error;
    }
  }

  return "";
};

describe("createAuthClient userinfo cache", () => {
  let amphora: IAmphora;
  let kv: ProteusSource;
  let userinfo: Mock;

  beforeEach(async () => {
    MockDate.set(NOW.toISOString());

    const { KryptosKit } = await import("@lindorm/kryptos");
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger: createMockLogger() });
    amphora.add([
      KryptosKit.generate.enc.oct({
        algorithm: "A128KW",
        issuer: ISSUER,
        publish: false,
        purpose: "pylon:kek",
      }),
    ]);

    kv = await createKv(amphora);
    userinfo = vi.fn().mockResolvedValue(PROFILE);
  });

  afterEach(async () => {
    MockDate.reset();
    await Promise.all(sources.map((source) => source.disconnect()));
    sources = [];
    vi.clearAllMocks();
  });

  const call = async (opts: Partial<ContextOptions> = {}, token = TOKEN) => {
    const ctx = createContext({ kv, amphora, ...opts });
    const client = createAuthClient(ctx, createConfig(createDriver(userinfo)));
    return client.userinfo(token);
  };

  test("should fetch userinfo once across two requests for the same token", async () => {
    const first = await call();
    const second = await call();

    expect(userinfo).toHaveBeenCalledTimes(1);
    // A HIT is indistinguishable from a MISS.
    expect(second).toEqual(first);
    expect(second).toEqual(PROFILE);
  });

  // ⚠ THE reason the key is the token and not the subject: two tokens for one
  // subject can carry different scopes, and OIDC Core §5.3 returns exactly the
  // profile claims the token's scopes authorise.
  test("should not share an entry across tokens for the same subject", async () => {
    userinfo.mockResolvedValueOnce(PROFILE);
    userinfo.mockResolvedValueOnce({ subject: "alice", name: "Alice Andersson" });

    const wide = await call({}, "token-with-profile-scope");
    const narrow = await call({}, "token-without-profile-scope");

    expect(userinfo).toHaveBeenCalledTimes(2);
    expect(wide.email).toBe("alice@lindorm.io");
    expect(narrow.email).toBeUndefined();

    const rows = await kv.repository(CachedUserinfo).find({});
    expect(rows).toHaveLength(2);
  });

  test("should fetch again once the entry has expired", async () => {
    await call();

    // Inside the built-in five minutes.
    MockDate.set(new Date(NOW.getTime() + 4 * 60_000).toISOString());
    await call();
    expect(userinfo).toHaveBeenCalledTimes(1);

    // Past it.
    MockDate.set(new Date(NOW.getTime() + 6 * 60_000).toISOString());
    await call();
    expect(userinfo).toHaveBeenCalledTimes(2);
  });

  test("should honour the deployment ttl over the built-in default", async () => {
    await call({ ttl: "30 seconds" });

    // Well inside the built-in five minutes, past the configured thirty seconds.
    MockDate.set(new Date(NOW.getTime() + 45_000).toISOString());
    await call({ ttl: "30 seconds" });

    expect(userinfo).toHaveBeenCalledTimes(2);
  });

  // A userinfo failure is an ERROR, not an answer. Caching it would serve a
  // stale failure after its cause cleared.
  test("should cache nothing and propagate when userinfo fails", async () => {
    userinfo.mockRejectedValue(new Error("userinfo endpoint is down"));

    await expect(call()).rejects.toThrow("userinfo endpoint is down");

    const rows = await kv.repository(CachedUserinfo).find({});
    expect(rows).toHaveLength(0);

    await expect(call()).rejects.toThrow("userinfo endpoint is down");
    expect(userinfo).toHaveBeenCalledTimes(2);
  });

  // ⚠ PIN. `@TypedJson` is what carries the JS types through the JSON column: a
  // `Date` comes back a `Date`, at the same instant. Drop the decorator and the
  // write fails outright — proteus refuses a Date inside a plain json field —
  // which is exactly the loud failure this cache wants.
  test("should preserve a Date claim across the cache", async () => {
    const miss = await call();
    const hit = await call();

    expect(userinfo).toHaveBeenCalledTimes(1);
    expect(hit.updatedAt).toBeInstanceOf(Date);
    expect(hit.updatedAt!.getTime()).toBe(miss.updatedAt!.getTime());
    expect(hit.updatedAt!.toISOString()).toBe("2026-08-06T09:00:00.000Z");
  });

  // ⚠ PIN. The nested `address` must come back spelled exactly as the driver
  // returned it. This is THE reason the payload is domain form rather than wire
  // form — see the paired proof below.
  test("should preserve a nested address across the cache", async () => {
    const miss = await call();
    const hit = await call();

    expect(hit.address).toEqual({
      streetAddress: "1 Storgatan",
      postalCode: "11122",
      country: "SE",
    });
    expect(hit.address).toEqual(miss.address);
  });

  // Aegis is now symmetric over `address` — `toWire` snake-keys it and
  // `toDomain` camels it back — so the asymmetry that once forced domain form is
  // retired. The choice STANDS, on `updatedAt` alone: a wire-form payload
  // flattens it to unix seconds and the `Date` never comes back (pinned above).
  test("the address claim round-trips symmetrically now — that reason is retired", () => {
    const wire = Aegis.toWire({
      subject: "alice",
      address: { streetAddress: "1 Storgatan" },
    });

    expect(wire.address).toEqual({ street_address: "1 Storgatan" });
    expect(Aegis.toDomain(wire).claims.address).toEqual({
      streetAddress: "1 Storgatan",
    });
  });

  test("should seal the profile at rest", async () => {
    await call();

    const rows = await kv.repository(CachedUserinfo).find({});
    expect(rows).toHaveLength(1);

    const stored = await rawRow(kv, rows[0].id);

    // Reading through the repository proves nothing — it decrypts
    // transparently. The RAW row must carry none of the profile, payload or
    // `@TypedJson` sidecar.
    expect(stored).not.toContain("alice");
    expect(stored).not.toContain("alice@lindorm.io");
    expect(stored).not.toContain("Alice Andersson");
    expect(stored).not.toContain("cdn.lindorm.io");
    expect(stored).not.toContain("1 Storgatan");
    // The sidecar spells each path's type as a one-letter code; finding one
    // means it went to disk in the clear.
    expect(stored).not.toContain('"subject":"S"');
    // …and the row really was read raw.
    expect(stored).toContain(rows[0].id);
  });

  // `kv` is optional on PylonSettings — a service without one must keep working
  // exactly as it did before the cache existed.
  test("should work uncached when no source is configured", async () => {
    const first = await call({ kv: undefined });
    await call({ kv: undefined });

    expect(userinfo).toHaveBeenCalledTimes(2);
    expect(first).toEqual(PROFILE);
  });

  test("should fetch every request when the deployment turns userinfo caching off", async () => {
    await call({ userinfo: false });
    await call({ userinfo: false });

    expect(userinfo).toHaveBeenCalledTimes(2);
  });

  // A storage outage must degrade to a fetch, never fail the request.
  test("should serve the request when the cache backend fails", async () => {
    const broken = {
      session: () => ({
        repository: () => ({
          findOne: async () => {
            throw new Error("kv is down");
          },
          upsert: async () => {
            throw new Error("kv is down");
          },
        }),
      }),
    } as any;

    await expect(call({ kv: broken })).resolves.toEqual(PROFILE);
    expect(userinfo).toHaveBeenCalledTimes(1);
  });

  // No client identity ⇒ no key that is safe to share, so the cache steps aside
  // rather than key on the token alone. A VERIFY-ONLY driver is nobody's OAuth
  // client, which `buildAppConfig` resolves to a null client id.
  test("should skip the cache when the deployment resolved no client id", async () => {
    for (let i = 0; i < 2; i++) {
      const ctx = createContext({ kv, amphora, clientId: null });
      await createAuthClient(ctx, createConfig(createDriver(userinfo))).userinfo(TOKEN);
    }

    expect(userinfo).toHaveBeenCalledTimes(2);
  });
});
