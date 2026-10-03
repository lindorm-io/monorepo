import { describe, expect, test } from "vitest";
import type { DomainAssert, DomainClaimMatchers, VerifyAssert } from "./domain-assert.js";

describe("DomainClaimMatchers / DomainAssert (type witness)", () => {
  test("the eight named matchers accept string / array / operator forms", () => {
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

  test("DomainAssert names transactionId, a claim the token read returns beyond the floor set", () => {
    const assert: DomainAssert = { transactionId: "txn_abc" };

    expect(assert).toMatchSnapshot();
  });

  test("DomainAssert names events, conditioned per event URI", () => {
    const assert: DomainAssert = {
      events: { "urn:lindorm:event:test": { $exists: true } },
    };

    expect(assert).toMatchSnapshot();
  });

  test("VerifyAssert names transactionId beside the hash-derive inputs", () => {
    const assert: VerifyAssert = {
      accessToken: "an-access-token",
      transactionId: "txn_abc",
    };

    expect(assert).toMatchSnapshot();
  });
});
