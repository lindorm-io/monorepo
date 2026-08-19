import { describe, expect, test } from "vitest";
import { coseName, joseName } from "../claims/claims-registry.js";
import { matcherWireName } from "./matcher-wire-name.js";

describe("matcherWireName", () => {
  test("should resolve a domain matcher key to its JOSE name", () => {
    expect(matcherWireName("audience", joseName)).toBe("aud");
  });

  // RFC 7519 §4.1.7 spells the claim `jti`; RFC 8392 §3.1.7 registers the same
  // claim as `cti`. The divergence is what makes the reverse map load-bearing.
  test("should resolve tokenId to the diverging name on each wire", () => {
    expect(matcherWireName("tokenId", joseName)).toBe("jti");
    expect(matcherWireName("tokenId", coseName)).toBe("cti");
  });

  test("should resolve a hash-derive matcher key to the claim it lands in", () => {
    expect(matcherWireName("accessToken", joseName)).toBe("at_hash");
    expect(matcherWireName("authCode", joseName)).toBe("c_hash");
    expect(matcherWireName("authState", joseName)).toBe("s_hash");
  });

  test("should return undefined for an unregistered key", () => {
    expect(matcherWireName("nonsense", joseName)).toBeUndefined();
  });

  // The key comes from the caller, so a prototype member must not resolve:
  // `HASH_MATCHERS.toString` is inherited and truthy.
  test("should return undefined for a prototype member", () => {
    expect(matcherWireName("toString", joseName)).toBeUndefined();
    expect(matcherWireName("constructor", joseName)).toBeUndefined();
    // `__proto__` is the one that returns an OBJECT rather than a function, so it
    // reaches `claimByDomain` as a different shape than the other two.
    expect(matcherWireName("__proto__", joseName)).toBeUndefined();
  });
});
