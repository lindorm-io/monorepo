import { describe, expect, test } from "vitest";
import type { DomainAssert, DomainClaimMatchers } from "./domain-assert.js";

describe("DomainClaimMatchers / DomainAssert (type witness — 25 → 8 audit)", () => {
  test("the eight kept matchers accept string / array / operator forms", () => {
    const matchers: DomainClaimMatchers = {
      audience: "https://rs.lindorm.io/", // single identity, contains-self
      issuer: "https://idp.lindorm.io/", // identity
      scope: ["read", "write"], // all present
      authMethods: "pwd",
      roles: { $in: ["admin", "user"] }, // any present
      permissions: ["read:all"],
      groups: { $in: ["ops"] },
      entitlements: ["premium"],
    };

    expect(matchers.audience).toBe("https://rs.lindorm.io/");
    expect(matchers.scope).toEqual(["read", "write"]);
  });

  test("DomainAssert = the named matchers PLUS a predicate over the rest", () => {
    const assert: DomainAssert = {
      // named matchers
      audience: "https://rs.lindorm.io/",
      scope: ["read"],
      // folded equality claims live in the predicate half
      subject: "user_1",
      authorizedParty: "client_1",
      nonce: "n-abc",
    };

    expect(assert.subject).toBe("user_1");
    expect(assert.authorizedParty).toBe("client_1");
  });
});
