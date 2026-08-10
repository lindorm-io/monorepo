// The RFC 7662 introspection cache, driven end to end against a REAL sqlite
// proteus source and a REAL Amphora — the payload is `@Encrypted`, so a mocked
// repository would prove nothing about what actually round-trips.

import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import type { ReadableTime } from "@lindorm/date";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { ClientError, LindormError } from "@lindorm/errors";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import {
  ACCESS_MOUNT,
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
} from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { CachedIntrospection } from "../../entities/CachedIntrospection.js";
import type { IPylonAuthDriver } from "../../interfaces/index.js";
import { createAuthClient } from "../../internal/utils/auth/create-auth-client.js";
import { stageEncryptedField } from "../../internal/utils/stage-encrypted-field.js";
import { useAccessToken } from "./use-access-token.js";

const ISSUER = "https://test.lindorm.io/";
const NOW = new Date("2026-08-06T10:00:00.000Z");

/**
 * ⚠ `tokenType`, `issuer` and `audience` are not decoration. The introspected arm
 * now asserts that the answer declared a `token_type` at all (RFC 7662 §2.2), and
 * the shared assert pins `iss` with a hard `$eq` and applies the mount's
 * `audience` — so an answer missing any of the three is refused before the cache
 * behaviour under test here can be observed.
 */
const ACTIVE_INTROSPECTION = {
  active: true,
  custom: {},
  tokenType: "Bearer",
  issuer: ISSUER,
  audience: [ACCESS_TEST_AUDIENCE],
  subject: "alice",
  scope: ["openid"],
  permissions: ["users:read"],
  expiresAt: new Date("2026-08-06T11:00:00.000Z"),
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
  await source.addEntities([CachedIntrospection]);
  await stageEncryptedField(source, CachedIntrospection, "payload", {
    condition: { purpose: "pylon:kek" },
  });

  await source.connect();
  await source.setup();

  return source;
};

type ContextOptions = {
  kv?: ProteusSource;
  ttl?: ReadableTime;
  /** `false` = the deployment turned introspection caching off on its own. */
  introspection?: false;
  clientId?: string | null;
  issuer?: string | null;
  introspect: Mock;
};

