import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type { PylonAuthEndpoints } from "../../../types/index.js";
import { validateAuthSettings } from "./validate-auth-settings.js";

const ENDPOINTS: PylonAuthEndpoints = {
  issuer: "https://auth.lindorm.io",
  authorizationEndpoint: "https://auth.lindorm.io/authorize",
  tokenEndpoint: "https://auth.lindorm.io/token",
  userinfoEndpoint: null,
  introspectionEndpoint: null,
  revocationEndpoint: null,
  endSessionEndpoint: null,
};

const createDriver = (overrides: Partial<IPylonAuthDriver> = {}): IPylonAuthDriver => ({
  clientId: "client-id",
  issuerScope: "none",
  endpoints: () => ENDPOINTS,
  authorize: vi.fn(),
  exchange: vi.fn(),
  refresh: vi.fn(),
  introspect: vi.fn(),
  userinfo: vi.fn(),
  ...overrides,
});

describe("validateAuthSettings", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  // ⚠ The ONE boot error. A mounted /login that cannot authorize — or cannot
  // redeem the code it gets back — has no degraded mode to fall into.
  describe("router", () => {
    test("should throw when the driver cannot authorize", () => {
      expect(() =>
        validateAuthSettings(
          { driver: createDriver({ authorize: undefined }), router: {} },
          logger,
        ),
      ).toThrow(ServerError);
    });

    test("should throw when the driver cannot exchange", () => {
      expect(() =>
        validateAuthSettings(
          { driver: createDriver({ exchange: undefined }), router: {} },
          logger,
        ),
      ).toThrow(ServerError);
    });

    test("should name every missing capability", () => {
      let error: any = null;

      try {
        validateAuthSettings(
          {
            driver: createDriver({ authorize: undefined, exchange: undefined }),
            router: {},
          },
          logger,
        );
      } catch (err) {
        error = err;
      }

      expect(error).toMatchObject({
        code: "auth_driver_cannot_serve_router",
        type: "urn:lindorm:pylon:error:auth_driver_cannot_serve_router",
        data: { missing: ["authorize", "exchange"] },
      });
    });

    // A pure resource server omits the router, and a driver with neither
    // relying-party method is exactly the right configuration for it. It writes
    // NO refresh policy either — the driver already said it cannot refresh.
    test("should accept a resource-server driver when no router is configured", () => {
      expect(() =>
        validateAuthSettings(
          {
            driver: createDriver({
              authorize: undefined,
              exchange: undefined,
              refresh: undefined,
            }),
          },
          logger,
        ),
      ).not.toThrow();

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  // Refresh is simply OFF — the absent method IS the declaration, and
  // `parseAuthConfig` reads the default straight off it. Only a mode the
  // deployment WROTE can contradict the driver, so only that warns.
  describe("refresh", () => {
    test("should warn once when a mode is configured the driver cannot honour", () => {
      validateAuthSettings(
        { driver: createDriver({ refresh: undefined }), refresh: { mode: "force" } },
        logger,
      );

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("refresh"), {
        mode: "force",
      });
    });

    // ⚠ The whole point: correct config must be silent. A verify-only driver is
    // a normal deployment, and it should not have to write `mode: "none"` to
    // restate what the missing method already says.
    test("should stay silent on the default mode for a driver that cannot refresh", () => {
      validateAuthSettings({ driver: createDriver({ refresh: undefined }) }, logger);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("should stay silent when the deployment named a maxAge but no mode", () => {
      validateAuthSettings(
        { driver: createDriver({ refresh: undefined }), refresh: { maxAge: "30m" } },
        logger,
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("should stay silent when the deployment already asked for none", () => {
      validateAuthSettings(
        { driver: createDriver({ refresh: undefined }), refresh: { mode: "none" } },
        logger,
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("should stay silent when the driver can refresh", () => {
      validateAuthSettings(
        { driver: createDriver(), refresh: { mode: "force" } },
        logger,
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("should never throw for a missing refresh method", () => {
      expect(() =>
        validateAuthSettings(
          { driver: createDriver({ refresh: undefined }), refresh: { mode: "force" } },
          logger,
        ),
      ).not.toThrow();
    });
  });

  // ⚠ `cache.enabled` is CACHE policy, never a capability declaration. A driver
  // that cannot introspect leaves the cache dead, which is a normal deployment.
  describe("cache", () => {
    test("should warn once when caching is enabled but the driver cannot introspect", () => {
      validateAuthSettings(
        {
          driver: createDriver({ introspect: undefined }),
          cache: { enabled: true },
        },
        logger,
      );

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("cach"));
    });

    test("should never throw for a dead cache", () => {
      expect(() =>
        validateAuthSettings(
          { driver: createDriver({ introspect: undefined }), cache: { enabled: true } },
          logger,
        ),
      ).not.toThrow();
    });

    test("should stay silent when caching is off", () => {
      validateAuthSettings(
        { driver: createDriver({ introspect: undefined }), cache: { enabled: false } },
        logger,
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("should warn once when caching is enabled but the driver cannot fetch userinfo", () => {
      validateAuthSettings(
        { driver: createDriver({ userinfo: undefined }), cache: { enabled: true } },
        logger,
      );

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("userinfo"));
    });

    test("should never throw for a dead userinfo cache", () => {
      expect(() =>
        validateAuthSettings(
          { driver: createDriver({ userinfo: undefined }), cache: { enabled: true } },
          logger,
        ),
      ).not.toThrow();
    });

    // Each concern warns for ITSELF: a driver missing both capabilities has two
    // dead halves, and one warning would hide the other.
    test("should warn for each dead concern separately", () => {
      validateAuthSettings(
        {
          driver: createDriver({ introspect: undefined, userinfo: undefined }),
          cache: { enabled: true },
        },
        logger,
      );

      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    // A concern the deployment switched off is not dead config — it is the
    // deployment saying it does not want that cache.
    test("should stay silent for a concern the deployment switched off", () => {
      validateAuthSettings(
        {
          driver: createDriver({ introspect: undefined, userinfo: undefined }),
          cache: { enabled: true, introspection: false, userinfo: false },
        },
        logger,
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("should warn only for the concern still switched on", () => {
      validateAuthSettings(
        {
          driver: createDriver({ introspect: undefined, userinfo: undefined }),
          cache: { enabled: true, introspection: false },
        },
        logger,
      );

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("userinfo"));
    });
  });

  test("should start clean for a driver that serves everything configured", () => {
    expect(() =>
      validateAuthSettings(
        {
          driver: createDriver(),
          router: {},
          cache: { enabled: true },
          refresh: { mode: "half_life" },
        },
        logger,
      ),
    ).not.toThrow();

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
