import { ServerError } from "@lindorm/errors";
import { getOpenIdConfiguration } from "./get-open-id-configuration.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("getOpenIdConfiguration", () => {
  let config: any;
  let ctx: any;
  let openIdConfiguration: any;

  beforeEach(() => {
    config = {
      issuer: "issuer",
    };

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
    expect(getOpenIdConfiguration(ctx, config)).toEqual({
      issuer: "issuer",
      authorizationEndpoint: "https://auth.example.com/authorize",
      tokenEndpoint: "https://auth.example.com/token",
      test: "test",
    });
  });

  // Only `authorization_endpoint` / `token_endpoint` are REQUIRED — a document
  // without the OPTIONAL ones is adopted, and the absence surfaces at point of use.
  test("should resolve a document that omits every OPTIONAL endpoint", () => {
    const result = getOpenIdConfiguration(ctx, config);

    expect(result.userinfoEndpoint).toBeUndefined();
    expect(result.introspectionEndpoint).toBeUndefined();
    expect(result.endSessionEndpoint).toBeUndefined();
    expect(result.tokenEndpointAuthMethodsSupported).toBeUndefined();
  });

  test("should throw error if configuration cannot be found", () => {
    config.issuer = "wrong";

    expect(() => getOpenIdConfiguration(ctx, config)).toThrow(ServerError);
  });

  test("propagates the throw when no idp is configured", () => {
    ctx.amphora.idp.config = () => {
      throw new Error("idp_not_configured");
    };

    expect(() => getOpenIdConfiguration(ctx, config)).toThrow();
  });

  // OIDC Discovery §3 / RFC 8414 §2 mark these two REQUIRED — a document without
  // them is not a usable OP, and the failure belongs here, where it is adopted.
  describe("required metadata", () => {
    const catchError = (): any => {
      try {
        getOpenIdConfiguration(ctx, config);
        return null;
      } catch (error) {
        return error;
      }
    };

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
