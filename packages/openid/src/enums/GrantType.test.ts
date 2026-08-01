import { describe, expect, test } from "vitest";
import { GrantType } from "./GrantType.js";

describe("GrantType", () => {
  test("should match snapshot", () => {
    expect(GrantType).toMatchSnapshot();
  });

  test("should carry the RFC urn grant types verbatim", () => {
    expect(GrantType.DeviceCode).toBe("urn:ietf:params:oauth:grant-type:device_code");
    expect(GrantType.TokenExchange).toBe(
      "urn:ietf:params:oauth:grant-type:token-exchange",
    );
    expect(GrantType.JwtBearer).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(GrantType.Saml2Bearer).toBe("urn:ietf:params:oauth:grant-type:saml2-bearer");
    expect(GrantType.Ciba).toBe("urn:openid:params:grant-type:ciba");
  });

  test("should derive the type from the runtime values", () => {
    const fromEnum: GrantType = GrantType.AuthorizationCode;
    const fromLiteral: GrantType = "client_credentials";
    // open union — RFC 6749 §8.3 allows extension grant types
    const extension: GrantType = "urn:example:params:oauth:grant-type:custom";

    expect([fromEnum, fromLiteral, extension]).toMatchSnapshot();
  });
});
