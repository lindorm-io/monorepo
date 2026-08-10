import { liftClaimMatcher } from "./lift-claim-matcher.js";
import { claimByDomain } from "../claims/claims-registry.js";
import { describe, expect, test } from "vitest";

describe("liftClaimMatcher", () => {
  test("should lift an array value to $all", () => {
    expect(liftClaimMatcher(claimByDomain("scope"), ["openid", "profile"])).toEqual({
      $all: ["openid", "profile"],
    });
  });

  test("should pass an operator object through verbatim", () => {
    expect(liftClaimMatcher(claimByDomain("scope"), { $in: ["openid"] })).toEqual({
      $in: ["openid"],
    });
  });

  test("should lift a scalar to $all for an array-valued claim", () => {
    expect(liftClaimMatcher(claimByDomain("audience"), "https://tyr.test")).toEqual({
      $all: ["https://tyr.test"],
    });
  });

  test("should build $eq for a scalar-valued claim", () => {
    expect(liftClaimMatcher(claimByDomain("subject"), "user-1")).toEqual({
      $eq: "user-1",
    });
  });

  test("should build $eq for an unknown claim", () => {
    expect(liftClaimMatcher(undefined, "value")).toEqual({ $eq: "value" });
  });

  test("should build $eq for a number", () => {
    expect(liftClaimMatcher(claimByDomain("levelOfAssurance"), 3)).toEqual({ $eq: 3 });
  });

  test("should return undefined for an unsupported value shape", () => {
    expect(liftClaimMatcher(claimByDomain("subject"), null)).toBeUndefined();
    expect(liftClaimMatcher(claimByDomain("subject"), undefined)).toBeUndefined();
    expect(liftClaimMatcher(claimByDomain("emailVerified"), true)).toBeUndefined();
  });
});