const createDriver = (introspect: Mock, clientId: string): IPylonAuthDriver =>
  ({
    clientId,
    endpoints: () => ({
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}authorize`,
      tokenEndpoint: `${ISSUER}token`,
      userinfoEndpoint: null,
      introspectionEndpoint: `${ISSUER}introspect`,
      revocationEndpoint: null,
      endSessionEndpoint: null,
    }),
    introspect,
  }) as unknown as IPylonAuthDriver;

const createContext = (opts: ContextOptions): any => {
  const aegis = createMockAegis();
  // The presented credential is OPAQUE, so the local fast path inside
  // `ctx.auth.introspect` must fail and the driver call must be reached.
  aegis.verify.mockRejectedValue(new Error("unsupported_token_type"));

  const clientId = opts.clientId === undefined ? "client-a" : opts.clientId;
  const issuer = opts.issuer === undefined ? ISSUER : opts.issuer;

  const ctx: any = {
    aegis,
    amphora: {},
    logger: createMockLogger(),
    request: {},
    state: {
      access: null,
      app: {
        // Exactly what `buildAppConfig` resolves — the driver's identity and
        // capabilities, and the deployment's per-concern cache policy. The
        // policy is only ON when there is a source to store in.
        config: createTestAppConfig({
          auth: createTestAuthConfig({
            clientId,
            issuer,
            cache: opts.kv
              ? {
                  introspection: opts.introspection === false ? false : { ttl: opts.ttl },
                }
              : false,
          }),
        }),
        environment: "test",
      },
      authorization: { type: "bearer", value: OPAQUE_TOKEN },
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

  // The REAL client — the cache lives inside `introspect`, so a stub here would
  // test nothing.
  ctx.auth = createAuthClient(ctx, {
    driver: createDriver(opts.introspect, clientId ?? ""),
    defaultTokenExpiry: "1d",
    refresh: { maxAge: "1h", mode: "half_life" },
    router: null,
  });

  return ctx;
};

describe("useAccessToken introspection cache", () => {
  let amphora: IAmphora;
  let kv: ProteusSource;
  let introspect: Mock;
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
    introspect = vi.fn().mockResolvedValue(ACTIVE_INTROSPECTION);
    next = vi.fn();
  });

  afterEach(async () => {
    MockDate.reset();
    await Promise.all(sources.map((source) => source.disconnect()));
    sources = [];
    vi.clearAllMocks();
  });

  test("should introspect once across two requests for the same token", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    const first = createContext({ kv, introspect });
    await middleware(first, next);

    const second = createContext({ kv, introspect });
    await middleware(second, next);

    expect(introspect).toHaveBeenCalledTimes(1);
    expect(second.state.access.provenance).toBe("introspected");
    // A HIT is indistinguishable from a MISS — Dates included.
    expect(second.state.access.claims).toEqual(first.state.access.claims);
  });

  // The extension claims go through the SAME encrypted json column, and the wire
  // translation that column stores in would re-key them — so a HIT must hand the
  // bucket back exactly as the MISS produced it, key for key.
  test("should round-trip the custom claims through the stored entry", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    introspect.mockResolvedValue({
      ...ACTIVE_INTROSPECTION,
      custom: { tenantTier: "gold", "urn:lindorm:claim:v2": { nested: ["a"] } },
    });

    const first = createContext({ kv, introspect });
    await middleware(first, next);

    const second = createContext({ kv, introspect });
    await middleware(second, next);

    expect(introspect).toHaveBeenCalledTimes(1);
    expect(second.state.access.custom).toEqual({
      tenantTier: "gold",
      "urn:lindorm:claim:v2": { nested: ["a"] },
    });
    expect(second.state.access.custom).toEqual(first.state.access.custom);
  });

  // RFC 7662 §2.2 — the AS may answer the same token differently per client, so
  // one pylon must never be served another's answer out of a shared namespace.
  test("should not share an entry across clientIds", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    await middleware(createContext({ kv, introspect }), next);
    await middleware(createContext({ kv, introspect, clientId: "client-b" }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  test("should not share an entry across issuers", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);
    const other = "https://other.lindorm.io/";

    await middleware(createContext({ kv, introspect }), next);

    // The second pylon pins a different issuer, and the shared assert compares
    // the answer's `iss` against it with a hard `$eq` — so its authorization
    // server has to name itself, or the request is refused before the cache
    // keying under test here can be observed.
    introspect.mockResolvedValue({ ...ACTIVE_INTROSPECTION, issuer: other });
    await middleware(createContext({ kv, introspect, issuer: other }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  // The TTL IS the revocation window (RFC 7662 §5) — it must actually elapse.
  test("should introspect again once the entry has expired", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    await middleware(createContext({ kv, introspect }), next);

    MockDate.set(new Date(NOW.getTime() + 9_000).toISOString());
    await middleware(createContext({ kv, introspect }), next);
    expect(introspect).toHaveBeenCalledTimes(1);

    MockDate.set(new Date(NOW.getTime() + 11_000).toISOString());
    await middleware(createContext({ kv, introspect }), next);
    expect(introspect).toHaveBeenCalledTimes(2);
  });

  test("should honour a per-mount ttl over the deployment default", async () => {
    const middleware = useAccessToken({ ...ACCESS_MOUNT, cache: { ttl: "2 seconds" } });

    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    MockDate.set(new Date(NOW.getTime() + 3_000).toISOString());
    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  test("should honour the deployment ttl over the built-in default", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    // Past the built-in ten seconds, inside the deployment's sixty.
    MockDate.set(new Date(NOW.getTime() + 30_000).toISOString());
    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    expect(introspect).toHaveBeenCalledTimes(1);
  });

  // Mounts share one key, so a strict mount must re-check the AGE of whatever a
  // lenient mount left behind — otherwise its carve-out is decorative.
  test("should not serve a strict mount an entry a lenient mount wrote", async () => {
    const lenient = useAccessToken(ACCESS_MOUNT);
    const strict = useAccessToken({ ...ACCESS_MOUNT, cache: { ttl: "2 seconds" } });

    await lenient(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    MockDate.set(new Date(NOW.getTime() + 5_000).toISOString());
    await strict(createContext({ kv, introspect, ttl: "60 seconds" }), next);
    expect(introspect).toHaveBeenCalledTimes(2);

    // …and the lenient mount still holds its own entry for the full sixty.
    await lenient(createContext({ kv, introspect, ttl: "60 seconds" }), next);
    expect(introspect).toHaveBeenCalledTimes(2);
  });

  // The sensitive-route carve-out: tier one may only ever NARROW.
  test("should introspect every request when the mount opts out", async () => {
    const middleware = useAccessToken({ ...ACCESS_MOUNT, cache: false });

    await middleware(createContext({ kv, introspect }), next);
    await middleware(createContext({ kv, introspect }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  test("should never let an entry outlive the token's own expiry", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    introspect.mockResolvedValueOnce({
      ...ACTIVE_INTROSPECTION,
      expiresAt: new Date(NOW.getTime() + 3_000),
    });

    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    // Four seconds on, the cached entry is gone even though the sixty-second
    // TTL has barely started — so the SECOND request reaches the authorization
    // server, which answers about a token that is now live again.
    MockDate.set(new Date(NOW.getTime() + 4_000).toISOString());
    introspect.mockResolvedValueOnce({
      ...ACTIVE_INTROSPECTION,
      expiresAt: new Date(NOW.getTime() + 60_000),
    });
    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  /**
   * `active` is the authorization server's primary answer and is honoured first,
   * but it cannot catch the server contradicting ITSELF: an answer that reports
   * `active: true` beside an `exp` already in the past is not a live token, and
   * serving it would extend every such grant indefinitely.
   *
   * ⚠ The window is `Aegis.matches`'s DEFAULT one — the same builder verify
   * runs — not a hand-rolled `exp > now`, which would carry no clock tolerance at
   * all and so reject claims the structured arm accepts inside its skew window.
   * The default tolerance is zero, which is why one second past `exp` is enough
   * to refuse the answer here.
   */
  test("should reject an active answer whose own exp has already passed", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    introspect.mockResolvedValue({
      ...ACTIVE_INTROSPECTION,
      expiresAt: new Date(NOW.getTime() - 1_000),
    });

    const ctx = createContext({ kv, introspect });

    await expect(middleware(ctx, next)).rejects.toMatchObject({
      status: 401,
      code: "token_not_active",
    });
    expect(ctx.state.access).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  test("should reject an active answer whose nbf has not yet been reached", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    introspect.mockResolvedValue({
      ...ACTIVE_INTROSPECTION,
      notBefore: new Date(NOW.getTime() + 60_000),
    });

    const ctx = createContext({ kv, introspect });

    await expect(middleware(ctx, next)).rejects.toMatchObject({
      status: 401,
      code: "token_not_active",
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Neither claim is required by RFC 7662 §2.2 — every member is a MAY — so an
  // answer carrying no temporal claims at all must still be accepted.
  test("should accept an active answer that carries no temporal claims", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    introspect.mockResolvedValue({ ...ACTIVE_INTROSPECTION });

    const ctx = createContext({ kv, introspect });

    await expect(middleware(ctx, next)).resolves.toBeUndefined();
    expect(ctx.state.access.provenance).toBe("introspected");
  });

  // A negative is a real entry — it saves the AS the same load, under the same
  // short window — and it still rejects the request.
  test("should cache an inactive answer and still reject", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);
    introspect.mockResolvedValue({ active: false });

    const first = createContext({ kv, introspect });
    await expect(middleware(first, next)).rejects.toThrow(ClientError);

    const second = createContext({ kv, introspect });
    await expect(middleware(second, next)).rejects.toMatchObject({
      status: 401,
      code: "token_not_active",
    });

    expect(introspect).toHaveBeenCalledTimes(1);
    expect(second.state.access).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  // `kv` is optional on PylonSettings — a service without one must keep working
  // exactly as it did before the cache existed.
  test("should work uncached when no source is configured", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    const first = createContext({ introspect });
    await middleware(first, next);
    await middleware(createContext({ introspect }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
    expect(first.state.access.provenance).toBe("introspected");
  });

  /**
   * Serving an earlier answer while the AS is unreachable is a revocation bypass
   * with extra steps — so nothing is cached and the failure propagates.
   *
   * ⚠ PROPAGATES AS ITSELF. It used to be converted into a 401
   * `access_token_verification_failed`, because the middleware wrapped every
   * error it did not recognise. A driver whose store or transport failed
   * therefore told the caller its credential was bad and hid the 500 from the
   * operator — on the hot path for every opaque token.
   */
  test("should cache nothing and propagate when introspection fails", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);
    introspect.mockRejectedValue(new Error("authorization server is down"));

    await expect(middleware(createContext({ kv, introspect }), next)).rejects.toThrow(
      "authorization server is down",
    );

    const rows = await kv.repository(CachedIntrospection).find({});
    expect(rows).toHaveLength(0);

    await expect(middleware(createContext({ kv, introspect }), next)).rejects.toThrow(
      "authorization server is down",
    );
    expect(introspect).toHaveBeenCalledTimes(2);
  });

  /**
   * The FILED bug, in the shape it was reported: the introspection driver's own
   * storage failed, and the caller was told its access token was invalid.
   *
   * `ProteusError` extends `LindormError` DIRECTLY — it is neither a
   * `ClientError` nor a `ServerError` — which is exactly why the old
   * "rethrow those two, wrap everything else" catch laundered it into a 401.
   */
  test("should propagate a driver storage failure instead of reporting a bad credential", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    // The shape of a `ProteusError`: a LindormError that is neither of the two
    // the old catch recognised. Constructed here rather than imported so the
    // test states the PROPERTY that matters rather than depending on proteus.
    class StorageError extends LindormError {
      static readonly namespace = "proteus";
    }
    introspect.mockRejectedValue(
      new StorageError("Connection refused", { code: "connection_refused" }),
    );

    const ctx = createContext({ kv, introspect });

    await expect(middleware(ctx, next)).rejects.toMatchObject({
      code: "connection_refused",
    });
    await expect(middleware(ctx, next)).rejects.not.toBeInstanceOf(ClientError);
    expect(ctx.state.access).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  // ⚠ EXPECTATION FLIPPED. This asserted that a deployment with no settled issuer
  // still introspected, uncached, on every request. `resolveAccessIssuer` now runs
  // BEFORE either arm and both require its answer, so such a deployment refuses
  // the request outright — the authorization server is never asked at all, and the
  // cache's own "no issuer ⇒ no safe key" branch is unreachable through this
  // middleware. (Cache keying by issuer stays covered by the cross-issuer test.)
  test("should refuse the request when the deployment resolved no issuer", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    await expect(
      middleware(createContext({ kv, introspect, issuer: null }), next),
    ).rejects.toMatchObject({
      code: "access_issuer_unresolved",
      data: { auth: "unresolved" },
    });

    expect(introspect).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  // A VERIFY-ONLY driver is nobody's OAuth client, and an empty client id would
  // key every such pylon's entries together.
  test("should skip the cache when the driver exposes no client id", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);

    await middleware(createContext({ kv, introspect, clientId: null }), next);
    await middleware(createContext({ kv, introspect, clientId: null }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  // A storage outage must degrade to an introspection, never fail the request.
  test("should serve the request when the cache backend fails", async () => {
    const middleware = useAccessToken(ACCESS_MOUNT);
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

    const ctx = createContext({ kv: broken, introspect });
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.state.access.provenance).toBe("introspected");
    expect(introspect).toHaveBeenCalledTimes(1);
  });
});
