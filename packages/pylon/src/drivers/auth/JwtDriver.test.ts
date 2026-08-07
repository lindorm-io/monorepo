import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import type { IPylonAuthDriver } from "../../interfaces/index.js";
import { createAuthDriverContext } from "../../internal/utils/auth/create-auth-driver-context.js";
import type { PylonAuthDriverContext } from "../../types/index.js";
import { JwtDriver } from "./JwtDriver.js";

const SELF = "https://tyr.lindorm.io/";
const IDP = "https://auth.lindorm.io/";

describe("JwtDriver", () => {
  /**
   * ⚠ A REAL `Amphora`, not a mock. The whole driver is a read of amphora's two
   * own-side issuer scopes, so a hand-written stub would only assert the stub.
   */
  const createContext = (settings: {
    issuer?: string;
    idp?: { issuer?: string; jwksUri?: string };
  }): PylonAuthDriverContext => {
    const logger = createMockLogger();

    return createAuthDriverContext({
      amphora: new Amphora({ ...settings, logger }),
      logger,
      state: {
        app: { environment: "test" },
        metadata: { correlationId: "test-correlation" },
      },
    } as any);
  };

  describe("construction", () => {
    // The scope routinely comes from a config file or an env var, where the
    // literal union is not enforced.
    test("should reject an issuer scope it does not know", () => {
      expect(() => new JwtDriver({ issuer: "upstream" as any })).toThrow(
        expect.objectContaining({ code: "jwt_driver_issuer_scope_unknown" }),
      );
    });

    test("should accept both known scopes", () => {
      expect(() => new JwtDriver({ issuer: "self" })).not.toThrow();
      expect(() => new JwtDriver({ issuer: "idp" })).not.toThrow();
    });
  });

  /**
   * The absence IS the capability declaration. Pylon reads exactly this at boot
   * to refuse to mount an auth router this driver cannot serve, and
   * `resolveAuthIdentity` reads the missing `clientId` the same way.
   */
  describe("declared capabilities", () => {
    let contract: IPylonAuthDriver;

    beforeEach(() => {
      contract = new JwtDriver({ issuer: "self" });
    });

    test("should implement endpoints and nothing else", () => {
      expect(contract.endpoints).toEqual(expect.any(Function));

      expect(contract.authorize).toBeUndefined();
      expect(contract.exchange).toBeUndefined();
      expect(contract.refresh).toBeUndefined();
      expect(contract.clientCredentials).toBeUndefined();
      expect(contract.introspect).toBeUndefined();
      expect(contract.userinfo).toBeUndefined();
      expect(contract.subject).toBeUndefined();
      expect(contract.logout).toBeUndefined();
    });

    test("should not inherit them through a prototype chain", () => {
      const driver = new JwtDriver({ issuer: "self" });

      expect("authorize" in driver).toBe(false);
      expect("exchange" in driver).toBe(false);
      expect("introspect" in driver).toBe(false);
    });

    // It is nobody's OAuth client, so it presents no client id at all.
    test("should declare no clientId", () => {
      expect(contract.clientId).toBeUndefined();
      expect("clientId" in (contract as object)).toBe(false);
    });

    test("should declare no pkce method", () => {
      expect(contract.pkce).toBeUndefined();
    });
  });

  describe("endpoints", () => {
    test("should pin this service's own issuer", () => {
      const context = createContext({ issuer: SELF });

      expect(new JwtDriver({ issuer: "self" }).endpoints(context)).toMatchSnapshot();
    });

    test("should pin the upstream idp's issuer", () => {
      const context = createContext({
        issuer: SELF,
        idp: { issuer: IDP, jwksUri: `${IDP}.well-known/jwks.json` },
      });

      expect(new JwtDriver({ issuer: "idp" }).endpoints(context)).toMatchSnapshot();
    });

    // The two scopes are independent: a federating service holds BOTH, which is
    // why the setting has no default.
    test("should pin each scope independently on a service that holds both", () => {
      const context = createContext({
        issuer: SELF,
        idp: { issuer: IDP, jwksUri: `${IDP}.well-known/jwks.json` },
      });

      expect(new JwtDriver({ issuer: "self" }).endpoints(context).issuer).toBe(SELF);
      expect(new JwtDriver({ issuer: "idp" }).endpoints(context).issuer).toBe(IDP);
    });

    // The sync signature IS the amphora boundary — see `IPylonAuthDriver`.
    test("should resolve endpoints without awaiting anything", () => {
      const context = createContext({ issuer: SELF });

      const endpoints = new JwtDriver({ issuer: "self" }).endpoints(context);

      expect(endpoints).not.toBeInstanceOf(Promise);
      expect(endpoints.issuer).toBe(SELF);
    });
  });

  /**
   * A pinned issuer that resolves to nothing would verify every token against
   * nothing, so each unconfigured scope fails by name.
   */
  describe("unconfigured scopes", () => {
    test("should throw for `self` when amphora declares no issuer of its own", () => {
      const context = createContext({});

      expect(() => new JwtDriver({ issuer: "self" }).endpoints(context)).toThrow(
        expect.objectContaining({ code: "self_issuer_not_configured" }),
      );
    });

    // Amphora's own error, and it says exactly the right thing.
    test("should throw for `idp` when no upstream is registered", () => {
      const context = createContext({ issuer: SELF });

      expect(() => new JwtDriver({ issuer: "idp" }).endpoints(context)).toThrow(
        expect.objectContaining({ code: "idp_not_configured" }),
      );
    });

    /**
     * ⚠ Registered, but not yet RESOLVED. An idp declared by
     * `openIdConfigurationUri` alone carries no issuer until amphora has fetched
     * that document, and registration is lazy by default. `AmphoraExternalConfig`
     * cannot express that (its `issuer` is a `string`), so `idp.config()` throws
     * rather than handing back a config with nothing to pin — amphora's own
     * error, propagated verbatim.
     */
    test("should throw for `idp` when amphora resolved no issuer for it", () => {
      const context = createContext({
        issuer: SELF,
        idp: {
          openIdConfigurationUri: `${IDP}.well-known/openid-configuration`,
        } as any,
      });

      expect(() => new JwtDriver({ issuer: "idp" }).endpoints(context)).toThrow(
        expect.objectContaining({ code: "idp_issuer_unresolved" }),
      );
    });
  });
});
