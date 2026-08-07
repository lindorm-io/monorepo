import { describe, expect, test } from "vitest";
import { buildAuthCacheKey } from "./build-auth-cache-key.js";

const BASE = {
  kind: "introspection" as const,
  token: "opaque-access-token",
  issuer: "https://test.lindorm.io/",
  clientId: "client-a",
};

describe("buildAuthCacheKey", () => {
  test("should derive a stable digest from the four inputs", () => {
    expect(buildAuthCacheKey(BASE)).toMatchSnapshot();
    expect(buildAuthCacheKey(BASE)).toBe(buildAuthCacheKey(BASE));
  });

  test("should derive a stable digest for userinfo", () => {
    expect(buildAuthCacheKey({ ...BASE, kind: "userinfo" })).toMatchSnapshot();
  });

  // The key lands in shared storage, where it is READABLE — a raw token there is
  // a credential leak, so nothing recognisable from it may survive into the key.
  test("should never carry the raw token", () => {
    const key = buildAuthCacheKey(BASE);

    expect(key).not.toContain(BASE.token);
    expect(key).not.toContain(BASE.issuer);
    expect(key).not.toContain(BASE.clientId);
  });

  // RFC 7662 §2.2 — the authorization server MAY answer the SAME token
  // differently per requesting client, and MAY limit which scopes each is told
  // about. Two pylons sharing a KV namespace must therefore never collide.
  test("should isolate by clientId", () => {
    expect(buildAuthCacheKey({ ...BASE, clientId: "client-b" })).not.toBe(
      buildAuthCacheKey(BASE),
    );
  });

  test("should isolate by issuer", () => {
    expect(buildAuthCacheKey({ ...BASE, issuer: "https://other.lindorm.io/" })).not.toBe(
      buildAuthCacheKey(BASE),
    );
  });

  test("should isolate by token", () => {
    expect(buildAuthCacheKey({ ...BASE, token: "other-token" })).not.toBe(
      buildAuthCacheKey(BASE),
    );
  });

  // The two answers to the same (token, issuer, clientId) are different
  // documents; the digest says which one it is.
  test("should isolate by kind", () => {
    expect(buildAuthCacheKey({ ...BASE, kind: "userinfo" })).not.toBe(
      buildAuthCacheKey(BASE),
    );
  });
});
