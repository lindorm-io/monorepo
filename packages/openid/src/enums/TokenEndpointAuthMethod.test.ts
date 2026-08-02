import { describe, expect, test } from "vitest";
import { TokenEndpointAuthMethod } from "./TokenEndpointAuthMethod.js";

describe("TokenEndpointAuthMethod", () => {
  test("should match snapshot", () => {
    expect(TokenEndpointAuthMethod).toMatchSnapshot();
  });

  test("should carry the OIDC Core section 9 methods and the mTLS additions", () => {
    expect(Object.values(TokenEndpointAuthMethod)).toEqual([
      "client_secret_basic",
      "client_secret_jwt",
      "client_secret_post",
      "private_key_jwt",
      "self_signed_tls_client_auth",
      "tls_client_auth",
      "none",
    ]);
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: TokenEndpointAuthMethod = TokenEndpointAuthMethod.PrivateKeyJwt;
    const fromLiteral: TokenEndpointAuthMethod = "client_secret_basic";
    // @ts-expect-error the type is CLOSED — an unlisted registry entry is not a method
    const rejected: TokenEndpointAuthMethod = "urn:example:auth-method";
    // a deployment accepting an unlisted method widens in ITS OWN package, never here
    const widened: TokenEndpointAuthMethod | "urn:example:auth-method" =
      "urn:example:auth-method";

    expect([fromEnum, fromLiteral, rejected, widened]).toMatchSnapshot();
  });
});
