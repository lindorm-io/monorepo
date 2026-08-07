import { ServerError } from "@lindorm/errors";
import { describe, expect, test, vi } from "vitest";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type { PylonAuthDriverContext, PylonAuthEndpoints } from "../../../types/index.js";
import { resolveAuthIdentity } from "./resolve-auth-identity.js";

const ISSUER = "https://auth.lindorm.io";

const ENDPOINTS: PylonAuthEndpoints = {
  issuer: ISSUER,
  authorizationEndpoint: `${ISSUER}/authorize`,
  tokenEndpoint: `${ISSUER}/token`,
  userinfoEndpoint: null,
  introspectionEndpoint: null,
  revocationEndpoint: null,
  endSessionEndpoint: null,
};

const context = {} as PylonAuthDriverContext;

describe("resolveAuthIdentity", () => {
  test("should pair the driver's resolved issuer with its client id", () => {
    const driver: IPylonAuthDriver = {
      clientId: "client-id",
      endpoints: () => ENDPOINTS,
    };

    expect(resolveAuthIdentity(driver, context)).toEqual({
      issuer: ISSUER,
      clientId: "client-id",
    });
  });

  // ⚠ The issuer is the DRIVER's resolved one — a tenant-scoped provider only
  // settles it at runtime, so there is nothing static to read it from.
  test("should take the issuer from endpoints, not from settings", () => {
    const endpoints = vi
      .fn()
      .mockReturnValue({ ...ENDPOINTS, issuer: "https://tenant.lindorm.io" });

    expect(
      resolveAuthIdentity({ clientId: "client-id", endpoints }, context).issuer,
    ).toBe("https://tenant.lindorm.io");
    expect(endpoints).toHaveBeenCalledWith(context);
  });

  /**
   * A verify-only driver has no OAuth client, so it declares no `clientId`.
   * Substituting `""` would key every such pylon's cache entries together —
   * exactly the cross-tenant leak `buildAuthCacheKey` exists to prevent (RFC
   * 7662 §2.2 lets the AS answer the same token differently per client). The
   * impossibility is made EXPLICIT instead.
   */
  test("should throw for a driver that declares no client id", () => {
    const driver: IPylonAuthDriver = { endpoints: () => ENDPOINTS };

    expect(() => resolveAuthIdentity(driver, context)).toThrow(
      expect.objectContaining({
        code: "driver_has_no_client_id",
        type: "urn:lindorm:pylon:error:driver_has_no_client_id",
      }),
    );
    expect(() => resolveAuthIdentity(driver, context)).toThrow(ServerError);
  });

  // An empty string is a client id that is simply wrong, not an absent one.
  test("should throw for an empty client id rather than key on it", () => {
    const driver = { clientId: "", endpoints: () => ENDPOINTS } as IPylonAuthDriver;

    expect(() => resolveAuthIdentity(driver, context)).toThrow(
      expect.objectContaining({ code: "driver_has_no_client_id" }),
    );
  });

  // It never even asks the driver where its provider is — there is no identity
  // to build either half of.
  test("should not call endpoints when there is no client id", () => {
    const endpoints = vi.fn().mockReturnValue(ENDPOINTS);

    expect(() => resolveAuthIdentity({ endpoints }, context)).toThrow();
    expect(endpoints).not.toHaveBeenCalled();
  });
});
