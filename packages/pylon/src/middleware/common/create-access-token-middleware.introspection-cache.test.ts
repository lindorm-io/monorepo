// The RFC 7662 introspection cache, driven end to end against a REAL sqlite
// proteus source and a REAL Amphora — the payload is `@Encrypted`, so a mocked
// repository would prove nothing about what actually round-trips.

import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { OPAQUE_TOKEN } from "../../__fixtures__/access/tokens.js";
import { CachedIntrospection } from "../../entities/CachedIntrospection.js";
import { AUTH_CACHE_SOURCE } from "../../internal/constants/symbols.js";
import { stageEncryptedField } from "../../internal/utils/stage-encrypted-field.js";
import { createAccessTokenMiddleware } from "./create-access-token-middleware.js";

const ISSUER = "https://test.lindorm.io/";
const NOW = new Date("2026-08-06T10:00:00.000Z");

const options: any = { issuer: ISSUER };

const ACTIVE_INTROSPECTION = {
  active: true,
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
  source.addEntities([CachedIntrospection]);
  await stageEncryptedField(source, CachedIntrospection, "payload", {
    condition: { purpose: "pylon:kek" },
  });

  await source.connect();
  await source.setup();

  return source;
};

type ContextOptions = {
  kv?: ProteusSource;
  ttl?: string;
  /** `false` = the deployment turned introspection caching off on its own. */
  introspection?: false;
  clientId?: string;
  issuer?: string;
  introspect: Mock;
};

const createContext = (opts: ContextOptions): any => {
  const ctx: any = {
    aegis: createMockAegis(),
    auth: {
      capabilities: { introspect: true, userinfo: true },
      // Resolved from the DRIVER in production — `endpoints().issuer` and the
      // driver's own client id — hence a method, not a static property.
      config: async () => ({
        issuer: opts.issuer ?? ISSUER,
        clientId: opts.clientId ?? "client-a",
      }),
      introspect: opts.introspect,
    },
    logger: createMockLogger(),
    request: {},
    state: {
      access: null,
      authorization: { type: "bearer", value: OPAQUE_TOKEN },
      session: null,
      tokens: {},
    },
  };

  if (opts.kv) {
    ctx[AUTH_CACHE_SOURCE] = {
      kv: opts.kv,
      introspection: opts.introspection === false ? false : { ttl: opts.ttl },
    };
  }

  return ctx;
};

