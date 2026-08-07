import { ServerError } from "@lindorm/errors";
import { getOpenIdConfiguration } from "./get-open-id-configuration.js";
import { beforeEach, describe, expect, test } from "vitest";

const catchThrown = (fn: () => unknown): any => {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
};

describe("getOpenIdConfiguration", () => {
  let ctx: any;
  let openIdConfiguration: any;

  beforeEach(() => {
    openIdConfiguration = {
      issuer: "issuer",
      authorizationEndpoint: "https://auth.example.com/authorize",
      tokenEndpoint: "https://auth.example.com/token",
      test: "test",
    };

    ctx = {
      amphora: {
        idp: {
          config: () => ({
            issuer: "issuer",
            openIdConfiguration,
          }),
        },
      },
    };
  });

  test("should resolve", () => {
    expect(getOpenIdConfiguration(ctx)).toEqual({
      issuer: "issuer",
      authorizationEndpoint: "https://auth.example.com/authorize",
      tokenEndpoint: "https://auth.example.com/token",
      test: "test",
    });
  });

  // Only `authorization_endpoint` / `token_endpoint` are REQUIRED — a document
  // without the OPTIONAL ones is adopted, and the absence surfaces at point of use.
  test("should resolve a document that omits every OPTIONAL endpoint", () => {
    const result = getOpenIdConfiguration(ctx);

    expect(result.userinfoEndpoint).toBeUndefined();
    expect(result.introspectionEndpoint).toBeUndefined();
    expect(result.endSessionEndpoint).toBeUndefined();
    expect(result.tokenEndpointAuthMethodsSupported).toBeUndefined();
  });

  // The idp is registered but amphora holds no document for it — either it was
  // registered as an issuer + jwksUri pair (nothing to discover) or the
  // resolution has not happened / did not succeed. There is no second issuer to
  // compare against any more: which issuer this is, IS `amphora.idp`.
  test("should throw when the idp carries no discovery document", () => {
    ctx.amphora.idp.config = () => ({ issuer: "issuer", openIdConfiguration: null });

    const error = catchThrown(() => getOpenIdConfiguration(ctx));

    expect(error).toBeInstanceOf(ServerError);
    expect(error.code).toBe("openid_configuration_not_found");
    expect(error.data).toEqual({ issuer: "issuer" });
  });

  test("propagates the throw when no idp is configured", () => {
    ctx.amphora.idp.config = () => {
      throw new Error("idp_not_configured");
    };

    expect(() => getOpenIdConfiguration(ctx)).toThrow();
  });

  // OIDC Discovery §3 / RFC 8414 §2 mark these two REQUIRED — a document without
  // them is not a usable OP, and the failure belongs here, where it is adopted.
  describe("required metadata", () => {
    const catchError = (): any => catchThrown(() => getOpenIdConfiguration(ctx));

    test("should throw when authorizationEndpoint is missing", () => {
      delete openIdConfiguration.authorizationEndpoint;

      const error = catchError();

      expect(error).toBeInstanceOf(ServerError);
      expect(error.code).toBe("openid_configuration_incomplete");
      expect(error.type).toBe("urn:lindorm:pylon:error:openid_configuration_incomplete");
      expect(error.data).toEqual({
        issuer: "issuer",
        missing: ["authorization_endpoint"],
      });
    });

    test("should throw when tokenEndpoint is missing", () => {
      delete openIdConfiguration.tokenEndpoint;

      const error = catchError();

      expect(error.code).toBe("openid_configuration_incomplete");
      expect(error.data).toEqual({ issuer: "issuer", missing: ["token_endpoint"] });
    });

    test("should name every missing required field", () => {
      delete openIdConfiguration.authorizationEndpoint;
      delete openIdConfiguration.tokenEndpoint;

      expect(catchError().data.missing).toEqual([
        "authorization_endpoint",
        "token_endpoint",
      ]);
    });
  });
});
