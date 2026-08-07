// `ctx.state.app.config` is the ONE home for this deployment's configuration and
// policy, and this is the only thing that builds it. Driven from the real
// SETTINGS through a real Amphora and real drivers — the auth block's issuer and
// capabilities are read off the driver, so a stub would prove nothing about what
// a deployment actually gets.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { JwtDriver } from "../../drivers/auth/JwtDriver.js";
import type { IPylonAuthDriver } from "../../interfaces/index.js";
import type { ILogger } from "@lindorm/logger";
import { buildAppConfig } from "./build-app-config.js";

const ISSUER = "https://test.lindorm.io/";

const ENDPOINTS = {
  issuer: ISSUER,
  authorizationEndpoint: `${ISSUER}authorize`,
  tokenEndpoint: `${ISSUER}token`,
  userinfoEndpoint: `${ISSUER}userinfo`,
  introspectionEndpoint: `${ISSUER}introspect`,
  revocationEndpoint: null,
  endSessionEndpoint: null,
};

const createDriver = (overrides: Partial<IPylonAuthDriver> = {}): IPylonAuthDriver =>
  ({
    clientId: "client-a",
    endpoints: () => ENDPOINTS,
    introspect: vi.fn(),
    userinfo: vi.fn(),
    ...overrides,
  }) as unknown as IPylonAuthDriver;

