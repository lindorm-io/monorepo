import { describe, expect, test } from "vitest";
import type { PylonLoginCookie } from "../../../types/index.js";
import { redactLoginCookie } from "./redact-login-cookie.js";

describe("redactLoginCookie", () => {
  const cookie: PylonLoginCookie = {
    codeChallengeMethod: "S256",
    codeVerifier: "pkce-code-verifier-secret",
    nonce: "nonce",
    redirectUri: "https://test.lindorm.io/callback",
    responseType: "code",
    scope: "openid profile",
    state: "state",
  };

  test("should filter the pkce code verifier and keep the rest", () => {
    expect(redactLoginCookie(cookie)).toMatchSnapshot();
  });

  test("should not leak the code verifier", () => {
    expect(JSON.stringify(redactLoginCookie(cookie))).not.toContain(
      "pkce-code-verifier-secret",
    );
  });

  test("should not mutate the cookie", () => {
    redactLoginCookie(cookie);

    expect(cookie.codeVerifier).toBe("pkce-code-verifier-secret");
  });
});
