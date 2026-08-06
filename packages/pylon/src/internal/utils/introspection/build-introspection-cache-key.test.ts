import { describe, expect, test } from "vitest";
import { buildIntrospectionCacheKey } from "./build-introspection-cache-key.js";

const BASE = {
  token: "opaque-access-token",
  issuer: "https://test.lindorm.io/",
  clientId: "client-a",
};

describe("buildIntrospectionCacheKey", () => {
  test("should derive a stable digest from the three inputs", () => {
    expect(buildIntrospectionCacheKey(BASE)).toMatchSnapshot();
    expect(buildIntrospectionCacheKey(BASE)).toBe(buildIntrospectionCacheKey(BASE));
  });

  // The key lands in shared storage, where it is READABLE — a raw token there is
  // a credential leak, so nothing recognisable from it may survive into the key.
  test("should never carry the raw token", () => {
    const key = buildIntrospectionCacheKey(BASE);

    expect(key).not.toContain(BASE.token);
    expect(key).not.toContain(BASE.issuer);
    expect(key).not.toContain(BASE.clientId);
  });

  // RFC 7662 §2.2 — the authorization server MAY answer the SAME token
  // differently per requesting client, and MAY limit which scopes each is told
  // about. Two pylons sharing a KV namespace must therefore never collide.
  test("should isolate by clientId", () => {
    expect(buildIntrospectionCacheKey({ ...BASE, clientId: "client-b" })).not.toBe(
      buildIntrospectionCacheKey(BASE),
    );
  });

  test("should isolate by issuer", () => {
    expect(
      buildIntrospectionCacheKey({ ...BASE, issuer: "https://other.lindorm.io/" }),
    ).not.toBe(buildIntrospectionCacheKey(BASE));
  });

  test("should isolate by token", () => {
    expect(buildIntrospectionCacheKey({ ...BASE, token: "other-token" })).not.toBe(
      buildIntrospectionCacheKey(BASE),
    );
  });
});
