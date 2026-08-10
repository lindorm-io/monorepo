import { describe, expect, test } from "vitest";
import { isJwtToken } from "./is-jwt-token.js";

const seg = (obj: unknown): string =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

const raw = (value: string): string => Buffer.from(value).toString("base64url");

// Well-formed token strings by media type — enough for the header-shape guard
// (no signature verification is performed).
const JWT = `${seg({ alg: "ES256", typ: "JWT" })}.${seg({ sub: "user_1" })}.sig`;
const AT_JWT = `${seg({ alg: "ES256", typ: "at+jwt" })}.${seg({ sub: "user_1" })}.sig`;
const DPOP = `${seg({ alg: "ES256", typ: "dpop+jwt" })}.${seg({ htm: "GET" })}.sig`;
const SET = `${seg({ alg: "ES256", typ: "secevent+jwt" })}.${seg({ jti: "1" })}.sig`;
const TYPLESS = `${seg({ alg: "ES256" })}.${seg({ sub: "user_1" })}.sig`;
const JWS = `${seg({ alg: "ES256", typ: "JWS" })}.${seg({ data: 1 })}.sig`;
const OPAQUE = `${seg({ alg: "ES256" })}.${raw("opaque-handle")}.sig`;
const LYING = `${seg({ alg: "ES256", typ: "JWT" })}.${raw("opaque-handle")}.sig`;
const JWE = `${seg({ alg: "dir", enc: "A256GCM", typ: "JWE" })}.a.b.c.d`;

describe("isJwtToken", () => {
  test("true for a JWT-typed token string", () => {
    expect(isJwtToken(JWT)).toBe(true);
    expect(isJwtToken(AT_JWT)).toBe(true);
    expect(isJwtToken(DPOP)).toBe(true);
    expect(isJwtToken(SET)).toBe(true);
  });

  test("true for a typ-LESS claims token — RFC 7519 §5.1 makes typ OPTIONAL", () => {
    expect(isJwtToken(TYPLESS)).toBe(true);
  });

  test("false for a JWS / JWE token string", () => {
    expect(isJwtToken(JWS)).toBe(false);
    expect(isJwtToken(JWE)).toBe(false);
  });

  test("false for a signed OPAQUE payload, typ or no typ", () => {
    expect(isJwtToken(OPAQUE)).toBe(false);
    expect(isJwtToken(LYING)).toBe(false);
  });

  test("false for a non-token string", () => {
    expect(isJwtToken("not a token")).toBe(false);
    expect(isJwtToken("")).toBe(false);
  });
});