describe("createAccessTokenMiddleware introspection cache", () => {
  let amphora: IAmphora;
  let kv: ProteusSource;
  let introspect: Mock;
  let next: Mock;

  beforeEach(async () => {
    MockDate.set(NOW.toISOString());

    amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
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
    const middleware = createAccessTokenMiddleware(options);

    const first = createContext({ kv, introspect });
    await middleware(first, next);

    const second = createContext({ kv, introspect });
    await middleware(second, next);

    expect(introspect).toHaveBeenCalledTimes(1);
    expect(second.state.access.provenance).toBe("introspected");
    // A HIT is indistinguishable from a MISS — Dates included.
    expect(second.state.access.claims).toEqual(first.state.access.claims);
  });

  // RFC 7662 §2.2 — the AS may answer the same token differently per client, so
  // one pylon must never be served another's answer out of a shared namespace.
  test("should not share an entry across clientIds", async () => {
    const middleware = createAccessTokenMiddleware(options);

    await middleware(createContext({ kv, introspect }), next);
    await middleware(createContext({ kv, introspect, clientId: "client-b" }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  test("should not share an entry across issuers", async () => {
    const middleware = createAccessTokenMiddleware(options);

    await middleware(createContext({ kv, introspect }), next);
    await middleware(
      createContext({ kv, introspect, issuer: "https://other.lindorm.io/" }),
      next,
    );

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  // The TTL IS the revocation window (RFC 7662 §5) — it must actually elapse.
  test("should introspect again once the entry has expired", async () => {
    const middleware = createAccessTokenMiddleware(options);

    await middleware(createContext({ kv, introspect }), next);

    MockDate.set(new Date(NOW.getTime() + 9_000).toISOString());
    await middleware(createContext({ kv, introspect }), next);
    expect(introspect).toHaveBeenCalledTimes(1);

    MockDate.set(new Date(NOW.getTime() + 11_000).toISOString());
    await middleware(createContext({ kv, introspect }), next);
    expect(introspect).toHaveBeenCalledTimes(2);
  });

  test("should honour a per-mount ttl over the deployment default", async () => {
    const middleware = createAccessTokenMiddleware({
      ...options,
      cache: { ttl: "2 seconds" },
    });

    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    MockDate.set(new Date(NOW.getTime() + 3_000).toISOString());
    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  test("should honour the deployment ttl over the built-in default", async () => {
    const middleware = createAccessTokenMiddleware(options);

    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    // Past the built-in ten seconds, inside the deployment's sixty.
    MockDate.set(new Date(NOW.getTime() + 30_000).toISOString());
    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    expect(introspect).toHaveBeenCalledTimes(1);
  });

  // Mounts share one key, so a strict mount must re-check the AGE of whatever a
  // lenient mount left behind — otherwise its carve-out is decorative.
  test("should not serve a strict mount an entry a lenient mount wrote", async () => {
    const lenient = createAccessTokenMiddleware(options);
    const strict = createAccessTokenMiddleware({
      ...options,
      cache: { ttl: "2 seconds" },
    });

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
    const middleware = createAccessTokenMiddleware({ ...options, cache: false });

    await middleware(createContext({ kv, introspect }), next);
    await middleware(createContext({ kv, introspect }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  test("should never let an entry outlive the token's own expiry", async () => {
    const middleware = createAccessTokenMiddleware(options);

    introspect.mockResolvedValue({
      ...ACTIVE_INTROSPECTION,
      expiresAt: new Date(NOW.getTime() + 3_000),
    });

    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    MockDate.set(new Date(NOW.getTime() + 4_000).toISOString());
    await middleware(createContext({ kv, introspect, ttl: "60 seconds" }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  // A negative is a real entry — it saves the AS the same load, under the same
  // short window — and it still rejects the request.
  test("should cache an inactive answer and still reject", async () => {
    const middleware = createAccessTokenMiddleware(options);
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
    const middleware = createAccessTokenMiddleware(options);

    const first = createContext({ introspect });
    await middleware(first, next);
    await middleware(createContext({ introspect }), next);

    expect(introspect).toHaveBeenCalledTimes(2);
    expect(first.state.access.provenance).toBe("introspected");
  });

  // Serving an earlier answer while the AS is unreachable is a revocation
  // bypass with extra steps.
  test("should cache nothing and propagate when introspection fails", async () => {
    const middleware = createAccessTokenMiddleware(options);
    introspect.mockRejectedValue(new Error("authorization server is down"));

    await expect(middleware(createContext({ kv, introspect }), next)).rejects.toThrow(
      ClientError,
    );

    const rows = await kv.repository(CachedIntrospection).find({});
    expect(rows).toHaveLength(0);

    await expect(middleware(createContext({ kv, introspect }), next)).rejects.toThrow(
      ClientError,
    );
    expect(introspect).toHaveBeenCalledTimes(2);
  });

  // No client identity ⇒ no key that is safe to share (RFC 7662 §2.2), so the
  // cache steps aside rather than key on the token alone.
  test("should skip the cache when the driver cannot resolve its identity", async () => {
    const middleware = createAccessTokenMiddleware(options);
    const unresolvable = async () => {
      throw new Error("idp not configured");
    };

    const first = createContext({ kv, introspect });
    first.auth.config = unresolvable;
    await middleware(first, next);

    const second = createContext({ kv, introspect });
    second.auth.config = unresolvable;
    await middleware(second, next);

    expect(introspect).toHaveBeenCalledTimes(2);
  });

  // A storage outage must degrade to an introspection, never fail the request.
  test("should serve the request when the cache backend fails", async () => {
    const middleware = createAccessTokenMiddleware(options);
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
