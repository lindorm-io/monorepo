// The driver-response cache has exactly ONE switch:
// `ctx.state.app.config.auth.cache`. `buildAppConfig` is the only thing that
// sets it, and its ABSENCE is what keeps caching off — there is no second flag
// anywhere that could disagree. Storage is `ctx.cache`, the ordinary evictable
// session, so a deployment with no ephemeral source keeps calling the driver
// uncached and WITHOUT error.
//
// Driven end to end from the SETTINGS through the real `buildAppConfig` + real
// dependencies middleware + real auth client against a REAL sqlite source and
// Amphora — the payloads are `@Encrypted`, so mocks would prove nothing about
// what round-trips.

import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { CachedIntrospection } from "../../../entities/CachedIntrospection.js";
import { CachedUserinfo } from "../../../entities/CachedUserinfo.js";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import { useAccessToken } from "../../../middleware/common/use-access-token.js";
import type { PylonAuthSettings } from "../../../types/index.js";
import { createDependenciesMiddleware } from "../../middleware/common-dependencies-middleware.js";
import { parseAuthConfig } from "../auth/parse-auth-config.js";
import { buildAppConfig } from "../build-app-config.js";
import { stageEncryptedField } from "../stage-encrypted-field.js";

const ISSUER = "https://test.lindorm.io/";
const TOKEN = "opaque-access-token";

const INTROSPECTION = {
  active: true,
  subject: "alice",
  scope: ["openid"],
};

const PROFILE = { subject: "alice", name: "Alice Andersson" };

let sources: Array<ProteusSource> = [];

const createCacheSource = async (amphora: IAmphora): Promise<ProteusSource> => {
  const source = new ProteusSource({
    driver: "sqlite",
    filename: ":memory:",
    entities: [] as never,
    logger: createMockLogger(),
    synchronize: true,
    amphora,
  });
  sources.push(source);

  await source.addEntities([CachedIntrospection, CachedUserinfo]);
  for (const entity of [CachedIntrospection, CachedUserinfo]) {
    await stageEncryptedField(source, entity, "payload", {
      condition: { purpose: "pylon:kek" },
    });
  }

  await source.connect();
  await source.setup();

  return source;
};

describe("auth cache capability", () => {
  let amphora: IAmphora;
  let cache: ProteusSource;
  let introspect: Mock;
  let userinfo: Mock;
  let driver: IPylonAuthDriver;

  beforeEach(async () => {
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger: createMockLogger() });
    amphora.add([
      KryptosKit.generate.enc.oct({
        algorithm: "A128KW",
        issuer: ISSUER,
        publish: false,
        purpose: "pylon:kek",
      }),
    ]);

    cache = await createCacheSource(amphora);

    introspect = vi.fn().mockResolvedValue(INTROSPECTION);
    userinfo = vi.fn().mockResolvedValue(PROFILE);

    driver = {
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
    } as unknown as IPylonAuthDriver;
  });

  afterEach(async () => {
    await Promise.all(sources.map((source) => source.disconnect()));
    sources = [];
    vi.clearAllMocks();
  });

  const createCtx = (auth: PylonAuthSettings): any => {
    const aegis = createMockAegis();
    // Opaque credential: nothing to verify locally, so the middleware must go to
    // the authorization server (RFC 7662).
    aegis.verify.mockRejectedValue(new Error("unsupported_token_type"));

    return {
      aegis,
      amphora,
      logger: createMockLogger(),
      request: {},
      state: {
        access: null,
        actor: "unknown",
        app: {
          environment: "test",
          // The REAL resolver, from the REAL settings — the switch under test is
          // what `buildAppConfig` makes of `auth.cache`.
          config: buildAppConfig({ amphora, auth, logger: createMockLogger() }),
        },
        authorization: { type: "bearer", value: TOKEN },
        metadata: { correlationId: "corr-1", date: new Date() },
        origin: "https://api.lindorm.io",
        session: null,
        tokens: {},
      },
    };
  };

  /**
   * ONE request, wired exactly as `PylonHttp` wires it: settings → app config +
   * parsed auth config → dependencies middleware → access-token middleware →
   * `ctx.auth`.
   */
  const request = async (
    auth: PylonAuthSettings,
    source: ProteusSource | null,
  ): Promise<void> => {
    const ctx = createCtx(auth);

    await createDependenciesMiddleware({
      authConfig: parseAuthConfig(auth),
      cache: (source ?? undefined) as any,
    })(ctx, vi.fn());

    await useAccessToken()(ctx, vi.fn());
    await ctx.auth.userinfo(TOKEN);
  };

  // CONFIGURED ⇒ caches. One driver call each across two requests.
  test("should cache both concerns when auth.cache is enabled", async () => {
    const auth: PylonAuthSettings = { driver, cache: { enabled: true } };

    await request(auth, cache);
    await request(auth, cache);

    expect(introspect).toHaveBeenCalledTimes(1);
    expect(userinfo).toHaveBeenCalledTimes(1);

    expect(await cache.repository(CachedIntrospection).find({})).toHaveLength(1);
    expect(await cache.repository(CachedUserinfo).find({})).toHaveLength(1);
  });

  // ABSENT ⇒ the driver is called every time. This is the capability rule: the
  // policy is the ONLY thing that turns caching on.
  test("should call the driver every request when auth.cache is absent", async () => {
    const auth: PylonAuthSettings = { driver };

    await request(auth, cache);
    await request(auth, cache);

    expect(introspect).toHaveBeenCalledTimes(2);
    expect(userinfo).toHaveBeenCalledTimes(2);

    expect(await cache.repository(CachedIntrospection).find({})).toHaveLength(0);
    expect(await cache.repository(CachedUserinfo).find({})).toHaveLength(0);
  });

  // `enabled: false` is the same "off" as an absent block — the TTLs beside it
  // cannot resurrect the cache.
  test("should call the driver every request when auth.cache is disabled", async () => {
    const auth: PylonAuthSettings = {
      driver,
      cache: {
        enabled: false,
        introspection: { ttl: "1 hour" },
        userinfo: { ttl: "1 hour" },
      },
    };

    await request(auth, cache);
    await request(auth, cache);

    expect(introspect).toHaveBeenCalledTimes(2);
    expect(userinfo).toHaveBeenCalledTimes(2);
  });

  // No evictable source ⇒ uncached and WITHOUT error: the policy says "cache",
  // the deployment has nowhere to put it, and a request must still succeed.
  test("should degrade to uncached calls when no evictable source is configured", async () => {
    const auth: PylonAuthSettings = { driver, cache: { enabled: true } };

    await expect(request(auth, null)).resolves.toBeUndefined();
    await expect(request(auth, null)).resolves.toBeUndefined();

    expect(introspect).toHaveBeenCalledTimes(2);
    expect(userinfo).toHaveBeenCalledTimes(2);
  });
});