describe("buildAppConfig", () => {
  let amphora: IAmphora;
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger: createMockLogger() });
  });

  const build = (options: any = {}) =>
    buildAppConfig({ amphora, logger, environment: "test", ...options });

  // ⚠ Nothing configured is not an error and not a missing member: every entry
  // is present and OFF, so a middleware reads one property and decides.
  test("should resolve everything off for a bare deployment", () => {
    expect(build()).toEqual({
      audit: false,
      rateLimit: false,
      auth: null,
    });
  });

  // ⚠ There is no `responseCache` entry to resolve. Its every knob is stated per
  // `useCache` mount, so a deployment entry could only have been a second switch
  // beside the mount — the mount is the whole declaration.
  test("should carry no responseCache entry at all", () => {
    expect(build()).not.toHaveProperty("responseCache");
    expect(build({ responseCache: { enabled: true } })).not.toHaveProperty(
      "responseCache",
    );
  });

  describe("audit", () => {
    test("should resolve false when the block is absent", () => {
      expect(build().audit).toBe(false);
    });

    // ⚠ The BLOCK is the switch. A bare `{}` is a deployment saying "audit, with
    // nothing to narrow" — there is no `enabled` beside the policy to disagree
    // with it.
    test("should resolve an empty policy for a bare block", () => {
      expect(build({ audit: {} }).audit).toEqual({});
    });

    // ⚠ The policy carries NO source. Audit publishes through `ctx.bus`, the
    // request-scoped session every other feature reads its storage from.
    test("should carry only the policy", () => {
      const sanitise = vi.fn();
      const skip = vi.fn();

      expect(build({ audit: { sanitise, skip } }).audit).toEqual({
        sanitise,
        skip,
      });
    });

    // `entities` drives Pylon's proteus listeners, not per-request behaviour, so
    // it never reaches the request context.
    test("should leave entities out of the resolved policy", () => {
      expect(build({ audit: { entities: [class Thing {}] } }).audit).toEqual({});
    });
  });

  describe("rateLimit", () => {
    test("should resolve false when the block is absent", () => {
      expect(build().rateLimit).toBe(false);
    });

    // ⚠ MILLISECONDS. `useRateLimit` compares a mount's window against this one,
    // and two spellings of a duration cannot be compared.
    test("should resolve the window to milliseconds", () => {
      expect(build({ rateLimit: { window: "1m", max: 10 } }).rateLimit).toEqual({
        strategy: "fixed",
        window: 60_000,
        max: 10,
      });
    });

    test("should pass a numeric window through unchanged", () => {
      expect(build({ rateLimit: { window: 5_000, max: 3 } }).rateLimit).toEqual({
        strategy: "fixed",
        window: 5_000,
        max: 3,
      });
    });

    // A bare block without limits is a legitimate deployment: it switches rate
    // limiting on for mounts that state their own.
    test("should resolve null limits for a bare block", () => {
      expect(build({ rateLimit: {} }).rateLimit).toEqual({
        strategy: "fixed",
        window: null,
        max: null,
      });
    });

    test("should carry the strategy, key and skip", () => {
      const key = vi.fn();
      const skip = vi.fn();

      expect(
        build({
          rateLimit: {
            strategy: "sliding",
            window: "1m",
            max: 1,
            key,
            skip,
          },
        }).rateLimit,
      ).toEqual({ strategy: "sliding", window: 60_000, max: 1, key, skip });
    });
  });

  describe("auth", () => {
    // ⚠ `null` IS "no auth configured". This is eager state on EVERY request of
    // EVERY pylon, so reading it must never throw.
    test("should resolve null when no auth block is configured", () => {
      expect(build().auth).toBeNull();
    });

    test("should read the issuer from the driver's endpoints", () => {
      expect(build({ auth: { driver: createDriver() } }).auth).toMatchObject({
        issuer: ISSUER,
        clientId: "client-a",
      });
    });

    // Amphora prefers the issuer a discovery document actually published, and a
    // tenant-scoped provider only settles it at runtime — so it comes from
    // `endpoints()`, never from settings.
    test("should prefer the driver's runtime issuer", () => {
      const driver = createDriver({
        endpoints: () => ({ ...ENDPOINTS, issuer: "https://tenant.lindorm.io" }),
      });

      expect(build({ auth: { driver } }).auth?.issuer).toBe("https://tenant.lindorm.io");
    });

    // ⚠ A driver whose pinned scope resolves to nothing THROWS by name. That must
    // not take the process down while building eager per-request state.
    test("should warn and resolve a null issuer when the driver cannot resolve one", () => {
      const bare = new Amphora({ logger: createMockLogger() });

      const config = buildAppConfig({
        amphora: bare,
        logger,
        environment: "test",
        auth: { driver: new JwtDriver({ issuer: "self" }) },
      });

      expect(config.auth?.issuer).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("could not resolve its issuer"),
        expect.anything(),
      );
    });

    // A VERIFY-ONLY driver is nobody's OAuth client. `""` would be a client id
    // that is simply WRONG, keying every such pylon's entries together.
    test("should resolve a null clientId for a driver that declares none", () => {
      expect(
        build({ auth: { driver: createDriver({ clientId: undefined }) } }).auth?.clientId,
      ).toBeNull();
    });

    test("should resolve a null clientId for an empty-string client id", () => {
      expect(
        build({ auth: { driver: createDriver({ clientId: "" }) } }).auth?.clientId,
      ).toBeNull();
    });

    // DERIVED from the driver, never configured — a flag could disagree.
    test("should derive capabilities from the driver's methods", () => {
      expect(build({ auth: { driver: createDriver() } }).auth?.capabilities).toEqual({
        introspect: true,
        userinfo: true,
      });

      expect(
        build({
          auth: { driver: createDriver({ introspect: undefined, userinfo: undefined }) },
        }).auth?.capabilities,
      ).toEqual({ introspect: false, userinfo: false });
    });

    describe("cache", () => {
      test("should resolve false when the block is absent", () => {
        expect(build({ auth: { driver: createDriver() } }).auth?.cache).toBe(false);
      });

      test("should resolve false when disabled, TTLs and all", () => {
        expect(
          build({
            auth: {
              driver: createDriver(),
              cache: { enabled: false, introspection: { ttl: "30 seconds" } },
            },
          }).auth?.cache,
        ).toBe(false);
      });

      // The per-concern TTLs are carried UNRESOLVED: introspection resolves over
      // three tiers and userinfo over two, each at its own call site.
      test("should carry each concern through unresolved when enabled", () => {
        expect(
          build({
            auth: {
              driver: createDriver(),
              cache: {
                enabled: true,
                introspection: { ttl: "2 seconds" },
                userinfo: false,
              },
            },
          }).auth?.cache,
        ).toEqual({ introspection: { ttl: "2 seconds" }, userinfo: false });
      });

      test("should leave both concerns absent when enabled bare", () => {
        expect(
          build({ auth: { driver: createDriver(), cache: { enabled: true } } }).auth
            ?.cache,
        ).toEqual({});
      });
    });
  });

  // ⚠ Deeply FROZEN, not merely typed readonly: a handler flipping a policy
  // mid-request would change behaviour for everything downstream in that chain,
  // and `readonly` stops at the first cast — which is exactly what a middleware
  // reaching into `ctx as any` does.
  describe("immutability", () => {
    const build2 = (amphora: IAmphora, logger: ILogger) =>
      buildAppConfig({
        amphora,
        logger,
        environment: "test",
        audit: { skip: vi.fn() },
        rateLimit: { window: "1m", max: 10 },
        auth: { driver: createDriver(), cache: { enabled: true } },
      });

    test("should reject a write to a top-level entry", () => {
      const config: any = build2(amphora, logger);

      expect(() => {
        config.audit = false;
      }).toThrow(TypeError);
      expect(config.audit).not.toBe(false);
    });

    test("should reject a write to a nested policy", () => {
      const config: any = build2(amphora, logger);

      expect(() => {
        config.rateLimit.max = 999;
      }).toThrow(TypeError);
      expect(config.rateLimit.max).toBe(10);
    });

    // The two members a handler is most likely to reach for, and the two whose
    // mutation would silently change an authorization decision downstream.
    test("should reject a write to the auth cache policy and capabilities", () => {
      const config: any = build2(amphora, logger);

      expect(() => {
        config.auth.cache = false;
      }).toThrow(TypeError);
      expect(config.auth.cache).toEqual({});

      expect(() => {
        config.auth.capabilities.introspect = false;
      }).toThrow(TypeError);
      expect(config.auth.capabilities.introspect).toBe(true);
    });
  });
});
