import { describe, expect, test } from "vitest";
import { serializeChallenge } from "./serialize-challenge.js";

describe("serializeChallenge", () => {
  test("should serialize a basic challenge", () => {
    expect(
      serializeChallenge("basic", { realm: "lindorm.io", charset: "UTF-8" }),
    ).toMatchSnapshot();
  });

  test("should serialize a bearer challenge", () => {
    expect(
      serializeChallenge("bearer", {
        realm: "lindorm.io",
        error: "insufficient_scope",
        errorDescription: "The access token lacks the required scope",
        scope: "openid profile",
      }),
    ).toMatchSnapshot();
  });

  test("should serialize a dpop challenge", () => {
    expect(
      serializeChallenge("dpop", {
        realm: "lindorm.io",
        error: "use_dpop_nonce",
        errorDescription: "Resource server requires nonce in DPoP proof",
        algs: ["ES256", "PS256"],
        nonce: "nonce-value",
      }),
    ).toMatchSnapshot();
  });

  test("should emit params in a fixed order regardless of input order", () => {
    expect(
      serializeChallenge("bearer", {
        scope: "openid",
        errorDescription: "description",
        error: "invalid_token",
        realm: "lindorm.io",
      }),
    ).toMatchSnapshot();
  });

  test("should escape backslash and double quote in quoted-strings", () => {
    expect(
      serializeChallenge("bearer", {
        realm: 'lindorm"io\\realm',
        errorDescription: 'he said "no"',
      }),
    ).toMatchSnapshot();
  });

  test("should drop empty and undefined params", () => {
    expect(
      serializeChallenge("dpop", {
        realm: "",
        error: undefined,
        errorDescription: "kept",
        algs: [],
      }),
    ).toMatchSnapshot();
  });

  test("should emit the scheme alone when no params remain", () => {
    expect(serializeChallenge("basic")).toMatchSnapshot();
    expect(serializeChallenge("bearer", {})).toMatchSnapshot();
    expect(serializeChallenge("dpop", { realm: "" })).toMatchSnapshot();
  });

  test("should never emit the dpop nonce as an auth-param", () => {
    expect(serializeChallenge("dpop", { nonce: "nonce-value" })).toMatchSnapshot();
  });
});
