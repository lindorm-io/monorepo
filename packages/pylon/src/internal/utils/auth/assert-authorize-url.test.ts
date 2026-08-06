import { ServerError } from "@lindorm/errors";
import { describe, expect, test } from "vitest";
import { assertAuthorizeUrl } from "./assert-authorize-url.js";

const url = (query: Record<string, string>): URL => {
  const result = new URL("https://auth.lindorm.io/authorize");
  for (const [key, value] of Object.entries(query)) {
    result.searchParams.set(key, value);
  }
  return result;
};

describe("assertAuthorizeUrl", () => {
  const options = { codeChallenge: "challenge", state: "state" };

  test("should return the facts pylon drives the callback with", () => {
    expect(
      assertAuthorizeUrl(
        url({
          state: "state",
          code_challenge: "challenge",
          response_type: "code id_token",
          scope: "openid profile",
        }),
        options,
      ),
    ).toEqual({ responseType: "code id_token", scope: "openid profile" });
  });

  // RFC 6749 §4.1.1 marks `response_type` REQUIRED, so a driver whose provider
  // carries it some other way gets the only flow the shipped drivers run.
  test("should default the response type to code", () => {
    expect(
      assertAuthorizeUrl(url({ state: "state", code_challenge: "challenge" }), options)
        .responseType,
    ).toBe("code");
  });

  test("should default the scope to empty", () => {
    expect(
      assertAuthorizeUrl(url({ state: "state", code_challenge: "challenge" }), options)
        .scope,
    ).toBe("");
  });

  // RFC 6749 §10.12 — the callback verifies `state` against the cookie, so a URL
  // that never carried it is a login that only looks protected.
  test("should throw when the state is absent", () => {
    expect(() =>
      assertAuthorizeUrl(url({ code_challenge: "challenge" }), options),
    ).toThrow(ServerError);
  });

  test("should throw when the state was replaced", () => {
    expect(() =>
      assertAuthorizeUrl(url({ state: "other", code_challenge: "challenge" }), options),
    ).toThrow(ServerError);
  });

  // RFC 7636 §4.3 — the verifier pylon stored would not match a challenge that
  // never reached the provider.
  test("should throw when the code challenge is absent", () => {
    expect(() => assertAuthorizeUrl(url({ state: "state" }), options)).toThrow(
      ServerError,
    );
  });

  test("should throw when the code challenge was replaced", () => {
    expect(() =>
      assertAuthorizeUrl(url({ state: "state", code_challenge: "other" }), options),
    ).toThrow(ServerError);
  });

  test("should name itself in the error", () => {
    let error: any = null;

    try {
      assertAuthorizeUrl(url({ code_challenge: "challenge" }), options);
    } catch (err) {
      error = err;
    }

    expect(error).toMatchObject({
      code: "authorize_url_invalid",
      type: "urn:lindorm:pylon:error:authorize_url_invalid",
      data: { expected: "state", received: null },
    });
  });

  // A driver that declared `pkce: null` runs without a challenge at all, so
  // there is nothing to hold it to.
  test("should not require a code challenge when the flow ran without pkce", () => {
    expect(() =>
      assertAuthorizeUrl(url({ state: "state" }), {
        codeChallenge: null,
        state: "state",
      }),
    ).not.toThrow();
  });
});
