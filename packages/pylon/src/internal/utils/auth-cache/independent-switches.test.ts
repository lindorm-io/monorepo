// The two cached concerns switch INDEPENDENTLY. This is the case the old shared
// `auth.cache.ttl` shape could not express at all — one knob could not be off
// for introspection and on for userinfo — so it is asserted explicitly, in both
// directions, over ONE source and ONE settings block.

import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { CachedIntrospection } from "../../../entities/CachedIntrospection.js";
import { CachedUserinfo } from "../../../entities/CachedUserinfo.js";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type { PylonAuthCacheConfig, PylonAuthConfig } from "../../../types/index.js";
import { createAccessTokenMiddleware } from "../../../middleware/common/create-access-token-middleware.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../../__fixtures__/app-config.js";
import { createAuthClient } from "../auth/create-auth-client.js";
import { stageEncryptedField } from "../stage-encrypted-field.js";

const ISSUER = "https://test.lindorm.io/";
const NOW = new Date("2026-08-06T10:00:00.000Z");
const TOKEN = "opaque-access-token";

const INTROSPECTION = {
  active: true,
  subject: "alice",
  scope: ["openid"],
  expiresAt: new Date("2026-08-06T11:00:00.000Z"),
};

const PROFILE = { subject: "alice", name: "Alice Andersson" };

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

  // Both concerns registered, exactly as Pylon.loadSources does when neither is
  // switched off — the SWITCH under test is the runtime policy, not the schema.
  source.addEntities([CachedIntrospection, CachedUserinfo]);
  for (const entity of [CachedIntrospection, CachedUserinfo]) {
    await stageEncryptedField(source, entity, "payload", {
      condition: { purpose: "pylon:kek" },
    });
  }

  await source.connect();
  await source.setup();

  return source;
};

const createDriver = (introspect: Mock, userinfo: Mock): IPylonAuthDriver =>
  ({
    clientId: "client-a",
    endpoints: () => ({
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}authorize`,
      tokenEndpoint: `${ISSUER}token`,
      userinfoEndpoint: `${ISSUER}userinfo`,
      introspectionEndpoint: `${ISSUER}introspect`,
      revocationEndpoint: null,
      endSessionEndpoint: null,
    }),
    introspect,
    userinfo,
  }) as unknown as IPylonAuthDriver;

const createConfig = (driver: IPylonAuthDriver): PylonAuthConfig => ({
  driver,
  defaultTokenExpiry: "1d",
  refresh: { maxAge: "1h", mode: "half_life" },
  router: null,
});

const createContext = (
  cache: PylonAuthCacheConfig,
  kv: ProteusSource,
  introspect: Mock,
  userinfo: Mock,
  amphora: IAmphora,
): any => {
  const aegis = createMockAegis();
  aegis.verify.mockRejectedValue(new Error("unsupported_token_type"));

  const ctx: any = {
    aegis,
    amphora,
    logger: createMockLogger(),
    request: {},
    state: {
      access: null,
      app: {
        // Exactly what `buildAppConfig` resolves: the driver's identity and
        // capabilities, plus the deployment's per-concern cache policy.
        config: createTestAppConfig({
          auth: createTestAuthConfig({ clientId: "client-a", issuer: ISSUER, cache }),
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
  ctx.cache = kv.session({ logger: ctx.logger });

  // ONE real client for both concerns, over ONE driver — the point of the file
  // is that the two switches are independent inside it.
  ctx.auth = createAuthClient(ctx, createConfig(createDriver(introspect, userinfo)));

  return ctx;
};

describe("auth cache independent switches", () => {
  let amphora: IAmphora;
  let kv: ProteusSource;
  let introspect: Mock;
  let userinfo: Mock;
  let next: Mock;

  beforeEach(async () => {
    MockDate.set(NOW.toISOString());

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
    introspect = vi.fn().mockResolvedValue(INTROSPECTION);
    userinfo = vi.fn().mockResolvedValue(PROFILE);
    next = vi.fn();
  });

  afterEach(async () => {
    MockDate.reset();
    await Promise.all(sources.map((source) => source.disconnect()));
    sources = [];
    vi.clearAllMocks();
  });

  /** One request: resolve the opaque access token, then read the profile. */
  const request = async (cache: PylonAuthCacheConfig): Promise<void> => {
    const ctx = createContext(cache, kv, introspect, userinfo, amphora);

    await createAccessTokenMiddleware({ issuer: ISSUER } as any)(ctx, next);
    await ctx.auth.userinfo(TOKEN);
  };

  test("should cache userinfo and not introspection", async () => {
    const cache: PylonAuthCacheConfig = {
      introspection: false,
      userinfo: { ttl: "5 minutes" },
    };

    await request(cache);
    await request(cache);

    expect(introspect).toHaveBeenCalledTimes(2);
    expect(userinfo).toHaveBeenCalledTimes(1);

    expect(await kv.repository(CachedIntrospection).find({})).toHaveLength(0);
    expect(await kv.repository(CachedUserinfo).find({})).toHaveLength(1);
  });

  test("should cache introspection and not userinfo", async () => {
    const cache: PylonAuthCacheConfig = {
      introspection: { ttl: "10 seconds" },
      userinfo: false,
    };

    await request(cache);
    await request(cache);

    expect(introspect).toHaveBeenCalledTimes(1);
    expect(userinfo).toHaveBeenCalledTimes(2);

    expect(await kv.repository(CachedIntrospection).find({})).toHaveLength(1);
    expect(await kv.repository(CachedUserinfo).find({})).toHaveLength(0);
  });

  // Absent means ON when the block is enabled — each concern falls back to its
  // OWN built-in default (ten seconds vs five minutes), never to a shared one.
  test("should cache both when neither is switched off", async () => {
    await request({});
    await request({});

    expect(introspect).toHaveBeenCalledTimes(1);
    expect(userinfo).toHaveBeenCalledTimes(1);
  });

  // The defaults really are per-concern: at t+30s the introspection entry is
  // long gone (10s) while the userinfo entry is still live (5m).
  test("should expire each concern on its own default", async () => {
    await request({});

    MockDate.set(new Date(NOW.getTime() + 30_000).toISOString());
    await request({});

    expect(introspect).toHaveBeenCalledTimes(2);
    expect(userinfo).toHaveBeenCalledTimes(1);
  });
});
