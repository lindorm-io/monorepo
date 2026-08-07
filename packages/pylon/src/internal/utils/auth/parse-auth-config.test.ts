import { describe, expect, test } from "vitest";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type { PylonAuthEndpoints } from "../../../types/index.js";
import { parseAuthConfig } from "./parse-auth-config.js";

const ENDPOINTS: PylonAuthEndpoints = {
  issuer: "https://issuer.com",
  authorizationEndpoint: "https://issuer.com/authorize",
  tokenEndpoint: "https://issuer.com/token",
  userinfoEndpoint: null,
  introspectionEndpoint: null,
  revocationEndpoint: null,
  endSessionEndpoint: null,
};

const driver: IPylonAuthDriver = {
  clientId: "test-client-id",
  endpoints: () => ENDPOINTS,
};

// The driver is an OPAQUE instance to the config parser — snapshotting it would
// assert its shape, not the parsing. Its identity is asserted on its own below.
const parsed = (settings: Parameters<typeof parseAuthConfig>[0]) => {
  const { driver: _driver, ...rest } = parseAuthConfig(settings);
  return rest;
};

describe("parseAuthConfig", () => {
  test("should return config with null router when no router options", () => {
    expect(parsed({ driver })).toMatchSnapshot();
  });

  test("should merge defaults with router options", () => {
    expect(parsed({ driver, router: {} })).toMatchSnapshot();
  });

  test("should merge defaults with custom router options", () => {
    expect(
      parsed({
        driver,
        defaultTokenExpiry: "1d",
        refresh: {
          maxAge: "6m",
          mode: "none",
        },
        router: {
          dynamicRedirectDomains: ["https://client.com"],
          staticRedirect: {
            login: "https://client.com/login/static",
          },
        },
      }),
    ).toMatchSnapshot();
  });

  test("should merge refresh defaults when refresh is partially specified", () => {
    expect(parsed({ driver, refresh: { mode: "max_age" } })).toMatchSnapshot();
  });

  test("should carry the driver through untouched", () => {
    expect(parseAuthConfig({ driver }).driver).toBe(driver);
  });

  // `auth.cache` is the ONE driver-response-cache switch. An absent block and an
  // explicit `enabled: false` collapse to the SAME `null`, so there is never a
  // second flag the two cache utilities could disagree with.
  describe("cache", () => {
    test("should parse no policy when the block is absent", () => {
      expect(parseAuthConfig({ driver }).cache).toBeNull();
    });

    test("should parse no policy when the block is disabled, TTLs and all", () => {
      expect(
        parseAuthConfig({
          driver,
          cache: { enabled: false, introspection: { ttl: "30 seconds" } },
        }).cache,
      ).toBeNull();
    });

    test("should carry each concern through UNRESOLVED when enabled", () => {
      expect(
        parseAuthConfig({
          driver,
          cache: { enabled: true, introspection: { ttl: "2 seconds" }, userinfo: false },
        }).cache,
      ).toEqual({ introspection: { ttl: "2 seconds" }, userinfo: false });
    });

    test("should leave both concerns absent when enabled bare", () => {
      expect(parseAuthConfig({ driver, cache: { enabled: true } }).cache).toEqual({});
    });
  });
});
