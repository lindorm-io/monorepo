import { describe, expect, test } from "vitest";
import { isJwsToken } from "./is-jws-token.js";

const seg = (obj: unknown): string =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

const JWS = `${seg({ alg: "ES256", typ: "JWS" })}.${seg({ data: 1 })}.sig`;
const JOSE = `${seg({ alg: "ES256", typ: "JOSE" })}.${seg({ data: 1 })}.sig`;
const AT_JWS = `${seg({ alg: "ES256", typ: "at+jws" })}.${seg({ data: 1 })}.sig`;
const JWT = `${seg({ alg: "ES256", typ: "JWT" })}.${seg({ sub: "user_1" })}.sig`;
const JWE = `${seg({ alg: "dir", enc: "A256GCM", typ: "JWE" })}.a.b.c.d`;

describe("isJwsToken", () => {
  test("true for a JWS / JOSE / +jws token string", () => {
    expect(isJwsToken(JWS)).toBe(true);
    expect(isJwsToken(JOSE)).toBe(true);
    expect(isJwsToken(AT_JWS)).toBe(true);
  });

  test("false for a JWT / JWE token string", () => {
    expect(isJwsToken(JWT)).toBe(false);
    expect(isJwsToken(JWE)).toBe(false);
  });

  test("false for a non-token string", () => {
    expect(isJwsToken("not a token")).toBe(false);
    expect(isJwsToken("")).toBe(false);
  });
});
