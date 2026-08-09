import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test, vi } from "vitest";
import { IDP_SETTINGS } from "../../../__fixtures__/idp.js";
import { Auth0Driver } from "../../../drivers/auth/Auth0Driver.js";
import { JwtDriver } from "../../../drivers/auth/JwtDriver.js";
import { OpenIdDriver } from "../../../drivers/auth/OpenIdDriver.js";
import { OpenIdResourceDriver } from "../../../drivers/auth/OpenIdResourceDriver.js";
import { PylonAuthDriverBase } from "../../../drivers/auth/PylonAuthDriverBase.js";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type { PylonAuthDriverContext, PylonAuthEndpoints } from "../../../types/index.js";
import { validateAuthIssuer } from "./validate-auth-issuer.js";

const ISSUER = "http://test.lindorm.io";

const createAmphora = (
  settings: { internal?: boolean; idp?: boolean } = {},
): IAmphora => {
  const logger = createMockLogger();

  return new Amphora({
    logger,
    ...(settings.internal ? { internal: { issuer: ISSUER } } : {}),
    // The fixture declares an explicit `issuer`, so it resolves without a fetch —
    // amphora only needs a document for a registration that names
    // `openIdConfigurationUri` alone. Nothing here calls `setup()`.
    ...(settings.idp ? { idp: IDP_SETTINGS } : {}),
  });
};

/**
 * A driver that STATES it pins neither scope: it was constructed with its
 * provider's issuer and resolves it from nothing but itself. The case the check
 * must leave alone — and `endpoints` is a spy because the check must not call it
 * either.
 */
const createLiteralDriver = (): IPylonAuthDriver => ({
  clientId: "client-id",
  issuerScope: "none",
  endpoints: vi.fn(
    (_: PylonAuthDriverContext): PylonAuthEndpoints => ({
      issuer: "https://github.com",
      authorizationEndpoint: "https://github.com/login/oauth/authorize",
      tokenEndpoint: "https://github.com/login/oauth/access_token",
      userinfoEndpoint: null,
      introspectionEndpoint: null,
      revocationEndpoint: null,
      endSessionEndpoint: null,
    }),
  ),
});

describe("validateAuthIssuer", () => {
  describe('pinned "self"', () => {
    test("should pass when amphora holds an internal issuer", () => {
      expect(() =>
        validateAuthIssuer(
          { driver: new JwtDriver({ issuer: "self" }) },
          createAmphora({ internal: true }),
        ),
      ).not.toThrow();
    });

    test("should throw the resolver's own error when amphora holds none", () => {
      expect(() =>
        validateAuthIssuer(
          { driver: new JwtDriver({ issuer: "self" }) },
          createAmphora(),
        ),
      ).toThrow(expect.objectContaining({ code: "self_issuer_not_configured" }));
    });

    // An unrelated scope being present is not the pinned one being present.
    test("should throw when only an upstream is registered", () => {
      expect(() =>
        validateAuthIssuer(
          { driver: new JwtDriver({ issuer: "self" }) },
          createAmphora({ idp: true }),
        ),
      ).toThrow(expect.objectContaining({ code: "self_issuer_not_configured" }));
    });
  });

  describe('pinned "idp"', () => {
    test("should pass when an upstream is registered", () => {
      expect(() =>
        validateAuthIssuer(
          { driver: new JwtDriver({ issuer: "idp" }) },
          createAmphora({ idp: true }),
        ),
      ).not.toThrow();
    });

    test("should throw amphora's own error when none is registered", () => {
      expect(() =>
        validateAuthIssuer({ driver: new JwtDriver({ issuer: "idp" }) }, createAmphora()),
      ).toThrow(expect.objectContaining({ code: "idp_not_configured" }));
    });

    test("should throw when only this service's own issuer is configured", () => {
      expect(() =>
        validateAuthIssuer(
          { driver: new JwtDriver({ issuer: "idp" }) },
          createAmphora({ internal: true }),
        ),
      ).toThrow(expect.objectContaining({ code: "idp_not_configured" }));
    });
  });

  // The most common deployment shape: a discovery-backed driver reads
  // `amphora.idp` for its issuer AND for the document it negotiates against, so
  // it pins the scope every bit as hard as a `JwtDriver` configured with it.
  describe("a discovery-backed driver", () => {
    const drivers = (): Array<[string, IPylonAuthDriver]> => [
      ["OpenIdDriver", new OpenIdDriver({ clientId: "client-id" })],
      ["OpenIdResourceDriver", new OpenIdResourceDriver({ clientId: "client-id" })],
      ["Auth0Driver", new Auth0Driver({ clientId: "client-id" })],
    ];

    test.each(drivers())('%s should declare "idp"', (_name, driver) => {
      expect(driver.issuerScope).toBe("idp");
    });

    test.each(drivers())("%s should throw when none is registered", (_name, driver) => {
      expect(() =>
        validateAuthIssuer({ driver }, createAmphora({ internal: true })),
      ).toThrow(expect.objectContaining({ code: "idp_not_configured" }));
    });

    test.each(drivers())("%s should pass when one is registered", (_name, driver) => {
      expect(() =>
        validateAuthIssuer({ driver }, createAmphora({ idp: true })),
      ).not.toThrow();
    });
  });

  // The base class carries the default so only a direct implementer of the
  // interface has to write the declaration — and its default is the shape the
  // base exists for: endpoints returned as a literal.
  test("should leave a base-class subclass that declares nothing alone", () => {
    class GitHubDriver extends PylonAuthDriverBase {
      endpoints(): PylonAuthEndpoints {
        return {
          issuer: "https://github.com",
          authorizationEndpoint: "https://github.com/login/oauth/authorize",
          tokenEndpoint: "https://github.com/login/oauth/access_token",
          userinfoEndpoint: "https://api.github.com/user",
          introspectionEndpoint: null,
          revocationEndpoint: null,
          endSessionEndpoint: null,
        };
      }
    }

    const driver = new GitHubDriver({ clientId: "client-id" });

    expect(driver.issuerScope).toBe("none");
    expect(() => validateAuthIssuer({ driver }, createAmphora())).not.toThrow();
  });

  // ⚠ A check that fires on a driver it was never about is worse than no check.
  test("should leave a driver that pins neither scope alone", () => {
    const driver = createLiteralDriver();

    expect(() => validateAuthIssuer({ driver }, createAmphora())).not.toThrow();
    expect(driver.endpoints).not.toHaveBeenCalled();
  });

  // Which ENDPOINTS a driver needs is the driver's knowledge — `endpoints()` is
  // `issuer` plus six legitimately nullable members, and asking it here would be
  // a second, weaker copy of the capability test `validateAuthSettings` runs.
  test("should never ask the driver for its endpoints", () => {
    const driver = new JwtDriver({ issuer: "self" });
    const endpoints = vi.spyOn(driver, "endpoints");

    validateAuthIssuer({ driver }, createAmphora({ internal: true }));
    expect(endpoints).not.toHaveBeenCalled();

    expect(() => validateAuthIssuer({ driver }, createAmphora())).toThrow();
    expect(endpoints).not.toHaveBeenCalled();
  });
});
