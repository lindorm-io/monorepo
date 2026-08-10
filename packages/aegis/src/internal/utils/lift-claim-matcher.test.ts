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

  test("should build $eq for a boolean claim", () => {
    expect(liftClaimMatcher(claimByDomain("emailVerified"), true)).toEqual({ $eq: true });
    expect(liftClaimMatcher(claimByDomain("emailVerified"), false)).toEqual({
      $eq: false,
    });
  });

  // A Date is a temporal claim VALUE, never an operator bag — `isObject`
  // excludes it by prototype, so it must have its own branch.
  test("should build $eq for a Date claim", () => {
    const date = new Date("2024-01-01T08:00:00.000Z");

    expect(liftClaimMatcher(claimByDomain("authTime"), date)).toEqual({ $eq: date });
  });

  test("should return undefined for an unsupported value shape", () => {
    expect(liftClaimMatcher(claimByDomain("subject"), null)).toBeUndefined();
    expect(liftClaimMatcher(claimByDomain("subject"), undefined)).toBeUndefined();
    expect(liftClaimMatcher(claimByDomain("authTime"), new Date("nope"))).toBeUndefined();
  });
});
